#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud
require_cmd curl
require_cmd npm

PROFILE_FILE="${PROFILE_FILE:-${ROOT_DIR}/.gcp/listygifty-deploy.env}"
SKIP_TESTS="${SKIP_TESTS:-0}"
PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-central1}"
STAGING_BINDINGS_FILE="${STAGING_BINDINGS_FILE:-${ROOT_DIR}/infra/gcp/secret-bindings.staging.env}"
PRODUCTION_BINDINGS_FILE="${PRODUCTION_BINDINGS_FILE:-${ROOT_DIR}/infra/gcp/secret-bindings.production.env}"

if [[ -f "${PROFILE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${PROFILE_FILE}"
  log "Loaded deploy profile: ${PROFILE_FILE}"
else
  warn "Deploy profile not found at ${PROFILE_FILE}. Using current shell credentials."
fi

if [[ ! -f "${STAGING_BINDINGS_FILE}" ]]; then
  echo "Missing staging bindings file: ${STAGING_BINDINGS_FILE}" >&2
  exit 1
fi

if [[ ! -f "${PRODUCTION_BINDINGS_FILE}" ]]; then
  echo "Missing production bindings file: ${PRODUCTION_BINDINGS_FILE}" >&2
  exit 1
fi

check_http_status() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl -sS -o "${body_file}" -w '%{http_code}' "${url}")"

  if [[ "${status}" != "${expected}" ]]; then
    echo "Smoke check failed: ${label} expected ${expected}, got ${status}" >&2
    echo "URL: ${url}" >&2
    head -c 400 "${body_file}" >&2
    echo >&2
    rm -f "${body_file}"
    exit 1
  fi

  log "Smoke check passed: ${label} (${status})"
  rm -f "${body_file}"
}

check_api_cors() {
  local environment="$1"
  local api_url="$2"
  local web_url="$3"
  local headers_file
  headers_file="$(mktemp)"

  curl -sS -D "${headers_file}" -o /dev/null \
    -X OPTIONS "${api_url}/holidays" \
    -H "Origin: ${web_url}" \
    -H "Access-Control-Request-Method: GET"

  if ! tr -d '\r' < "${headers_file}" | grep -Eiq "^access-control-allow-origin: ${web_url}$"; then
    echo "Smoke check failed: ${environment} API CORS does not allow ${web_url}" >&2
    cat "${headers_file}" >&2
    rm -f "${headers_file}"
    exit 1
  fi

  log "Smoke check passed: ${environment} API CORS allows ${web_url}"
  rm -f "${headers_file}"
}

run_local_tests() {
  if [[ "${SKIP_TESTS}" == "1" ]]; then
    warn "SKIP_TESTS=1 set. Skipping local API/web tests."
    return
  fi

  log "Running API tests"
  (cd "${ROOT_DIR}/apps/api" && bin/rails test)

  log "Running web production build"
  (cd "${ROOT_DIR}/apps/web" && npm run build)
}

deploy_environment() {
  local environment="$1"
  local bindings_file="$2"

  log "Deploying API (${environment})"
  ENVIRONMENT="${environment}" \
  PROJECT_ID="${PROJECT_ID}" \
  REGION="${REGION}" \
  HEROKU_SECRET_BINDINGS_FILE="${bindings_file}" \
  bash "${ROOT_DIR}/infra/gcp/scripts/deploy-api.sh"

  log "Deploying web (${environment})"
  ENVIRONMENT="${environment}" \
  PROJECT_ID="${PROJECT_ID}" \
  REGION="${REGION}" \
  HEROKU_SECRET_BINDINGS_FILE="${bindings_file}" \
  bash "${ROOT_DIR}/infra/gcp/scripts/deploy-web.sh"
}

smoke_environment() {
  local environment="$1"
  local api_service
  local web_service
  local api_url
  local web_url

  if [[ "${environment}" == "production" ]]; then
    api_service="listygifty-api-prod"
    web_service="listygifty-web-prod"
    api_url="https://api.listygifty.com"
    web_url="https://listygifty.com"
  else
    api_service="listygifty-api-staging"
    web_service="listygifty-web-staging"
    api_url="https://staging.api.listygifty.com"
    web_url="https://staging.listygifty.com"
  fi

  gcloud run services describe "${api_service}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' >/dev/null
  gcloud run services describe "${web_service}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' >/dev/null

  log "Running smoke checks (${environment})"
  check_http_status "${environment} API /up" "${api_url}/up" "200"
  check_http_status "${environment} API /holidays (unauthenticated)" "${api_url}/holidays" "401"
  check_http_status "${environment} web /" "${web_url}/" "200"
  check_http_status "${environment} web /login" "${web_url}/login" "200"
  check_api_cors "${environment}" "${api_url}" "${web_url}"
}

log "Starting release pipeline for project=${PROJECT_ID} region=${REGION}"
run_local_tests

deploy_environment "staging" "${STAGING_BINDINGS_FILE}"
smoke_environment "staging"

deploy_environment "production" "${PRODUCTION_BINDINGS_FILE}"
smoke_environment "production"

log "Release pipeline completed successfully."
