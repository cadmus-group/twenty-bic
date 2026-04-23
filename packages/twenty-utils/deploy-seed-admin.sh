#!/usr/bin/env bash
# Seeds a single Railway admin user through the existing twenty-server CLI.
# Usage: from repo root — bash packages/twenty-utils/deploy-seed-admin.sh
# Required env: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
# Optional env: SEED_ADMIN_FIRST_NAME, SEED_ADMIN_LAST_NAME, SEED_ADMIN_LOCALE,
#               SEED_ADMIN_WORKSPACE_ID, SEED_WORKSPACE_ID, SEED_ADMIN_IS_EMAIL_VERIFIED,
#               SEED_ADMIN_CAN_IMPERSONATE, SEED_ADMIN_DRY_RUN
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"
server_directory="$repository_root/packages/twenty-server"

require_nonempty() {
  local variable_name="$1"
  local variable_value="${!1:-}"

  if [[ -z "${variable_value// }" ]]; then
    echo "error: $variable_name must be set" >&2
    exit 1
  fi
}

require_nonempty SEED_ADMIN_EMAIL
require_nonempty SEED_ADMIN_PASSWORD

admin_email="$SEED_ADMIN_EMAIL"
admin_password="$SEED_ADMIN_PASSWORD"
admin_first_name="${SEED_ADMIN_FIRST_NAME:-}"
admin_last_name="${SEED_ADMIN_LAST_NAME:-}"
admin_locale="${SEED_ADMIN_LOCALE:-}"
admin_workspace_id="${SEED_ADMIN_WORKSPACE_ID:-${SEED_WORKSPACE_ID:-}}"
admin_is_email_verified="${SEED_ADMIN_IS_EMAIL_VERIFIED:-true}"
admin_can_impersonate="${SEED_ADMIN_CAN_IMPERSONATE:-false}"
admin_dry_run="${SEED_ADMIN_DRY_RUN:-false}"

admin_user_json=$(
  admin_email="$admin_email" \
  admin_password="$admin_password" \
  admin_first_name="$admin_first_name" \
  admin_last_name="$admin_last_name" \
  admin_locale="$admin_locale" \
  admin_is_email_verified="$admin_is_email_verified" \
  admin_can_impersonate="$admin_can_impersonate" \
  node <<'NODE'
const toBoolean = (value, defaultValue) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const adminUser = {
  email: process.env.admin_email.trim().toLowerCase(),
  password: process.env.admin_password,
  canAccessFullAdminPanel: true,
  isEmailVerified: toBoolean(process.env.admin_is_email_verified, true),
  canImpersonate: toBoolean(process.env.admin_can_impersonate, false),
};

if (process.env.admin_first_name) {
  adminUser.firstName = process.env.admin_first_name;
}

if (process.env.admin_last_name) {
  adminUser.lastName = process.env.admin_last_name;
}

if (process.env.admin_locale) {
  adminUser.locale = process.env.admin_locale;
}

process.stdout.write(JSON.stringify([adminUser]));
NODE
)

cd "$server_directory"

echo "=> Seeding admin user ${admin_email}..."

command=(yarn command:prod users:seed --users-json "$admin_user_json")

if [[ -n "$admin_workspace_id" ]]; then
  command+=(--workspace-id "$admin_workspace_id")
fi

if [[ "$admin_dry_run" == 'true' ]]; then
  command+=(--dry-run)
fi

"${command[@]}"

echo '=> Admin user seed completed.'
