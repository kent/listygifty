#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
ASC_KEY_ID="${ASC_KEY_ID:-2XG664G4GG}"

require_secret() {
  local name="$1"
  local purpose="$2"

  if [ -z "${!name:-}" ]; then
    echo "::error title=Missing mobile release secret::${name} is required for ${purpose}."
    exit 1
  fi
}

write_p8_file() {
  local name="$1"
  local path="$2"
  local value="${!name:-}"

  if [ -z "${value}" ]; then
    return 0
  fi

  mkdir -p "$(dirname "${path}")"

  if printf '%s' "${value}" | base64 --decode >"${path}" 2>/dev/null; then
    :
  else
    printf '%b' "${value}" >"${path}"
  fi

  chmod 600 "${path}"
}

if [ "${MOBILE_STORE_RELEASE:-false}" = "true" ]; then
  require_secret "EXPO_TOKEN" "EAS build and TestFlight submission"
  require_secret "APP_STORE_CONNECT_API_KEY_P8" "TestFlight submission"
fi

if [ "${MOBILE_APP_STORE_REVIEW:-false}" = "true" ]; then
  require_secret "APP_STORE_CONNECT_API_KEY_P8" "App Store review promotion"
fi

write_p8_file "APP_STORE_CONNECT_API_KEY_P8" "${MOBILE_DIR}/AuthKey_${ASC_KEY_ID}.p8"

if [ -n "${APP_STORE_CONNECT_API_KEY_P8:-}" ] && [ ! -s "${MOBILE_DIR}/AuthKey_${ASC_KEY_ID}.p8" ]; then
  echo "::error title=Invalid App Store Connect key::APP_STORE_CONNECT_API_KEY_P8 produced an empty file."
  exit 1
fi

echo "Mobile release credentials prepared."
