#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud

ENVIRONMENT="$(resolve_environment "${ENVIRONMENT:-production}")"
ENV_SUFFIX="$(environment_suffix "${ENVIRONMENT}")"
SECRET_PREFIX="${SECRET_PREFIX:-$(default_secret_prefix "${ENVIRONMENT}")}"

if [[ "${ENVIRONMENT}" == "production" ]]; then
  default_api_service="listygifty-api-prod"
  default_web_service="listygifty-web-prod"
  default_migration_job="listygifty-migrate-prod"
  default_runtime_sa_name="niftygifty-runner"
  default_app_domain="listygifty.com"
  default_api_domain="api.listygifty.com"
  default_frontend_url="https://listygifty.com"
  default_cors_public_origins="https://listygifty.com,https://www.listygifty.com"
  default_api_min_instances="1"
  default_api_max_instances="10"
else
  default_api_service="listygifty-api-staging"
  default_web_service="listygifty-web-staging"
  default_migration_job="listygifty-migrate-staging"
  default_runtime_sa_name="niftygifty${ENV_SUFFIX}-runner"
  default_app_domain="staging.listygifty.com"
  default_api_domain="staging.api.listygifty.com"
  default_frontend_url="https://staging.listygifty.com"
  default_cors_public_origins="https://staging.listygifty.com"
  default_api_min_instances="0"
  default_api_max_instances="3"
fi

PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-central1}"
ARTIFACT_REGION="${ARTIFACT_REGION:-${REGION}}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-niftygifty}"
API_SERVICE="${API_SERVICE:-${default_api_service}}"
WEB_SERVICE="${WEB_SERVICE:-${default_web_service}}"
MIGRATION_JOB="${MIGRATION_JOB:-${default_migration_job}}"
SQL_INSTANCE="${SQL_INSTANCE:-niftygifty-postgres-central}"
RUNTIME_SERVICE_ACCOUNT_NAME="${RUNTIME_SERVICE_ACCOUNT_NAME:-${default_runtime_sa_name}}"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

APP_DOMAIN="${APP_DOMAIN:-${default_app_domain}}"
API_DOMAIN="${API_DOMAIN:-${default_api_domain}}"
FRONTEND_URL="${FRONTEND_URL:-${default_frontend_url}}"
RAILS_LOG_LEVEL="${RAILS_LOG_LEVEL:-info}"
RAILS_MAX_THREADS="${RAILS_MAX_THREADS:-3}"
RAILS_MIN_THREADS="${RAILS_MIN_THREADS:-${RAILS_MAX_THREADS}}"
DB_POOL="${DB_POOL:-${RAILS_MAX_THREADS}}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-0}"
PUMA_PERSISTENT_TIMEOUT="${PUMA_PERSISTENT_TIMEOUT:-20}"
RAILS_ENABLE_YJIT="${RAILS_ENABLE_YJIT:-true}"
JOB_CONCURRENCY="${JOB_CONCURRENCY:-1}"
JOB_THREADS="${JOB_THREADS:-1}"
SOLID_QUEUE_IN_PUMA="${SOLID_QUEUE_IN_PUMA:-1}"
API_MIN_INSTANCES="${API_MIN_INSTANCES:-${default_api_min_instances}}"
API_MAX_INSTANCES="${API_MAX_INSTANCES:-${default_api_max_instances}}"
RAILS_ENV="${RAILS_ENV:-production}"
RACK_ENV="${RACK_ENV:-${RAILS_ENV}}"
HEROKU_SECRET_BINDINGS_FILE="${HEROKU_SECRET_BINDINGS_FILE:-${ROOT_DIR}/.gcp/heroku-secret-bindings-${ENVIRONMENT}.env}"

SECRET_DATABASE_URL="${SECRET_DATABASE_URL:-${SECRET_PREFIX}database-url}"
SECRET_RAILS_MASTER_KEY="${SECRET_RAILS_MASTER_KEY:-${SECRET_PREFIX}rails-master-key}"
SECRET_CLERK_SECRET_KEY="${SECRET_CLERK_SECRET_KEY:-${SECRET_PREFIX}clerk-secret-key}"
SECRET_POSTMARK_API_TOKEN="${SECRET_POSTMARK_API_TOKEN:-${SECRET_PREFIX}postmark-api-token}"
SECRET_STRIPE_SECRET_KEY="${SECRET_STRIPE_SECRET_KEY:-${SECRET_PREFIX}stripe-secret-key}"
SECRET_STRIPE_WEBHOOK_SECRET="${SECRET_STRIPE_WEBHOOK_SECRET:-${SECRET_PREFIX}stripe-webhook-secret}"
SECRET_OPENAI_API_KEY="${SECRET_OPENAI_API_KEY:-${SECRET_PREFIX}openai-api-key}"
SECRET_POSTHOG_API_KEY="${SECRET_POSTHOG_API_KEY:-${SECRET_PREFIX}posthog-api-key}"

