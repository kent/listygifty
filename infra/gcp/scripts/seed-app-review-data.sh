#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=infra/gcp/scripts/lib.sh
source "${SCRIPT_DIR}/lib.sh"

require_cmd gcloud

PROJECT_ID="${PROJECT_ID:-listygifty}"
REGION="${REGION:-us-central1}"
TARGET="${TARGET:-all}"

run_seed_job() {
  local environment="$1"
  local job_name

  if [[ "${environment}" == "production" ]]; then
    job_name="niftygifty-api-migrate"
  else
    job_name="niftygifty-staging-api-migrate"
  fi

  log "Seeding app review data for ${environment} via job ${job_name}"
  gcloud run jobs execute "${job_name}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --wait \
    --args="exec,rails,runner,db/seeds/app_review_data.rb"
}

case "${TARGET}" in
  all)
    run_seed_job "staging"
    run_seed_job "production"
    ;;
  staging|production)
    run_seed_job "${TARGET}"
    ;;
  *)
    echo "TARGET must be one of: all, staging, production (got: ${TARGET})" >&2
    exit 1
    ;;
esac

log "App review seed complete for TARGET=${TARGET}"
