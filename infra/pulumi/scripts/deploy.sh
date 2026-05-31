#!/usr/bin/env bash
# Single-command, Pulumi-driven deploy. Everything from image build to mobile
# kickoff lives inside the Pulumi program — this wrapper just computes the
# source SHA, runs `pulumi up`, and prints timing.
#
# Usage: deploy.sh <staging|production>
set -euo pipefail

ENVIRONMENT="${1:-}"
case "${ENVIRONMENT}" in
  staging|production) ;;
  *)
    echo "Usage: $0 <staging|production>" >&2
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PULUMI_DIR="${ROOT_DIR}/infra/pulumi"

log()  { printf '\033[36m[%s]\033[0m %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '\033[33m[%s] WARN:\033[0m %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

require_cmd gcloud
require_cmd pulumi
require_cmd git
require_cmd npm

PROFILE_FILE="${PROFILE_FILE:-${ROOT_DIR}/.gcp/listygifty-deploy.env}"
if [[ -f "${PROFILE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${PROFILE_FILE}"
fi

export PULUMI_CONFIG_PASSPHRASE="${PULUMI_CONFIG_PASSPHRASE-}"
export PULUMI_BACKEND_URL="${PULUMI_BACKEND_URL:-gs://listygifty-pulumi-state}"
if [[ -z "${GOOGLE_OAUTH_ACCESS_TOKEN:-}" ]]; then
  export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
fi
pulumi login "${PULUMI_BACKEND_URL}" >/dev/null

# Source SHA powers image tagging + Pulumi's `triggers` invalidation.
SHA="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)"
WORKTREE_STATUS="$(git -C "${ROOT_DIR}" status --porcelain)"
if [[ -n "${WORKTREE_STATUS}" ]]; then
  if [[ "${ENVIRONMENT}" == "production" && "${ALLOW_DIRTY_DEPLOY:-false}" != "true" ]]; then
    echo "Production deploy requires a clean git worktree. Commit or stash changes, or set ALLOW_DIRTY_DEPLOY=true." >&2
    exit 1
  fi

  SHA="${SHA}-dirty"
fi

START_TS="$(date +%s)"

log "Deploying SHA ${SHA} → ${ENVIRONMENT}"

cd "${PULUMI_DIR}"

# Make sure deps are installed (cheap if already done).
if [[ ! -d node_modules ]]; then
  log "Installing Pulumi deps"
  npm ci --silent
fi

PROJECT="$(pulumi config get gcp:project --stack "${ENVIRONMENT}")"
IMAGE_REGISTRY="$(pulumi config get niftygifty:imageRegistry --stack "${ENVIRONMENT}")"
API_IMAGE_REPO="$(pulumi config get niftygifty:apiImageRepo --stack "${ENVIRONMENT}")"
WEB_IMAGE_REPO="$(pulumi config get niftygifty:webImageRepo --stack "${ENVIRONMENT}")"
APP_DOMAIN="$(pulumi config get niftygifty:appDomain --stack "${ENVIRONMENT}")"
API_DOMAIN="$(pulumi config get niftygifty:apiDomain --stack "${ENVIRONMENT}")"

API_IMAGE="${IMAGE_REGISTRY}/${API_IMAGE_REPO}:${SHA}"
WEB_IMAGE="${IMAGE_REGISTRY}/${WEB_IMAGE_REPO}:${SHA}"
CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-pk_live_Y2xlcmsubGlzdHlnaWZ0eS5jb20k}"

wait_for_cloud_build() {
  local build_id="$1"
  local label="$2"
  local status=""

  if [[ -z "${build_id}" ]]; then
    echo "${label} Cloud Build did not return a build ID." >&2
    return 1
  fi

  log "Waiting for ${label} Cloud Build ${build_id}"
  while true; do
    status="$(gcloud builds describe "${build_id}" --project="${PROJECT}" --format="value(status)")"
    case "${status}" in
      SUCCESS)
        log "${label} Cloud Build ${build_id} succeeded"
        return 0
        ;;
      FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
        echo "${label} Cloud Build ${build_id} failed with status ${status}." >&2
        return 1
        ;;
      *)
        sleep 10
        ;;
    esac
  done
}

build_api_image() {
  log "Building API image ${API_IMAGE}"
  local build_id
  build_id="$(gcloud builds submit "${ROOT_DIR}" \
    --project="${PROJECT}" \
    --async \
    --format="value(id)" \
    --config="${ROOT_DIR}/infra/gcp/cloudbuild.api.yaml" \
    --substitutions="_IMAGE=${API_IMAGE}")"
  wait_for_cloud_build "${build_id}" "API"
}

build_web_image() {
  log "Building web image ${WEB_IMAGE}"
  local build_id
  build_id="$(gcloud builds submit "${ROOT_DIR}" \
    --project="${PROJECT}" \
    --async \
    --format="value(id)" \
    --config="${ROOT_DIR}/infra/gcp/cloudbuild.web.yaml" \
    --substitutions="_IMAGE=${WEB_IMAGE},_NEXT_PUBLIC_API_URL=https://${API_DOMAIN},_NEXT_PUBLIC_APP_URL=https://${APP_DOMAIN},_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY},_NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login,_NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup,_NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard,_NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard,_NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY:-},_NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST:-}")"
  wait_for_cloud_build "${build_id}" "web"
}

log "Building deploy images in Cloud Build"
build_api_image &
API_BUILD_PID=$!
build_web_image &
WEB_BUILD_PID=$!

set +e
wait "${API_BUILD_PID}"
API_BUILD_STATUS=$?
wait "${WEB_BUILD_PID}"
WEB_BUILD_STATUS=$?
set -e

if [[ "${API_BUILD_STATUS}" -ne 0 || "${WEB_BUILD_STATUS}" -ne 0 ]]; then
  echo "Cloud Build failed (api=${API_BUILD_STATUS}, web=${WEB_BUILD_STATUS})" >&2
  exit 1
fi

# Pulumi engine handles parallelism, dependency ordering, and idempotency.
pulumi up \
  --stack "${ENVIRONMENT}" \
  --yes \
  --skip-preview \
  --config "niftygifty:sourceSha=${SHA}"

ENABLE_MOBILE="${ENABLE_MOBILE:-true}"
if [[ "${ENABLE_MOBILE}" == "false" || "${ENABLE_MOBILE}" == "0" ]]; then
  warn "Skipping mobile build because ENABLE_MOBILE=${ENABLE_MOBILE}"
else
  MOBILE_PROFILE="${MOBILE_EAS_PROFILE:-${ENVIRONMENT}}"
  [[ "${ENVIRONMENT}" == "production" ]] && MOBILE_PROFILE="${MOBILE_EAS_PROFILE:-production}"

  if [[ -n "${APP_STORE_CONNECT_API_KEY_P8:-}" ]]; then
    log "Preparing App Store Connect key for EAS submit"
    MOBILE_STORE_RELEASE=true ASC_KEY_ID="${ASC_KEY_ID:-2XG664G4GG}" \
      bash "${ROOT_DIR}/scripts/ci/prepare-mobile-release-secrets.sh"
  fi

  log "Queueing iOS EAS build (${MOBILE_PROFILE})"
  (
    cd "${ROOT_DIR}/apps/mobile"
    npx --yes eas-cli build \
      --profile "${MOBILE_PROFILE}" \
      --platform ios \
      --auto-submit \
      --non-interactive \
      --no-wait \
      --message "${SHA}"
  )
fi

ELAPSED=$(($(date +%s) - START_TS))

API_URL="$(pulumi stack output apiUrl --stack "${ENVIRONMENT}" 2>/dev/null || true)"
WEB_URL="$(pulumi stack output webUrl --stack "${ENVIRONMENT}" 2>/dev/null || true)"

printf '\n\033[1m✓ %s deployed in %ds\033[0m\n' "${ENVIRONMENT}" "${ELAPSED}"
[[ -n "${API_URL}" ]] && printf '  API:    %s\n' "${API_URL}"
[[ -n "${WEB_URL}" ]] && printf '  Web:    %s\n' "${WEB_URL}"
printf '  SHA:    %s\n' "${SHA}"
if [[ "${ENABLE_MOBILE}" == "false" || "${ENABLE_MOBILE}" == "0" ]]; then
  printf '  Mobile: skipped\n'
else
  printf '  Mobile: EAS build dispatched — `cd apps/mobile && eas build:list`\n'
fi