append_csv_value() {
  local csv="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    printf '%s' "${csv}"
    return
  fi
  if [[ ",${csv}," == *",${value},"* ]]; then
    printf '%s' "${csv}"
  else
    printf '%s,%s' "${csv}" "${value}"
  fi
}

url_to_host() {
  local url="$1"
  printf '%s' "${url#https://}" | sed 's#/.*$##'
}

secret_bindings_contains_key() {
  local bindings="$1"
  local key="$2"
  [[ ",${bindings}," == *",${key}="* ]]
}

skip_extra_api_binding_key() {
  local key="$1"
  case "${key}" in
    DATABASE_URL|RAILS_MASTER_KEY|CLERK_SECRET_KEY|POSTMARK_API_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|OPENAI_API_KEY|POSTHOG_API_KEY)
      return 0
      ;;
    RAILS_ENV|RACK_ENV|RAILS_LOG_LEVEL|CLERK_SKIP_RAILTIE|APP_DOMAIN|FRONTEND_URL|ALLOWED_HOSTS|CORS_ORIGINS|SOLID_QUEUE_IN_PUMA|RAILS_ENABLE_YJIT|RAILS_MIN_THREADS|RAILS_MAX_THREADS|DB_POOL|WEB_CONCURRENCY|PUMA_PERSISTENT_TIMEOUT|JOB_CONCURRENCY|JOB_THREADS)
      return 0
      ;;
    NEXT_PUBLIC_*)
      return 0
      ;;
  esac

  return 1
}

PROJECT_NUMBER="$(project_number "${PROJECT_ID}")"
predicted_api_host="${API_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
predicted_web_origin="https://${WEB_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"

allowed_hosts_default="${API_DOMAIN},${predicted_api_host}"
cors_origins_default="http://localhost:3000,${default_cors_public_origins},${predicted_web_origin}"

