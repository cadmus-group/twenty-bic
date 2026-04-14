#!/usr/bin/env bash
# Bare-metal CRM config installer (idempotent).
# Creates/updates production env files and deploy config templates.
#
# Usage:
#   bash packages/twenty-utils/setup-bare-metal-crm.sh \
#     --domain crm.example.com \
#     --server-url https://crm.example.com \
#     --frontend-url https://crm.example.com \
#     --pg-url postgres://user:pass@127.0.0.1:5432/default \
#     --redis-url redis://127.0.0.1:6379 \
#     --app-secret 'replace-with-strong-secret'
#
# Optional:
#   --api-upstream 127.0.0.1:3000
#   --front-root /var/www/twenty-front/build
#   --run-user ubuntu
#   --install-systemd
#   --dry-run
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"
server_env_file="$repository_root/packages/twenty-server/.env"
front_env_file="$repository_root/packages/twenty-front/.env"
server_env_example="$repository_root/packages/twenty-server/.env.example"
front_env_example="$repository_root/packages/twenty-front/.env.example"
nginx_template="$repository_root/packages/twenty-utils/examples/nginx-twenty.conf.example"
caddy_template="$repository_root/packages/twenty-utils/examples/Caddyfile.twenty.example"
generated_directory="$repository_root/packages/twenty-utils/examples/generated"

domain=''
server_url=''
frontend_url=''
postgres_url=''
redis_url=''
app_secret=''
api_upstream='127.0.0.1:3000'
front_root='/var/www/twenty-front/build'
run_user="${SUDO_USER:-$USER}"
install_systemd='0'
dry_run='0'

info() {
  echo "=> $*"
}

warn() {
  echo "warning: $*" >&2
}

fail() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  sed -n '1,28p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      domain="${2:-}"
      shift 2
      ;;
    --server-url)
      server_url="${2:-}"
      shift 2
      ;;
    --frontend-url)
      frontend_url="${2:-}"
      shift 2
      ;;
    --pg-url)
      postgres_url="${2:-}"
      shift 2
      ;;
    --redis-url)
      redis_url="${2:-}"
      shift 2
      ;;
    --app-secret)
      app_secret="${2:-}"
      shift 2
      ;;
    --api-upstream)
      api_upstream="${2:-}"
      shift 2
      ;;
    --front-root)
      front_root="${2:-}"
      shift 2
      ;;
    --run-user)
      run_user="${2:-}"
      shift 2
      ;;
    --install-systemd)
      install_systemd='1'
      shift
      ;;
    --dry-run)
      dry_run='1'
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown flag: $1"
      ;;
  esac
done

required_arguments=(
  "$domain"
  "$server_url"
  "$frontend_url"
  "$postgres_url"
  "$redis_url"
  "$app_secret"
)
for value in "${required_arguments[@]}"; do
  if [[ -z "${value// }" ]]; then
    usage
    fail 'missing required arguments (see usage above)'
  fi
done

if [[ "$app_secret" == 'replace_me_with_a_random_string' ]]; then
  fail 'APP_SECRET cannot be the .env.example placeholder'
fi
if [[ "${#app_secret}" -lt 24 ]]; then
  fail 'APP_SECRET should be at least 24 characters'
fi

ensure_file_from_example() {
  local target_file="$1"
  local example_file="$2"

  if [[ -f "$target_file" ]]; then
    return
  fi

  if [[ ! -f "$example_file" ]]; then
    fail "example file not found: $example_file"
  fi

  if [[ "$dry_run" == '1' ]]; then
    info "dry-run: would create $target_file from $example_file"
    return
  fi

  cp "$example_file" "$target_file"
  info "created $target_file from example"
}

upsert_env_value() {
  local target_file="$1"
  local key="$2"
  local value="$3"
  local temporary_file

  if [[ "$dry_run" == '1' ]]; then
    info "dry-run: would set ${key}=*** in $target_file"
    return
  fi

  temporary_file="$(mktemp)"

  if awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ ("^" key "=") {
      print key "=" value;
      updated = 1;
      next;
    }
    { print }
    END {
      if (updated == 0) {
        print key "=" value;
      }
    }
  ' "$target_file" >"$temporary_file"; then
    mv "$temporary_file" "$target_file"
  else
    rm -f "$temporary_file"
    fail "unable to update $key in $target_file"
  fi
}

