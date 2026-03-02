#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud

PROFILE_NAME="${PROFILE_NAME:-listygifty-deploy}"
COMPAT_PROFILE_NAME="${COMPAT_PROFILE_NAME:-listygifty}"
PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-central1}"
ACCOUNT_EMAIL="${ACCOUNT_EMAIL:-kent.fenwick@gmail.com}"
DEPLOYER_SERVICE_ACCOUNT="${DEPLOYER_SERVICE_ACCOUNT:-niftygifty-deployer@${PROJECT_ID}.iam.gserviceaccount.com}"
SYNC_COMPAT_PROFILE="${SYNC_COMPAT_PROFILE:-1}"
PROFILE_FILE="${PROFILE_FILE:-${ROOT_DIR}/.gcp/listygifty-deploy.env}"

configure_profile() {
  local profile="$1"

  if ! gcloud config configurations describe "${profile}" >/dev/null 2>&1; then
    log "Creating gcloud configuration: ${profile}"
    gcloud config configurations create "${profile}" --no-activate >/dev/null
  fi

  gcloud config configurations activate "${profile}" >/dev/null
  gcloud config set core/account "${ACCOUNT_EMAIL}" >/dev/null
  gcloud config set core/project "${PROJECT_ID}" >/dev/null
  gcloud config set compute/region "${REGION}" >/dev/null
  gcloud config set run/region "${REGION}" >/dev/null
  gcloud config set auth/impersonate_service_account "${DEPLOYER_SERVICE_ACCOUNT}" >/dev/null
}

mkdir -p "$(dirname "${PROFILE_FILE}")"

log "Configuring deploy profile '${PROFILE_NAME}'"
configure_profile "${PROFILE_NAME}"

if [[ "${SYNC_COMPAT_PROFILE}" == "1" ]]; then
  log "Configuring compatibility profile '${COMPAT_PROFILE_NAME}'"
  configure_profile "${COMPAT_PROFILE_NAME}"
fi

log "Validating deployer service account '${DEPLOYER_SERVICE_ACCOUNT}'"
gcloud iam service-accounts describe "${DEPLOYER_SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --format="value(email)" >/dev/null

cat >"${PROFILE_FILE}" <<EOF
export CLOUDSDK_ACTIVE_CONFIG_NAME="${PROFILE_NAME}"
export CLOUDSDK_CORE_ACCOUNT="${ACCOUNT_EMAIL}"
export CLOUDSDK_CORE_PROJECT="${PROJECT_ID}"
export CLOUDSDK_COMPUTE_REGION="${REGION}"
export CLOUDSDK_RUN_REGION="${REGION}"
export CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT="${DEPLOYER_SERVICE_ACCOUNT}"
export PROJECT_ID="${PROJECT_ID}"
export REGION="${REGION}"
export ARTIFACT_REGION="${REGION}"
export ARTIFACT_REPOSITORY="niftygifty"
export DEPLOYER_SERVICE_ACCOUNT="${DEPLOYER_SERVICE_ACCOUNT}"
EOF
chmod 600 "${PROFILE_FILE}"

gcloud config configurations activate "${PROFILE_NAME}" >/dev/null

log "Deploy profile ready."
log "Profile: ${PROFILE_NAME}"
log "Project: ${PROJECT_ID}"
log "Impersonated SA: ${DEPLOYER_SERVICE_ACCOUNT}"
log "Wrote profile env: ${PROFILE_FILE}"