existing_api_url="$(gcloud run services describe "${API_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
existing_web_url="$(gcloud run services describe "${WEB_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"

if [[ -n "${existing_api_url}" ]]; then
  allowed_hosts_default="$(append_csv_value "${allowed_hosts_default}" "$(url_to_host "${existing_api_url}")")"
fi

if [[ -n "${existing_web_url}" ]]; then
  cors_origins_default="$(append_csv_value "${cors_origins_default}" "${existing_web_url}")"
fi

ALLOWED_HOSTS="${ALLOWED_HOSTS:-${allowed_hosts_default}}"
CORS_ORIGINS="${CORS_ORIGINS:-${cors_origins_default}}"

STAMP="$(date +%Y%m%d%H%M%S)"

resolve_revision_tag() {
  if command -v git >/dev/null 2>&1 && git rev-parse --short=12 HEAD >/dev/null 2>&1; then
    git rev-parse --short=12 HEAD
    return
  fi

  if [[ -n "${SHORT_SHA:-}" ]]; then
    printf '%s' "${SHORT_SHA}" | cut -c1-12
    return
  fi

  if [[ -n "${COMMIT_SHA:-}" ]]; then
    printf '%s' "${COMMIT_SHA}" | cut -c1-12
    return
  fi

  printf 'manual'
}

REVISION_TAG="$(resolve_revision_tag)"
IMAGE_TAG="${IMAGE_TAG:-${STAMP}-${REVISION_TAG}}"
IMAGE_URI="${ARTIFACT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/api:${IMAGE_TAG}"
INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "${SQL_INSTANCE}" --project="${PROJECT_ID}" --format='value(connectionName)')"

required_secrets=(
  "${SECRET_DATABASE_URL}"
  "${SECRET_RAILS_MASTER_KEY}"
  "${SECRET_CLERK_SECRET_KEY}"
  "${SECRET_POSTMARK_API_TOKEN}"
  "${SECRET_STRIPE_SECRET_KEY}"
  "${SECRET_STRIPE_WEBHOOK_SECRET}"
  "${SECRET_OPENAI_API_KEY}"
)

for secret_name in "${required_secrets[@]}"; do
  if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Missing required secret: ${secret_name}" >&2
    exit 1
  fi
done

optional_secret_binding=""
if gcloud secrets describe "${SECRET_POSTHOG_API_KEY}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  optional_secret_binding=",POSTHOG_API_KEY=${SECRET_POSTHOG_API_KEY}:latest"
fi

SECRET_BINDINGS="DATABASE_URL=${SECRET_DATABASE_URL}:latest,RAILS_MASTER_KEY=${SECRET_RAILS_MASTER_KEY}:latest,CLERK_SECRET_KEY=${SECRET_CLERK_SECRET_KEY}:latest,POSTMARK_API_TOKEN=${SECRET_POSTMARK_API_TOKEN}:latest,STRIPE_SECRET_KEY=${SECRET_STRIPE_SECRET_KEY}:latest,STRIPE_WEBHOOK_SECRET=${SECRET_STRIPE_WEBHOOK_SECRET}:latest,OPENAI_API_KEY=${SECRET_OPENAI_API_KEY}:latest${optional_secret_binding}"

if [[ -f "${HEROKU_SECRET_BINDINGS_FILE}" ]]; then
  while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
    line="$(printf '%s' "${raw_line}" | sed 's/#.*$//; s/^[[:space:]]*//; s/[[:space:]]*$//')"
    if [[ -z "${line}" ]]; then
      continue
    fi

    if [[ "${line}" != *=* ]]; then
      warn "Skipping malformed line in ${HEROKU_SECRET_BINDINGS_FILE}: ${line}"
      continue
    fi

    key="${line%%=*}"
    secret_name="${line#*=}"

    if skip_extra_api_binding_key "${key}"; then
      continue
    fi

    if secret_bindings_contains_key "${SECRET_BINDINGS}" "${key}"; then
      continue
    fi

    if ! gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
      warn "Secret ${secret_name} for ${key} not found in project ${PROJECT_ID}; skipping"
      continue
    fi

    SECRET_BINDINGS="${SECRET_BINDINGS},${key}=${secret_name}:latest"
  done <"${HEROKU_SECRET_BINDINGS_FILE}"
else
  warn "Secret bindings file not found: ${HEROKU_SECRET_BINDINGS_FILE}. Run sync-heroku-secrets.sh to migrate all env vars."
fi

ENV_FILE="$(mktemp)"
cat >"${ENV_FILE}" <<ENVVARS
RAILS_ENV: "${RAILS_ENV}"
RACK_ENV: "${RACK_ENV}"
RAILS_LOG_LEVEL: "${RAILS_LOG_LEVEL}"
RAILS_ENABLE_YJIT: "${RAILS_ENABLE_YJIT}"
CLERK_SKIP_RAILTIE: "1"
APP_DOMAIN: "${APP_DOMAIN}"
FRONTEND_URL: "${FRONTEND_URL}"
ALLOWED_HOSTS: "${ALLOWED_HOSTS}"
CORS_ORIGINS: "${CORS_ORIGINS}"
SOLID_QUEUE_IN_PUMA: "${SOLID_QUEUE_IN_PUMA}"
WEB_CONCURRENCY: "${WEB_CONCURRENCY}"
PUMA_PERSISTENT_TIMEOUT: "${PUMA_PERSISTENT_TIMEOUT}"
RAILS_MIN_THREADS: "${RAILS_MIN_THREADS}"
RAILS_MAX_THREADS: "${RAILS_MAX_THREADS}"
DB_POOL: "${DB_POOL}"
JOB_CONCURRENCY: "${JOB_CONCURRENCY}"
JOB_THREADS: "${JOB_THREADS}"
ENVVARS

trap 'rm -f "${ENV_FILE}"' EXIT

log "Deploying API for ENVIRONMENT=${ENVIRONMENT} using service=${API_SERVICE}"
log "Building API image ${IMAGE_URI}"
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  gcloud builds submit \
    --project="${PROJECT_ID}" \
    --config="infra/gcp/cloudbuild.api.yaml" \
    --substitutions="_IMAGE=${IMAGE_URI}" \
    .
else
  log "Skipping image build (SKIP_BUILD=1)"
fi

if gcloud run jobs describe "${MIGRATION_JOB}" --project="${PROJECT_ID}" --region="${REGION}" >/dev/null 2>&1; then
  log "Updating migration job ${MIGRATION_JOB}"
  gcloud run jobs update "${MIGRATION_JOB}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE_URI}" \
    --service-account="${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
    --set-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
    --command="bundle" \
    --args="exec,rails,db:migrate" \
    --task-timeout=900 \
    --max-retries=1 \
    --cpu=1 \
    --memory=1Gi \
    --env-vars-file="${ENV_FILE}" \
    --set-secrets="${SECRET_BINDINGS}" >/dev/null
else
  log "Creating migration job ${MIGRATION_JOB}"
  gcloud run jobs create "${MIGRATION_JOB}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE_URI}" \
    --service-account="${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
    --set-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
    --command="bundle" \
    --args="exec,rails,db:migrate" \
    --task-timeout=900 \
    --max-retries=1 \
    --cpu=1 \
    --memory=1Gi \
    --env-vars-file="${ENV_FILE}" \
    --set-secrets="${SECRET_BINDINGS}" >/dev/null
fi

log "Running database migrations via Cloud Run Job"
gcloud run jobs execute "${MIGRATION_JOB}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --wait >/dev/null

log "Deploying Cloud Run service ${API_SERVICE}"
gcloud run deploy "${API_SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE_URI}" \
  --service-account="${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=80 \
  --timeout=300 \
  --min-instances="${API_MIN_INSTANCES}" \
  --max-instances="${API_MAX_INSTANCES}" \
  --env-vars-file="${ENV_FILE}" \
  --set-secrets="${SECRET_BINDINGS}" >/dev/null

API_URL="$(gcloud run services describe "${API_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
log "API deployed: ${API_URL}"