generate_nginx_config() {
  local output_file="$generated_directory/nginx-${domain}.conf"
  local escaped_domain
  local escaped_api_upstream
  local escaped_front_root

  escaped_domain="$(printf '%s\n' "$domain" | sed 's/[\/&]/\\&/g')"
  escaped_api_upstream="$(printf '%s\n' "$api_upstream" | sed 's/[\/&]/\\&/g')"
  escaped_front_root="$(printf '%s\n' "$front_root" | sed 's/[\/&]/\\&/g')"

  if [[ "$dry_run" == '1' ]]; then
    info "dry-run: would generate $output_file"
    return
  fi

  sed \
    -e "s/twenty\\.example\\.com/${escaped_domain}/g" \
    -e "s/127\\.0\\.0\\.1:3000/${escaped_api_upstream}/g" \
    -e "s#/var/www/twenty-front/build#${escaped_front_root}#g" \
    "$nginx_template" >"$output_file"
}

generate_caddy_config() {
  local output_file="$generated_directory/Caddyfile.${domain}"
  local escaped_domain
  local escaped_api_upstream
  local escaped_front_root

  escaped_domain="$(printf '%s\n' "$domain" | sed 's/[\/&]/\\&/g')"
  escaped_api_upstream="$(printf '%s\n' "$api_upstream" | sed 's/[\/&]/\\&/g')"
  escaped_front_root="$(printf '%s\n' "$front_root" | sed 's/[\/&]/\\&/g')"

  if [[ "$dry_run" == '1' ]]; then
    info "dry-run: would generate $output_file"
    return
  fi

  sed \
    -e "s/twenty\\.example\\.com/${escaped_domain}/g" \
    -e "s/127\\.0\\.0\\.1:3000/${escaped_api_upstream}/g" \
    -e "s#/var/www/twenty-front/build#${escaped_front_root}#g" \
    "$caddy_template" >"$output_file"
}

generate_systemd_unit() {
  local output_file="$generated_directory/twenty-pm2.service"
  local pm2_home="/home/${run_user}/.pm2"

  if [[ "$dry_run" == '1' ]]; then
    info "dry-run: would generate $output_file"
    return
  fi

  cat >"$output_file" <<EOF
[Unit]
Description=Twenty CRM (PM2)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
User=${run_user}
Environment=PM2_HOME=${pm2_home}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
WorkingDirectory=${repository_root}
ExecStart=/usr/bin/env bash -lc 'npx pm2@5 start packages/twenty-utils/ecosystem.config.js --env production'
ExecReload=/usr/bin/env bash -lc 'npx pm2@5 reload packages/twenty-utils/ecosystem.config.js --env production'
ExecStop=/usr/bin/env bash -lc 'npx pm2@5 stop packages/twenty-utils/ecosystem.config.js'
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
}

install_systemd_unit_if_requested() {
  local source_unit="$generated_directory/twenty-pm2.service"

  if [[ "$install_systemd" != '1' ]]; then
    return
  fi

  if [[ "$dry_run" == '1' ]]; then
    info 'dry-run: would install systemd unit to /etc/systemd/system/twenty-pm2.service'
    return
  fi

  if ! command -v systemctl &>/dev/null; then
    fail 'systemctl not found; cannot install systemd unit'
  fi

  if [[ "$EUID" -ne 0 ]]; then
    fail '--install-systemd requires root (run with sudo)'
  fi

  cp "$source_unit" /etc/systemd/system/twenty-pm2.service
  systemctl daemon-reload
  systemctl enable twenty-pm2.service
  info 'systemd unit installed and enabled: twenty-pm2.service'
}

ensure_file_from_example "$server_env_file" "$server_env_example"
ensure_file_from_example "$front_env_file" "$front_env_example"

if [[ "$dry_run" != '1' ]]; then
  mkdir -p "$generated_directory"
fi

info "updating production values in $server_env_file"
upsert_env_value "$server_env_file" 'NODE_ENV' 'production'
upsert_env_value "$server_env_file" 'PG_DATABASE_URL' "$postgres_url"
upsert_env_value "$server_env_file" 'REDIS_URL' "$redis_url"
upsert_env_value "$server_env_file" 'APP_SECRET' "$app_secret"
upsert_env_value "$server_env_file" 'SERVER_URL' "$server_url"
upsert_env_value "$server_env_file" 'FRONTEND_URL' "$frontend_url"

info "updating frontend API base URL in $front_env_file"
upsert_env_value "$front_env_file" 'REACT_APP_SERVER_BASE_URL' "$server_url"

generate_nginx_config
generate_caddy_config
generate_systemd_unit
install_systemd_unit_if_requested

echo
info 'bare-metal CRM config setup complete.'
echo "   server env:  $server_env_file"
echo "   front env:   $front_env_file"
echo "   generated:   $generated_directory"
echo
echo '   Next steps:'
echo '   1) yarn deploy:check'
echo '   2) yarn deploy:bootstrap'
echo '   3) NODE_ENV=production npx nx run twenty-shared:build'
echo '   4) NODE_ENV=production npx nx run twenty-server:build'
echo '   5) NODE_ENV=production npx nx run twenty-front:build'
echo '   6) yarn deploy:pm2:start'
echo '   7) yarn deploy:smoke'
