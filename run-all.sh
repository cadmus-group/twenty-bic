#!/usr/bin/env bash
# One-shot setup for Twenty (twenty-bic): dev infra or full bare-metal production.
# Uses Docker Compose v2 only: `docker compose` (never `docker-compose`).
#
# Dev (Postgres + Redis + .env; auto-detect local vs Docker):
#   ./run-all.sh
#   ./run-all.sh --docker
#   ./run-all.sh --docker --crm
#
# Production (configure env + templates, migrate, build, PM2, smoke):
#   ./run-all.sh --profile production -- \
#     --domain crm.example.com \
#     --server-url https://crm.example.com \
#     --frontend-url https://crm.example.com \
#     --pg-url postgres://user:pass@127.0.0.1:5432/default \
#     --redis-url redis://127.0.0.1:6379 \
#     --app-secret 'your-strong-secret-at-least-24-chars'
#
# Optional flags (any profile):
#   --skip-install     Skip yarn install
#   --no-pm2           Production only: skip PM2 reload/start
#   --install-systemd  Pass through to bare-metal script (requires sudo there)
#
# After `--`, all arguments are passed to packages/twenty-utils/setup-bare-metal-crm.sh
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
utils_dir="$repository_root/packages/twenty-utils"

info() {
  echo "=> $*"
}

fail() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  sed -n '1,35p' "$0"
}

profile='dev'
skip_install='0'
docker_infra='0'
with_crm='0'
no_pm2='0'
systemd_install='0'
bare_metal_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      profile="${2:-}"
      shift 2
      ;;
    --skip-install)
      skip_install='1'
      shift
      ;;
    --docker)
      docker_infra='1'
      shift
      ;;
    --crm)
      with_crm='1'
      shift
      ;;
    --no-pm2)
      no_pm2='1'
      shift
      ;;
    --install-systemd)
      systemd_install='1'
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      bare_metal_args=("$@")
      break
      ;;
    *)
      fail "unknown option: $1 (use --help)"
      ;;
  esac
done

cd "$repository_root"

if [[ "$skip_install" != '1' ]]; then
  info 'Installing workspace dependencies (yarn)…'
  yarn install
fi

if [[ "$profile" == 'dev' ]]; then
  if [[ "$docker_infra" == '1' ]]; then
    info 'Starting dev databases via Docker Compose…'
    bash "$utils_dir/setup-dev-env.sh" --docker
  else
    info 'Starting dev environment (local or Docker auto-detect)…'
    bash "$utils_dir/setup-dev-env.sh"
  fi
  if [[ "$with_crm" == '1' ]]; then
    info 'Enabling CRM feature flags…'
    yarn crm:on
  fi
  info 'Dev setup complete.'
  echo '   Next: yarn start   (or yarn crm:dev if you use CRM dev script)'
  exit 0
fi

if [[ "$profile" != 'production' ]]; then
  fail "--profile must be dev or production (got: $profile)"
fi

configure_args=("${bare_metal_args[@]}")
if [[ "$systemd_install" == '1' ]]; then
  configure_args+=('--install-systemd')
fi
if [[ ${#configure_args[@]} -gt 0 ]]; then
  info 'Applying bare-metal CRM configuration…'
  bash "$utils_dir/setup-bare-metal-crm.sh" "${configure_args[@]}"
else
  info 'No args after -- ; skipping setup-bare-metal-crm.sh (using existing .env files).'
fi

info 'Preflight (Postgres, Redis, env)…'
yarn deploy:check

info 'Database migrations…'
yarn deploy:bootstrap

info 'Production builds…'
NODE_ENV=production npx nx run twenty-shared:build
NODE_ENV=production npx nx run twenty-server:build
NODE_ENV=production npx nx run twenty-front:build

if [[ "$no_pm2" != '1' ]]; then
  info 'PM2 reload (starts apps if not running)…'
  yarn deploy:pm2:reload || yarn deploy:pm2:start
fi

info 'Smoke tests…'
yarn deploy:smoke

info 'Production run-all complete.'
