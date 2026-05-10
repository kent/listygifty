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

PROFILE_FILE="${PROFILE_FILE:-${ROOT_DIR}/.gcp/listygifty-deploy.env}"
if [[ -f "${PROFILE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${PROFILE_FILE}"
fi

# Source SHA powers image tagging + Pulumi's `triggers` invalidation.
SHA="$(git -C "${ROOT_DIR}" rev-parse --short=12 HEAD)"
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain)" ]]; then
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

# Pulumi engine handles parallelism, dependency ordering, and idempotency.
pulumi up \
  --stack "${ENVIRONMENT}" \
  --yes \
  --skip-preview \
  --config "niftygifty:sourceSha=${SHA}"

ELAPSED=$(($(date +%s) - START_TS))

API_URL="$(pulumi stack output apiUrl --stack "${ENVIRONMENT}" 2>/dev/null || true)"
WEB_URL="$(pulumi stack output webUrl --stack "${ENVIRONMENT}" 2>/dev/null || true)"

printf '\n\033[1m✓ %s deployed in %ds\033[0m\n' "${ENVIRONMENT}" "${ELAPSED}"
[[ -n "${API_URL}" ]] && printf '  API:    %s\n' "${API_URL}"
[[ -n "${WEB_URL}" ]] && printf '  Web:    %s\n' "${WEB_URL}"
printf '  SHA:    %s\n' "${SHA}"
printf '  Mobile: EAS build dispatched — \`cd apps/mobile && eas build:list\`\n'
