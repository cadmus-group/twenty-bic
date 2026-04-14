#!/usr/bin/env bash
# Validates server env and connectivity to Postgres + Redis before deploy/migrate.
# Usage: from repo root — bash packages/twenty-utils/deploy-preflight.sh
# Optional: TWENTY_SERVER_ENV_FILE, TWENTY_PREFLIGHT_HTTP=1 (healthz + client-config),
#           TWENTY_FRONT_ENV_FILE
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"
server_env_file="${TWENTY_SERVER_ENV_FILE:-$repository_root/packages/twenty-server/.env}"
front_env_file="${TWENTY_FRONT_ENV_FILE:-$repository_root/packages/twenty-front/.env}"

if [[ ! -f "$server_env_file" ]]; then
  echo "error: missing server env file: $server_env_file" >&2
  echo "  Copy packages/twenty-server/.env.example and configure for production." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$server_env_file"
set +a

require_nonempty() {
  local name="$1"
  local value="${!1:-}"
  if [[ -z "${value// }" ]]; then
    echo "error: $name must be set in $server_env_file" >&2
    exit 1
  fi
}

require_nonempty PG_DATABASE_URL
require_nonempty REDIS_URL
require_nonempty APP_SECRET

if [[ "$APP_SECRET" == 'replace_me_with_a_random_string' ]]; then
  if [[ "${NODE_ENV:-}" == 'production' ]]; then
    echo 'error: APP_SECRET is still the example placeholder; set a strong secret.' >&2
    exit 1
  fi
  echo '=> Warning: APP_SECRET is still the .env.example placeholder (not allowed in production).' >&2
fi

if [[ "${NODE_ENV:-}" == 'production' ]] && [[ "${#APP_SECRET}" -lt 24 ]]; then
  echo 'error: APP_SECRET should be at least 24 characters in production.' >&2
  exit 1
fi

if [[ "${NODE_ENV:-}" != 'production' ]]; then
  echo "=> Note: NODE_ENV is '${NODE_ENV:-development}' (use production on the server)."
fi

if [[ -f "$front_env_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$front_env_file"
  set +a
  if [[ -z "${REACT_APP_SERVER_BASE_URL:-}" ]]; then
    echo "error: REACT_APP_SERVER_BASE_URL must be set in $front_env_file" >&2
    exit 1
  fi
  if [[ "${NODE_ENV:-}" == 'production' ]] &&
    [[ "${REACT_APP_SERVER_BASE_URL}" == http://localhost* ]]; then
    echo '=> Warning: front REACT_APP_SERVER_BASE_URL still points at localhost.' >&2
  fi
fi

echo '=> Checking Postgres (PG_DATABASE_URL)…'
node <<'NODE'
const { Client } = require('pg');

const connectionString = process.env.PG_DATABASE_URL;

if (!connectionString) {
  console.error('error: PG_DATABASE_URL is not set');
  process.exit(1);
}

const client = new Client({ connectionString });

client
  .connect()
  .then(() => client.query('select 1 as ok'))
  .then(() => client.end())
  .then(() => {
    console.log('   Postgres OK.');
  })
  .catch((error) => {
    const message =
      error && typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : String(error);
    console.error('error: Postgres connection failed:', message);
    process.exit(1);
  });
NODE

echo '=> Checking Redis (REDIS_URL)…'
node <<'NODE'
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('error: REDIS_URL is not set');
  process.exit(1);
}

const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });

redis
  .ping()
  .then((reply) => {
    if (reply !== 'PONG') {
      throw new Error(`unexpected PING reply: ${reply}`);
    }
    return redis.quit();
  })
  .then(() => {
    console.log('   Redis OK.');
  })
  .catch((error) => {
    const message =
      error && typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : String(error);
    console.error('error: Redis connection failed:', message);
    process.exit(1);
  });
NODE

if [[ "${TWENTY_PREFLIGHT_HTTP:-}" == '1' ]]; then
  base_url="${SERVER_URL:-http://127.0.0.1:3000}"
  base_url="${base_url%/}"
  if command -v curl &>/dev/null; then
    echo "=> Checking HTTP GET ${base_url}/healthz …"
    if ! curl -fsS --max-time 5 "${base_url}/healthz" >/dev/null; then
      echo 'error: health check failed (is the API listening on SERVER_URL / PORT?)' >&2
      exit 1
    fi
    echo '   HTTP healthz OK.'
    echo "=> Checking HTTP GET ${base_url}/client-config …"
    if ! curl -fsS --max-time 5 "${base_url}/client-config" >/dev/null; then
      echo 'error: client-config check failed (same host/port as SERVER_URL).' >&2
      exit 1
    fi
    echo '   HTTP client-config OK.'
  else
    echo '=> Skipping HTTP checks (curl not installed).' >&2
  fi
fi

echo '=> deploy-preflight: all checks passed.'
