#!/usr/bin/env bash
# HTTP smoke checks after deploy or PM2 start (requires curl).
# Usage: from repo root — bash packages/twenty-utils/deploy-smoke.sh
# Optional: TWENTY_SERVER_ENV_FILE, TWENTY_SMOKE_API_URL, TWENTY_SMOKE_FRONT_URL,
#           TWENTY_SMOKE_SKIP_FRONT=1, TWENTY_SMOKE_SKIP_CLIENT_CONFIG=1
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"
server_env_file="${TWENTY_SERVER_ENV_FILE:-$repository_root/packages/twenty-server/.env}"

if [[ ! -f "$server_env_file" ]]; then
  echo "error: missing server env file: $server_env_file" >&2
  exit 1
fi

if ! command -v curl &>/dev/null; then
  echo 'error: curl is required for deploy-smoke.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$server_env_file"
set +a

api_base="${TWENTY_SMOKE_API_URL:-${SERVER_URL:-http://127.0.0.1:3000}}"
api_base="${api_base%/}"

echo "=> Smoke: GET ${api_base}/healthz"
health_body="$(curl -fsS --max-time 15 "${api_base}/healthz")"
if [[ -z "$health_body" ]]; then
  echo 'error: healthz returned an empty body.' >&2
  exit 1
fi
echo '   healthz OK.'

if [[ "${TWENTY_SMOKE_SKIP_CLIENT_CONFIG:-}" != '1' ]]; then
  echo "=> Smoke: GET ${api_base}/client-config"
  client_config_body="$(curl -fsS --max-time 15 "${api_base}/client-config")"
  if [[ -z "$client_config_body" ]]; then
    echo 'error: client-config returned an empty body.' >&2
    exit 1
  fi
  echo '   client-config OK.'
fi

front_url="${TWENTY_SMOKE_FRONT_URL:-}"
if [[ -z "$front_url" ]] && [[ -n "${FRONTEND_URL:-}" ]]; then
  front_url="$FRONTEND_URL"
fi

if [[ "${TWENTY_SMOKE_SKIP_FRONT:-}" == '1' ]]; then
  front_url=''
fi

if [[ -n "$front_url" ]]; then
  front_url="${front_url%/}"
  echo "=> Smoke: GET ${front_url}/ (static UI)"
  code="$(curl -o /dev/null -sS -w '%{http_code}' --max-time 15 "${front_url}/")"
  if [[ "$code" != '200' ]] && [[ "$code" != '304' ]]; then
    echo "error: front root returned HTTP ${code} (expected 200 or 304)." >&2
    exit 1
  fi
  echo "   front root OK (HTTP ${code})."
fi

echo '=> deploy-smoke: all checks passed.'
