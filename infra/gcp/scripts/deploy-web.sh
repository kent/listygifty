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
  default_api_service="niftygifty-api"
  default_web_service="niftygifty-web"
  default_runtime_sa_name="niftygifty-runner"
  default_app_url="https://listygifty.com"
  default_api_url="https://api.listygifty.com"
else
  default_api_service="niftygifty${ENV_SUFFIX}-api"
  default_web_service="niftygifty${ENV_SUFFIX}-web"
  default_runtime_sa_name="niftygifty${ENV_SUFFIX}-runner"
  default_app_url="https://staging.listygifty.com"
  default_api_url="https://api${ENV_SUFFIX}.listygifty.com"
fi

PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-east1}"
ARTIFACT_REGION="${ARTIFACT_REGION:-${REGION}}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-niftygifty}"
API_SERVICE="${API_SERVICE:-${default_api_service}}"
WEB_SERVICE="${WEB_SERVICE:-${default_web_service}}"
RUNTIME_SERVICE_ACCOUNT_NAME="${RUNTIME_SERVICE_ACCOUNT_NAME:-${default_runtime_sa_name}}"
RUNTIME_SERVICE_ACCOUNT_EMAIL="${RUNTIME_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-${default_app_url}}"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="${NEXT_PUBLIC_CLERK_SIGN_IN_URL:-/login}"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="${NEXT_PUBLIC_CLERK_SIGN_UP_URL:-/signup}"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="${NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:-/dashboard}"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="${NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:-/dashboard}"
NEXT_PUBLIC_POSTHOG_KEY="${NEXT_PUBLIC_POSTHOG_KEY:-}"
NEXT_PUBLIC_POSTHOG_HOST="${NEXT_PUBLIC_POSTHOG_HOST:-}"
HEROKU_SECRET_BINDINGS_FILE="${HEROKU_SECRET_BINDINGS_FILE:-${ROOT_DIR}/.gcp/heroku-secret-bindings-${ENVIRONMENT}.env}"

SECRET_CLERK_SECRET_KEY="${SECRET_CLERK_SECRET_KEY:-${SECRET_PREFIX}clerk-secret-key}"
SECRET_CLERK_PUBLISHABLE_KEY="${SECRET_CLERK_PUBLISHABLE_KEY:-${SECRET_PREFIX}clerk-publishable-key}"

if [[ -n "${NEXT_PUBLIC_API_URL:-}" ]]; then
  resolved_api_url="${NEXT_PUBLIC_API_URL}"
else
  resolved_api_url="$(gcloud run services describe "${API_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
  if [[ -z "${resolved_api_url}" ]]; then
    resolved_api_url="${default_api_url}"
  fi
fi

if [[ -n "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]]; then
  resolved_publishable_key="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}"
else
  resolved_publishable_key="$(gcloud secrets versions access latest --project="${PROJECT_ID}" --secret="${SECRET_CLERK_PUBLISHABLE_KEY}" 2>/dev/null || true)"
fi

if [[ -z "${resolved_publishable_key}" ]]; then
  echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required. Set env var or sync secret ${SECRET_CLERK_PUBLISHABLE_KEY}." >&2
  exit 1
fi

if ! gcloud secrets describe "${SECRET_CLERK_SECRET_KEY}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Missing required secret: ${SECRET_CLERK_SECRET_KEY}" >&2
  exit 1
fi

secret_bindings_contains_key() {
  local bindings="$1"
  local key="$2"
  [[ ",${bindings}," == *",${key}="* ]]
}

skip_extra_web_binding_key() {
  local key="$1"
  case "${key}" in
    CLERK_SECRET_KEY|DATABASE_URL|RAILS_MASTER_KEY|POSTMARK_API_TOKEN|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|OPENAI_API_KEY|POSTHOG_API_KEY)
      return 0
      ;;
    NODE_ENV|NEXT_TELEMETRY_DISABLED|RAILS_ENV|RACK_ENV|RAILS_LOG_LEVEL|CLERK_SKIP_RAILTIE|APP_DOMAIN|FRONTEND_URL|ALLOWED_HOSTS|CORS_ORIGINS|SOLID_QUEUE_IN_PUMA|RAILS_MAX_THREADS|JOB_CONCURRENCY)
      return 0
      ;;
    NEXT_PUBLIC_*)
      return 0
      ;;
  esac

  return 1
}

SECRET_BINDINGS="CLERK_SECRET_KEY=${SECRET_CLERK_SECRET_KEY}:latest"

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

    if skip_extra_web_binding_key "${key}"; then
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
IMAGE_URI="${ARTIFACT_REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/web:${IMAGE_TAG}"

log "Deploying web for ENVIRONMENT=${ENVIRONMENT} using service=${WEB_SERVICE}"
log "Building web image ${IMAGE_URI}"
SUBSTITUTIONS="_IMAGE=${IMAGE_URI},_NEXT_PUBLIC_API_URL=${resolved_api_url},_NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL},_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${resolved_publishable_key},_NEXT_PUBLIC_CLERK_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_URL},_NEXT_PUBLIC_CLERK_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_URL},_NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL},_NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL},_NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY},_NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}"

gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config="infra/gcp/cloudbuild.web.yaml" \
  --substitutions="${SUBSTITUTIONS}" \
  .

ENV_FILE="$(mktemp)"
trap 'rm -f "${ENV_FILE}"' EXIT

cat >"${ENV_FILE}" <<ENVVARS
NODE_ENV: "production"
NEXT_TELEMETRY_DISABLED: "1"
NEXT_PUBLIC_API_URL: "${resolved_api_url}"
NEXT_PUBLIC_APP_URL: "${NEXT_PUBLIC_APP_URL}"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "${resolved_publishable_key}"
NEXT_PUBLIC_CLERK_SIGN_IN_URL: "${NEXT_PUBLIC_CLERK_SIGN_IN_URL}"
NEXT_PUBLIC_CLERK_SIGN_UP_URL: "${NEXT_PUBLIC_CLERK_SIGN_UP_URL}"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "${NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL}"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "${NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL}"
NEXT_PUBLIC_POSTHOG_KEY: "${NEXT_PUBLIC_POSTHOG_KEY}"
NEXT_PUBLIC_POSTHOG_HOST: "${NEXT_PUBLIC_POSTHOG_HOST}"
ENVVARS

log "Deploying Cloud Run service ${WEB_SERVICE}"
gcloud run deploy "${WEB_SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --image="${IMAGE_URI}" \
  --service-account="${RUNTIME_SERVICE_ACCOUNT_EMAIL}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=300 \
  --min-instances="${WEB_MIN_INSTANCES:-0}" \
  --max-instances="${WEB_MAX_INSTANCES:-20}" \
  --env-vars-file="${ENV_FILE}" \
  --set-secrets="${SECRET_BINDINGS}" >/dev/null

WEB_URL="$(gcloud run services describe "${WEB_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
log "Web deployed: ${WEB_URL}"
