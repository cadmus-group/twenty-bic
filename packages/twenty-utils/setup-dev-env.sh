#!/bin/bash
# =============================================================================
# Twenty CRM — Development Environment Setup
# =============================================================================
# Single entry point for setting up a dev environment. Idempotent.
#
# What it does:
#   1. Starts Postgres + Redis (local services or Docker, auto-detected)
#   2. Creates 'default' and 'test' databases
#   3. Copies .env.example -> .env for front and server
#
# Usage (from repo root):
#   bash packages/twenty-utils/setup-dev-env.sh          # start + configure
#   bash packages/twenty-utils/setup-dev-env.sh --down    # stop services
#   bash packages/twenty-utils/setup-dev-env.sh --reset   # wipe data + restart
#   bash packages/twenty-utils/setup-dev-env.sh --docker  # force Docker mode
#
# TWENTY_DEV_PG_PORT: host port for Docker Postgres (default 5433 in compose; 5432 if you use local PG).
# Used for compose, health checks, psql, and syncing localhost PG_DATABASE_URL after reset:env.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/packages/twenty-docker/docker-compose.dev.yml"

info()  { echo "=> $*"; }
ok()    { echo "   done: $*"; }
fail()  { echo "   FAIL: $*" >&2; }

# --------------- detection helpers ---------------
has_local_pg() {
  command -v pg_ctlcluster &>/dev/null && pg_lsclusters 2>/dev/null | grep -q "16"
}

has_local_redis() {
  command -v redis-server &>/dev/null
}

can_use_docker() {
  docker compose version &>/dev/null 2>&1
}

pg_is_up() {
  local port="${TWENTY_DEV_PG_PORT:-5433}"
  if command -v pg_isready &>/dev/null; then
    pg_isready -h localhost -p "$port" -U postgres -q 2>/dev/null
  elif command -v psql &>/dev/null; then
    PGPASSWORD=postgres psql -h localhost -p "$port" -U postgres -c "SELECT 1" &>/dev/null
  elif can_use_docker && docker compose -f "$COMPOSE_FILE" ps --quiet db 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U postgres -q 2>/dev/null
  else
    return 1
  fi
}

redis_is_up() {
  if command -v redis-cli &>/dev/null; then
    redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG
  elif can_use_docker && docker compose -f "$COMPOSE_FILE" ps --quiet redis 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG
  else
    # Portable fallback using bash /dev/tcp (no nc -q dependency)
    timeout 2 bash -c 'exec 3<>/dev/tcp/localhost/6379; echo PING >&3; read -r reply <&3; exec 3>&-; echo "$reply"' 2>/dev/null | grep -q PONG
  fi
}

wait_for_pg() {
  local retries=30
  while ! pg_is_up; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then fail "PostgreSQL did not start in time"; exit 1; fi
    sleep 1
  done
}

wait_for_redis() {
  local retries=30
  while ! redis_is_up; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then fail "Redis did not start in time"; exit 1; fi
    sleep 1
  done
}

# --------------- parse flags ---------------
USE_DOCKER=false
ACTION="up"

while [ $# -gt 0 ]; do
  case "$1" in
    --docker) USE_DOCKER=true ;;
    --down)   ACTION="down" ;;
    --reset)  ACTION="reset" ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
  shift
done

resolve_twenty_dev_pg_port() {
  if [ "$USE_DOCKER" = true ]; then
    export TWENTY_DEV_PG_PORT="${TWENTY_DEV_PG_PORT:-5433}"
    return
  fi
  if has_local_pg; then
    export TWENTY_DEV_PG_PORT="${TWENTY_DEV_PG_PORT:-5432}"
    return
  fi
  if can_use_docker; then
    export TWENTY_DEV_PG_PORT="${TWENTY_DEV_PG_PORT:-5433}"
    return
  fi
  export TWENTY_DEV_PG_PORT="${TWENTY_DEV_PG_PORT:-5432}"
}

resolve_twenty_dev_pg_port

# --------------- stop ---------------
stop_docker() {
  if can_use_docker && docker compose -f "$COMPOSE_FILE" ps -a --quiet 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" down "$@"
  fi
}

stop_local() {
  if has_local_pg; then sudo pg_ctlcluster 16 main stop 2>/dev/null || true; fi
  if has_local_redis && pgrep -x redis-server &>/dev/null; then
    sudo service redis-server stop 2>/dev/null || true
  fi
}

stop_services() {
  if [ "$USE_DOCKER" = true ]; then
    stop_docker "$@"
  else
    stop_docker "$@"
    stop_local
  fi
}

if [ "$ACTION" = "down" ]; then
  info "Stopping dev services..."
  stop_services
  ok "Services stopped"
  exit 0
fi

