#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
  printf '[%s] WARNING: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$cmd" >&2
    exit 1
  fi
}

upsert_secret() {
  local project_id="$1"
  local secret_name="$2"
  local secret_value="$3"

  if gcloud secrets describe "$secret_name" --project="$project_id" >/dev/null 2>&1; then
    printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" --project="$project_id" --data-file=- >/dev/null
  else
    printf '%s' "$secret_value" | gcloud secrets create "$secret_name" --project="$project_id" --replication-policy=automatic --data-file=- >/dev/null
  fi
}

project_number() {
  local project_id="$1"
  gcloud projects describe "$project_id" --format='value(projectNumber)'
}

resolve_environment() {
  local environment="${1:-production}"
  case "${environment}" in
    production|staging)
      ;;
    *)
      echo "ENVIRONMENT must be one of: production, staging (got: ${environment})" >&2
      exit 1
      ;;
  esac

  printf '%s' "${environment}"
}

environment_suffix() {
  local environment
  environment="$(resolve_environment "${1:-${ENVIRONMENT:-production}}")"

  if [[ "${environment}" == "production" ]]; then
    printf ''
  else
    printf -- '-%s' "${environment}"
  fi
}

environment_db_suffix() {
  local environment
  environment="$(resolve_environment "${1:-${ENVIRONMENT:-production}}")"
  printf '_%s' "${environment}"
}

default_secret_prefix() {
  local environment
  environment="$(resolve_environment "${1:-${ENVIRONMENT:-production}}")"
  if [[ "${environment}" == "production" ]]; then
    printf 'niftygifty-'
  else
    printf 'niftygifty-%s-' "${environment}"
  fi
}

normalize_secret_token() {
  local raw="$1"
  printf '%s' "${raw}" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//'
}

env_var_to_secret_name() {
  local env_var="$1"
  local secret_prefix="$2"
  local token
  token="$(normalize_secret_token "${env_var}")"

  if [[ -z "${token}" ]]; then
    echo "Could not derive secret name for env var: ${env_var}" >&2
    exit 1
  fi

  printf '%s%s' "${secret_prefix}" "${token}"
}

resolve_heroku_app() {
  local environment
  environment="$(resolve_environment "${1:-${ENVIRONMENT:-production}}")"

  if [[ -n "${HEROKU_APP:-}" ]]; then
    printf '%s' "${HEROKU_APP}"
    return
  fi

  if [[ "${environment}" == "production" && -n "${HEROKU_APP_PRODUCTION:-}" ]]; then
    printf '%s' "${HEROKU_APP_PRODUCTION}"
    return
  fi

  if [[ "${environment}" == "staging" && -n "${HEROKU_APP_STAGING:-}" ]]; then
    printf '%s' "${HEROKU_APP_STAGING}"
    return
  fi

  printf ''
}
