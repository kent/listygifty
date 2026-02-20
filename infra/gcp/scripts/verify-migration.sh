#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud
require_cmd heroku
require_cmd psql
require_cmd cloud-sql-proxy

ENVIRONMENT="$(resolve_environment "${ENVIRONMENT:-production}")"
SECRET_PREFIX="${SECRET_PREFIX:-$(default_secret_prefix "${ENVIRONMENT}")}"

PROJECT_ID="${PROJECT_ID:-listygifty}"
HEROKU_APP="${HEROKU_APP:-$(resolve_heroku_app "${ENVIRONMENT}")}"
SQL_INSTANCE="${SQL_INSTANCE:-niftygifty-postgres}"
SQL_DB_NAME="${SQL_DB_NAME:-niftygifty_$(resolve_environment "${ENVIRONMENT}")}"
if [[ "${ENVIRONMENT}" == "production" ]]; then
  default_sql_db_user="niftygifty"
else
  default_sql_db_user="niftygifty_${ENVIRONMENT}"
fi
SQL_DB_USER="${SQL_DB_USER:-${default_sql_db_user}}"
SECRET_DB_PASSWORD="${SECRET_DB_PASSWORD:-${SECRET_PREFIX}db-password}"
LOCAL_PROXY_PORT="${LOCAL_PROXY_PORT:-5433}"

if [[ -z "${HEROKU_APP}" ]]; then
  echo "HEROKU_APP must be set (for example: export HEROKU_APP=your-heroku-app). You can also set HEROKU_APP_PRODUCTION or HEROKU_APP_STAGING." >&2
  exit 1
fi

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(connectionName)')"
DB_PASSWORD="$(gcloud secrets versions access latest --project="${PROJECT_ID}" --secret="${SECRET_DB_PASSWORD}")"
HEROKU_DATABASE_URL="$(heroku config:get DATABASE_URL -a "${HEROKU_APP}")"

TMP_DIR="$(mktemp -d)"
HEROKU_COUNTS="${TMP_DIR}/heroku_counts.txt"
CLOUDSQL_COUNTS="${TMP_DIR}/cloudsql_counts.txt"
PROXY_LOG="${TMP_DIR}/proxy.log"

cleanup() {
  if [[ -n "${PROXY_PID:-}" ]] && kill -0 "${PROXY_PID}" >/dev/null 2>&1; then
    kill "${PROXY_PID}" >/dev/null 2>&1 || true
    wait "${PROXY_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

COUNT_SQL="SELECT table_name || '|' || (xpath('/row/cnt/text()', xml_count))[1]::text FROM (SELECT table_name, query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') AS xml_count FROM information_schema.tables WHERE table_schema='public' AND table_name NOT LIKE 'pg_stat_statements%') t ORDER BY table_name;"

log "Collecting table counts from Heroku"
psql "${HEROKU_DATABASE_URL}" -At -c "${COUNT_SQL}" >"${HEROKU_COUNTS}"

log "Starting Cloud SQL Auth Proxy"
cloud-sql-proxy --port "${LOCAL_PROXY_PORT}" "${INSTANCE_CONNECTION_NAME}" >"${PROXY_LOG}" 2>&1 &
PROXY_PID=$!

for _ in {1..30}; do
  if psql "host=127.0.0.1 port=${LOCAL_PROXY_PORT} user=${SQL_DB_USER} dbname=${SQL_DB_NAME} password=${DB_PASSWORD}" -c 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! psql "host=127.0.0.1 port=${LOCAL_PROXY_PORT} user=${SQL_DB_USER} dbname=${SQL_DB_NAME} password=${DB_PASSWORD}" -c 'SELECT 1' >/dev/null 2>&1; then
  cat "${PROXY_LOG}" >&2
  echo "Cloud SQL proxy did not become ready" >&2
  exit 1
fi

log "Collecting table counts from Cloud SQL"
psql "host=127.0.0.1 port=${LOCAL_PROXY_PORT} user=${SQL_DB_USER} dbname=${SQL_DB_NAME} password=${DB_PASSWORD}" -At -c "${COUNT_SQL}" >"${CLOUDSQL_COUNTS}"

log "Diff (empty output means match):"
diff -u "${HEROKU_COUNTS}" "${CLOUDSQL_COUNTS}" || true

log "Verification complete"
