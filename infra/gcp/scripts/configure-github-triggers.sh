#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud
require_cmd jq

PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-central1}"
TRIGGER_REGION="${TRIGGER_REGION:-${REGION}}"
CONNECTION_NAME="${CONNECTION_NAME:-niftygfity-github}"
REPOSITORY_NAME="${REPOSITORY_NAME:-niftygfity}"
REPOSITORY_REMOTE_URI="${REPOSITORY_REMOTE_URI:-https://github.com/kent/niftygfity}"
DEPLOY_CONFIG="${DEPLOY_CONFIG:-infra/gcp/cloudbuild.deploy.yaml}"
DEPLOY_REGION="${DEPLOY_REGION:-us-central1}"

PROJECT_NUMBER="$(project_number "${PROJECT_ID}")"
CLOUD_BUILD_SA="projects/${PROJECT_ID}/serviceAccounts/${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
REPOSITORY_RESOURCE="projects/${PROJECT_ID}/locations/${REGION}/connections/${CONNECTION_NAME}/repositories/${REPOSITORY_NAME}"

STAGING_TRIGGER_NAME="${STAGING_TRIGGER_NAME:-niftygfity-deploy-staging}"
PRODUCTION_TRIGGER_NAME="${PRODUCTION_TRIGGER_NAME:-niftygfity-deploy-production}"

ensure_repository() {
  if gcloud builds repositories describe "${REPOSITORY_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --connection="${CONNECTION_NAME}" >/dev/null 2>&1; then
    log "Using existing repository mapping ${REPOSITORY_RESOURCE}"
    return
  fi

  log "Creating repository mapping ${REPOSITORY_RESOURCE}"
  gcloud builds repositories create "${REPOSITORY_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --connection="${CONNECTION_NAME}" \
    --remote-uri="${REPOSITORY_REMOTE_URI}" >/dev/null
}

upsert_trigger() {
  local name="$1"
  local description="$2"
  local branch_pattern="$3"
  local environment="$4"
  local bindings_file="$5"

  local existing_id
  existing_id="$(gcloud builds triggers list \
    --project="${PROJECT_ID}" \
    --region="${TRIGGER_REGION}" \
    --format='json' \
    | jq -r --arg NAME "${name}" '.[] | select(.name==$NAME) | .id' \
    | head -n 1)"

  if [[ -n "${existing_id}" ]]; then
    log "Updating trigger ${name} (${existing_id})"
    gcloud builds triggers update github "${existing_id}" \
      --project="${PROJECT_ID}" \
      --region="${TRIGGER_REGION}" \
      --name="${name}" \
      --description="${description}" \
      --repository="${REPOSITORY_RESOURCE}" \
      --branch-pattern="${branch_pattern}" \
      --build-config="${DEPLOY_CONFIG}" \
      --service-account="${CLOUD_BUILD_SA}" \
      --update-substitutions="_ENVIRONMENT=${environment},_REGION=${DEPLOY_REGION},_BINDINGS_FILE=${bindings_file}" >/dev/null
  else
    log "Creating trigger ${name}"
    gcloud builds triggers create github \
      --project="${PROJECT_ID}" \
      --region="${TRIGGER_REGION}" \
      --name="${name}" \
      --description="${description}" \
      --repository="${REPOSITORY_RESOURCE}" \
      --branch-pattern="${branch_pattern}" \
      --build-config="${DEPLOY_CONFIG}" \
      --service-account="${CLOUD_BUILD_SA}" \
      --substitutions="_ENVIRONMENT=${environment},_REGION=${DEPLOY_REGION},_BINDINGS_FILE=${bindings_file}" >/dev/null
  fi
}

connection_stage="$(gcloud builds connections describe "${CONNECTION_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(installationState.stage)' 2>/dev/null || true)"

if [[ -z "${connection_stage}" ]]; then
  cat >&2 <<EOF
Connection ${CONNECTION_NAME} not found in ${PROJECT_ID}/${REGION}.
Create it with:
  gcloud builds connections create github ${CONNECTION_NAME} --project=${PROJECT_ID} --region=${REGION}
Then complete the OAuth/App installation flow and rerun this script.
EOF
  exit 1
fi

if [[ "${connection_stage}" != "COMPLETE" ]]; then
  action_uri="$(gcloud builds connections describe "${CONNECTION_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(installationState.actionUri)' 2>/dev/null || true)"
  message="$(gcloud builds connections describe "${CONNECTION_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(installationState.message)' 2>/dev/null || true)"

  cat >&2 <<EOF
Connection ${CONNECTION_NAME} is not ready (stage=${connection_stage}).
${message}
Action URI:
${action_uri}
After completing the connection setup, rerun this script.
EOF
  exit 1
fi

ensure_repository

upsert_trigger \
  "${STAGING_TRIGGER_NAME}" \
  "Deploy staging on pushes to staging branch" \
  "^staging$" \
  "staging" \
  "infra/gcp/secret-bindings.staging.env"

upsert_trigger \
  "${PRODUCTION_TRIGGER_NAME}" \
  "Deploy production on pushes to main branch" \
  "^main$" \
  "production" \
  "infra/gcp/secret-bindings.production.env"

log "Cloud Build GitHub triggers configured successfully"
gcloud builds triggers list \
  --project="${PROJECT_ID}" \
  --region="${TRIGGER_REGION}" \
  --format='table(name,id,disabled,repositoryEventConfig.repository,repositoryEventConfig.push.branch,substitutions)'
