#!/usr/bin/env bash
set -euo pipefail

API_HOST="${API_HOST:-api.listygifty.com}"
WEB_HOST="${WEB_HOST:-listygifty.com}"
WWW_HOST="${WWW_HOST:-www.listygifty.com}"

API_V4="${API_V4:-66.241.124.251}"
API_V6="${API_V6:-2a09:8280:1::11f:178a:0}"
WEB_V4="${WEB_V4:-66.241.124.125}"
WEB_V6="${WEB_V6:-2a09:8280:1::11f:178e:0}"

PASS=0
FAIL=0

record_values() {
  local host="$1"
  local type="$2"
  dig +short "$host" "$type" | sed 's/\.$//' | sort -u
}

check_dns_exact() {
  local name="$1"
  local host="$2"
  local type="$3"
  local expected="$4"
  local values

  values="$(record_values "$host" "$type" | tr '\n' ' ' | sed 's/ $//')"
  if [ "$values" = "$expected" ]; then
    echo "PASS $name DNS $type -> $expected"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name DNS $type: expected only '$expected', got '${values:-<none>}'"
    FAIL=$((FAIL + 1))
  fi
}

check_http() {
  local name="$1"
  local url="$2"
  local want="$3"
  local code

  code="$(curl -L -sS -o /dev/null -w "%{http_code}" --max-time 20 "$url" || echo 000)"
  if [ "$code" = "$want" ]; then
    echo "PASS $name ($code)"
    PASS=$((PASS + 1))
  else
    echo "FAIL $name: expected $want got $code"
    FAIL=$((FAIL + 1))
  fi
}

check_dns_exact "API" "$API_HOST" A "$API_V4"
check_dns_exact "API" "$API_HOST" AAAA "$API_V6"
check_dns_exact "web apex" "$WEB_HOST" A "$WEB_V4"
check_dns_exact "web apex" "$WEB_HOST" AAAA "$WEB_V6"
check_dns_exact "web www" "$WWW_HOST" A "$WEB_V4"
check_dns_exact "web www" "$WWW_HOST" AAAA "$WEB_V6"

check_http "API /up" "https://$API_HOST/up" 200
check_http "API /holidays" "https://$API_HOST/holidays" 401
check_http "web /" "https://$WEB_HOST/" 200
check_http "web /login" "https://$WEB_HOST/login" 200
check_http "web /signup" "https://$WEB_HOST/signup" 200
check_http "web www /" "https://$WWW_HOST/" 200

echo "Summary: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
