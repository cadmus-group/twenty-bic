#!/usr/bin/env bash
# Ensures Redis answers on localhost:6379 (default REDIS_URL). Idempotent.
# Used by yarn start and yarn crm:dev.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/packages/twenty-docker/docker-compose.dev.yml"

can_use_docker() {
  docker compose version &>/dev/null 2>&1
}

redis_reachable() {
  if command -v redis-cli &>/dev/null; then
    redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG
    return
  fi
  if can_use_docker && docker compose -f "$COMPOSE_FILE" ps --quiet redis 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null |
      grep -q PONG
    return
  fi
  return 1
}

wait_redis() {
  local retries=30
  while ! redis_reachable; do
    retries=$((retries - 1))
    if [[ "$retries" -le 0 ]]; then
      return 1
    fi
    sleep 1
  done
}

if redis_reachable; then
  echo "=> Redis OK (localhost:6379)."
  exit 0
fi

if can_use_docker; then
  echo "=> Starting Redis via Docker (dev compose)…"
  docker compose -f "$COMPOSE_FILE" up -d --build redis
  if ! wait_redis; then
    echo "error: Redis did not become reachable on localhost:6379." >&2
    exit 1
  fi
  echo "   Redis OK."
  exit 0
fi

echo "error: Redis is not running on localhost:6379 (see REDIS_URL in packages/twenty-server/.env)." >&2
echo "  With Docker:" >&2
echo "    docker compose -f packages/twenty-docker/docker-compose.dev.yml up -d --build redis" >&2
echo "  Or full infra + .env:" >&2
echo "    bash packages/twenty-utils/setup-dev-env.sh" >&2
exit 1
