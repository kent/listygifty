#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud
require_cmd heroku
require_cmd psql
require_cmd pg_isready
require_cmd cloud-sql-proxy

ENVIRONMENT="$(resolve_environment "${ENVIRONMENT:-production}")"
SECRET_PREFIX="${SECRET_PREFIX:-$(default_secret_prefix "${ENVIRONMENT}")}"

PROJECT_ID="${PROJECT_ID:-listygifty}"
HEROKU_APP="${HEROKU_APP:-$(resolve_heroku_app "${ENVIRONMENT}")}"
SQL_INSTANCE="${SQL_INSTANCE:-niftygifty-postgres-central}"
SQL_DB_NAME="${SQL_DB_NAME:-niftygifty_$(resolve_environment "${ENVIRONMENT}")}"
if [[ "${ENVIRONMENT}" == "production" ]]; then
  default_sql_db_user="niftygifty"
else
  default_sql_db_user="niftygifty_${ENVIRONMENT}"
fi
SQL_DB_USER="${SQL_DB_USER:-${default_sql_db_user}}"
SECRET_DB_PASSWORD="${SECRET_DB_PASSWORD:-${SECRET_PREFIX}db-password}"
LOCAL_PROXY_PORT="${LOCAL_PROXY_PORT:-5433}"
KEEP_DUMP="${KEEP_DUMP:-0}"

preferred_pg_bin_dir="/opt/homebrew/opt/postgresql@17/bin"
if [[ -x "${preferred_pg_bin_dir}/pg_dump" && -x "${preferred_pg_bin_dir}/pg_restore" ]]; then
  PG_DUMP_BIN="${preferred_pg_bin_dir}/pg_dump"
  PG_RESTORE_BIN="${preferred_pg_bin_dir}/pg_restore"
else
  require_cmd pg_dump
  require_cmd pg_restore
  PG_DUMP_BIN="$(command -v pg_dump)"
  PG_RESTORE_BIN="$(command -v pg_restore)"
fi

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(connectionName)')"
DB_PASSWORD="$(gcloud secrets versions access latest --project="${PROJECT_ID}" --secret="${SECRET_DB_PASSWORD}")"

if [[ -z "${HEROKU_APP}" ]]; then
  echo "HEROKU_APP must be set (for example: export HEROKU_APP=your-heroku-app). You can also set HEROKU_APP_PRODUCTION or HEROKU_APP_STAGING." >&2
  exit 1
fi

HEROKU_DATABASE_URL="$(heroku config:get DATABASE_URL -a "${HEROKU_APP}")"

if [[ -z "${HEROKU_DATABASE_URL}" ]]; then
  echo "Could not read DATABASE_URL from Heroku app ${HEROKU_APP}" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
DUMP_FILE="${TMP_DIR}/heroku.dump"
PROXY_LOG="${TMP_DIR}/cloud-sql-proxy.log"

cleanup() {
  if [[ -n "${PROXY_PID:-}" ]] && kill -0 "${PROXY_PID}" >/dev/null 2>&1; then
    kill "${PROXY_PID}" >/dev/null 2>&1 || true
    wait "${PROXY_PID}" >/dev/null 2>&1 || true
  fi

  if [[ "${KEEP_DUMP}" != "1" ]]; then
    rm -rf "${TMP_DIR}"
  else
    log "Preserved dump at ${DUMP_FILE}"
  fi
}
trap cleanup EXIT

log "Creating Heroku PostgreSQL dump (${HEROKU_APP})"
"${PG_DUMP_BIN}" "${HEROKU_DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${DUMP_FILE}"

log "Starting Cloud SQL Auth Proxy for ${INSTANCE_CONNECTION_NAME} on localhost:${LOCAL_PROXY_PORT}"
cloud-sql-proxy --port "${LOCAL_PROXY_PORT}" "${INSTANCE_CONNECTION_NAME}" >"${PROXY_LOG}" 2>&1 &
PROXY_PID=$!

for _ in {1..30}; do
  if pg_isready -h 127.0.0.1 -p "${LOCAL_PROXY_PORT}" -U "${SQL_DB_USER}" -d "${SQL_DB_NAME}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
 done

if ! pg_isready -h 127.0.0.1 -p "${LOCAL_PROXY_PORT}" -U "${SQL_DB_USER}" -d "${SQL_DB_NAME}" >/dev/null 2>&1; then
  cat "${PROXY_LOG}" >&2
  echo "Cloud SQL proxy did not become ready in time" >&2
  exit 1
fi

log "Restoring dump into Cloud SQL database ${SQL_DB_NAME}"
PGPASSWORD="${DB_PASSWORD}" "${PG_RESTORE_BIN}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --host=127.0.0.1 \
  --port="${LOCAL_PROXY_PORT}" \
  --username="${SQL_DB_USER}" \
  --dbname="${SQL_DB_NAME}" \
  "${DUMP_FILE}"

log "Data migration complete. Top table counts in Cloud SQL:"
PGPASSWORD="${DB_PASSWORD}" psql \
  "host=127.0.0.1 port=${LOCAL_PROXY_PORT} user=${SQL_DB_USER} dbname=${SQL_DB_NAME}" \
  -c "SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::bigint AS row_count FROM (SELECT table_name, query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') AS xml_count FROM information_schema.tables WHERE table_schema='public') t ORDER BY row_count DESC LIMIT 20;"