if [ "$ACTION" = "reset" ]; then
  info "Resetting dev services (wiping data)..."
  # Wipe local Redis data while it's still running
  if [ "$USE_DOCKER" = false ] && has_local_redis && pgrep -x redis-server &>/dev/null; then
    info "Flushing local Redis data..."
    redis-cli flushall 2>/dev/null || true
  fi
  # Wipe local PostgreSQL data while it's still running
  if [ "$USE_DOCKER" = false ] && has_local_pg; then
    info "Dropping local databases..."
    sudo pg_ctlcluster 16 main start 2>/dev/null || true
    wait_for_pg
    sudo -u postgres psql -c 'DROP DATABASE IF EXISTS "default";' 2>/dev/null || true
    sudo -u postgres psql -c 'DROP DATABASE IF EXISTS "test";' 2>/dev/null || true
  fi
  # Stop Docker with -v to remove volumes
  stop_docker -v 2>/dev/null || stop_docker
  # Stop local services
  if [ "$USE_DOCKER" = false ]; then
    stop_local
  fi
fi

# =============================================================================
# 1. Start services (auto-detect: local > Docker)
# =============================================================================
start_pg() {
  if pg_is_up; then
    ok "PostgreSQL already running"
    return
  fi

  if [ "$USE_DOCKER" = false ] && has_local_pg; then
    info "Starting local PostgreSQL..."
    sudo pg_ctlcluster 16 main start
    wait_for_pg
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true
  elif can_use_docker; then
    info "Starting PostgreSQL via Docker..."
    docker compose -f "$COMPOSE_FILE" up -d --build db
    wait_for_pg
  else
    fail "No PostgreSQL available. Install PostgreSQL 16 or Docker."
    exit 1
  fi
}

start_redis() {
  if redis_is_up; then
    ok "Redis already running"
    return
  fi

  if [ "$USE_DOCKER" = false ] && has_local_redis; then
    info "Starting local Redis..."
    sudo service redis-server start 2>/dev/null || redis-server --daemonize yes 2>/dev/null || true
    wait_for_redis
  elif can_use_docker; then
    info "Starting Redis via Docker..."
    docker compose -f "$COMPOSE_FILE" up -d --build redis
    wait_for_redis
  else
    fail "No Redis available. Install Redis or Docker."
    exit 1
  fi
}

if [ "$USE_DOCKER" = true ]; then
  info "Starting services via Docker Compose..."
  docker compose -f "$COMPOSE_FILE" up -d --build
  wait_for_pg
  wait_for_redis
else
  start_pg
  start_redis
fi

ok "PostgreSQL on localhost:${TWENTY_DEV_PG_PORT}"
ok "Redis on localhost:6379"

# =============================================================================
# 2. Create databases
# =============================================================================
info "Creating databases..."
run_psql() {
  local port="${TWENTY_DEV_PG_PORT:-5433}"
  if command -v psql &>/dev/null; then
    PGPASSWORD=postgres psql -h localhost -p "$port" -U postgres -d postgres -c "$1" 2>/dev/null || true
  elif can_use_docker && docker compose -f "$COMPOSE_FILE" ps --quiet db 2>/dev/null | grep -q .; then
    docker compose -f "$COMPOSE_FILE" exec -T db psql -U postgres -d postgres -c "$1" 2>/dev/null || true
  else
    fail "No psql client available and no Docker db container running"
    return 1
  fi
}
run_psql 'CREATE DATABASE "default";'
run_psql 'CREATE DATABASE "test";'
ok "Databases 'default' and 'test' ready"

# =============================================================================
# 3. Environment files (via Nx when available, fallback to cp)
# =============================================================================
info "Setting up .env files..."
cd "$REPO_ROOT"

if command -v npx &>/dev/null && [ -d node_modules ]; then
  npx nx reset:env twenty-front
  npx nx reset:env twenty-server
else
  for pkg in twenty-front twenty-server; do
    src="packages/$pkg/.env.example"
    dst="packages/$pkg/.env"
    if [ -f "$src" ] && [ ! -f "$dst" ]; then
      cp "$src" "$dst"
      ok "$pkg/.env created"
    fi
  done
fi

# Align localhost PG URL port with TWENTY_DEV_PG_PORT (avoids wrong Postgres on 5432)
sync_server_pg_url_port() {
  local env_file="$REPO_ROOT/packages/twenty-server/.env"
  local port="${TWENTY_DEV_PG_PORT:-5433}"
  [ -f "$env_file" ] || return 0
  local line updated=false
  local tmp
  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^PG_DATABASE_URL=(postgres://[^@]+@)(localhost|127\.0\.0\.1):[0-9]+(/.*)$ ]]; then
      printf '%s\n' "PG_DATABASE_URL=${BASH_REMATCH[1]}${BASH_REMATCH[2]}:${port}${BASH_REMATCH[3]}"
      updated=true
    else
      printf '%s\n' "$line"
    fi
  done < "$env_file" > "$tmp"
  mv "$tmp" "$env_file"
  if [ "$updated" = true ]; then
    ok "twenty-server/.env PG_DATABASE_URL -> localhost:${port}"
  fi
}
sync_server_pg_url_port

# =============================================================================
echo ""
echo "Dev environment ready."
echo ""
echo "  yarn start                         # start everything"
echo "  npx nx start twenty-front          # frontend  -> http://localhost:3001"
echo "  npx nx start twenty-server         # backend   -> http://localhost:3000"
echo ""
