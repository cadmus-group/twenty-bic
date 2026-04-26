#!/usr/bin/env bash
set -euo pipefail

require_nonempty() {
  local variable_name="$1"
  local variable_value="${!1:-}"

  if [[ -z "${variable_value// }" ]]; then
    printf 'error: %s must be set\n' "$variable_name" >&2
    exit 1
  fi
}

require_nonempty PG_DATABASE_URL
require_nonempty SEED_ADMIN_EMAIL
require_nonempty SEED_ADMIN_PASSWORD

admin_email=$SEED_ADMIN_EMAIL
admin_password=$SEED_ADMIN_PASSWORD
admin_first_name=${SEED_ADMIN_FIRST_NAME:-Super}
admin_last_name=${SEED_ADMIN_LAST_NAME:-Admin}
admin_locale=${SEED_ADMIN_LOCALE:-en}
admin_workspace_id=${SEED_ADMIN_WORKSPACE_ID:-${SEED_WORKSPACE_ID:-}}
admin_is_email_verified=${SEED_ADMIN_IS_EMAIL_VERIFIED:-true}
admin_can_impersonate=${SEED_ADMIN_CAN_IMPERSONATE:-false}
admin_can_access_full_admin_panel=${SEED_ADMIN_CAN_ACCESS_FULL_ADMIN_PANEL:-true}
admin_dry_run=${SEED_ADMIN_DRY_RUN:-false}
admin_password_hash=${SEED_ADMIN_PASSWORD_HASH:-}

admin_email="$admin_email" \
admin_password="$admin_password" \
admin_first_name="$admin_first_name" \
admin_last_name="$admin_last_name" \
admin_locale="$admin_locale" \
admin_workspace_id="$admin_workspace_id" \
admin_is_email_verified="$admin_is_email_verified" \
admin_can_impersonate="$admin_can_impersonate" \
admin_can_access_full_admin_panel="$admin_can_access_full_admin_panel" \
admin_dry_run="$admin_dry_run" \
admin_password_hash="$admin_password_hash" \
node <<'NODE'
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const workspaceId = process.env.admin_workspace_id || '';
const adminEmail = process.env.admin_email.trim().toLowerCase();
const connectionString = process.env.PG_DATABASE_URL;

if (!connectionString) {
  throw new Error('PG_DATABASE_URL is required');
}

const toBoolean = (value, defaultValue) => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const adminUser = {
  email: adminEmail,
  firstName: process.env.admin_first_name,
  lastName: process.env.admin_last_name,
  locale: process.env.admin_locale,
  password: process.env.admin_password,
  canAccessFullAdminPanel: toBoolean(process.env.admin_can_access_full_admin_panel, true),
  isEmailVerified: toBoolean(process.env.admin_is_email_verified, true),
  canImpersonate: toBoolean(process.env.admin_can_impersonate, false),
};

const dryRun = toBoolean(process.env.admin_dry_run, false);
const passwordHash = process.env.admin_password_hash || null;

const sql = {
  userSelect: 'select id, email, "firstName", "lastName", locale, "passwordHash", "canAccessFullAdminPanel", "isEmailVerified", "canImpersonate" from core."user" where email = $1 limit 1',
  userInsert: `insert into core."user" (
    id,
    email,
    "firstName",
    "lastName",
    locale,
    "passwordHash",
    "canAccessFullAdminPanel",
    "isEmailVerified",
    "canImpersonate",
    "createdAt",
    "updatedAt"
  ) values (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now()
  ) returning id`,
  userUpdate: `update core."user" set
    "firstName" = $2,
    "lastName" = $3,
    locale = $4,
    "passwordHash" = coalesce($5, "passwordHash"),
    "canAccessFullAdminPanel" = $6,
    "isEmailVerified" = $7,
    "canImpersonate" = $8,
    "updatedAt" = now()
  where id = $1`,
  workspaceSelect: 'select id, "workspaceCustomApplicationId", "defaultRoleId" from core.workspace where id = $1 limit 1',
  roleSelectByUid: 'select id from core.role where "workspaceId" = $1 and "universalIdentifier" = $2 limit 1',
  roleSelectByLabel: 'select id from core.role where "workspaceId" = $1 and label = $2 limit 1',
  roleInsert: `insert into core.role (
    id,
    label,
    description,
    icon,
    "workspaceId",
    "applicationId",
    "universalIdentifier",
    "canUpdateAllSettings",
    "canAccessAllTools",
    "canReadAllObjectRecords",
    "canUpdateAllObjectRecords",
    "canSoftDeleteAllObjectRecords",
    "canDestroyAllObjectRecords",
    "isEditable",
    "canBeAssignedToUsers",
    "canBeAssignedToAgents",
    "canBeAssignedToApiKeys",
    "createdAt",
    "updatedAt"
  ) values (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now()
  ) returning id`,
  userWorkspaceSelect: 'select id from core."userWorkspace" where "userId" = $1 and "workspaceId" = $2 and "deletedAt" is null limit 1',
  userWorkspaceInsert: `insert into core."userWorkspace" (
    id,
    "workspaceId",
    "userId",
    "defaultAvatarUrl",
    locale,
    "createdAt",
    "updatedAt"
  ) values ($1,$2,$3,$4,$5,now(),now()) returning id`,
  roleTargetDelete: 'delete from core."roleTarget" where "workspaceId" = $1 and "userWorkspaceId" = $2',
  roleTargetInsert: `insert into core."roleTarget" (
    id,
    "roleId",
    "userWorkspaceId",
    "agentId",
    "apiKeyId",
    "workspaceId",
    "applicationId",
    "universalIdentifier",
    "createdAt",
    "updatedAt"
  ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
  workspaceUpdateDefaultRole: 'update core.workspace set "defaultRoleId" = $1 where id = $2',
};

async function ensureRole(client, workspace, role) {
  const existing = await client.query(sql.roleSelectByUid, [workspace.id, role.universalIdentifier]);

  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(sql.roleInsert, [
    randomUUID(),
    role.label,
    role.description,
    role.icon,
    workspace.id,
    workspace.workspaceCustomApplicationId,
    role.universalIdentifier,
    role.canUpdateAllSettings,
    role.canAccessAllTools,
    role.canReadAllObjectRecords,
    role.canUpdateAllObjectRecords,
    role.canSoftDeleteAllObjectRecords,
    role.canDestroyAllObjectRecords,
    role.isEditable,
    role.canBeAssignedToUsers,
    role.canBeAssignedToAgents,
    role.canBeAssignedToApiKeys,
  ]);

  return inserted.rows[0].id;
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('begin');

  try {
    const workspaceResult = await client.query(sql.workspaceSelect, [workspaceId]);

    if (workspaceResult.rowCount === 0) {
      throw new Error('Workspace not found: ' + workspaceId);
    }

    const workspace = workspaceResult.rows[0];

    if (!workspace.workspaceCustomApplicationId) {
      throw new Error('Workspace missing workspaceCustomApplicationId: ' + workspaceId);
    }

    const userResult = await client.query(sql.userSelect, [adminEmail]);

    let userId;

    if (userResult.rowCount === 0) {
      if (dryRun) {
        console.log('Dry run: would create user ' + adminEmail);
        userId = randomUUID();
      } else {
        const insertedUser = await client.query(sql.userInsert, [
          randomUUID(),
          adminUser.email,
          adminUser.firstName,
          adminUser.lastName,
          adminUser.locale,
          passwordHash,
          adminUser.canAccessFullAdminPanel,
          adminUser.isEmailVerified,
          adminUser.canImpersonate,
        ]);

        userId = insertedUser.rows[0].id;
      }
    } else {
      userId = userResult.rows[0].id;

      if (!dryRun) {
        await client.query(sql.userUpdate, [
          userId,
          adminUser.firstName,
          adminUser.lastName,
          adminUser.locale,
          passwordHash,
          adminUser.canAccessFullAdminPanel,
          adminUser.isEmailVerified,
          adminUser.canImpersonate,
        ]);
      }
    }

    const adminRoleId = await ensureRole(client, workspace, {
      universalIdentifier: '20202020-02c2-43f2-b94d-cab1f2b532eb',
      label: 'Admin',
      description: 'Admin role',
      icon: 'IconUserCog',
      isEditable: false,
      canUpdateAllSettings: true,
      canAccessAllTools: true,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: true,
      canSoftDeleteAllObjectRecords: true,
      canDestroyAllObjectRecords: true,
      canBeAssignedToUsers: true,
      canBeAssignedToAgents: false,
      canBeAssignedToApiKeys: true,
    });

    let memberRoleId = workspace.defaultRoleId;

    if (!memberRoleId) {
      const existingMemberRole = await client.query(sql.roleSelectByLabel, [workspace.id, 'Member']);

      if (existingMemberRole.rowCount > 0) {
        memberRoleId = existingMemberRole.rows[0].id;
      } else {
        memberRoleId = await ensureRole(client, workspace, {
          universalIdentifier: randomUUID(),
          label: 'Member',
          description: 'Member role',
          icon: 'IconUser',
          isEditable: true,
          canUpdateAllSettings: false,
          canAccessAllTools: true,
          canReadAllObjectRecords: true,
          canUpdateAllObjectRecords: true,
          canSoftDeleteAllObjectRecords: true,
          canDestroyAllObjectRecords: true,
          canBeAssignedToUsers: true,
          canBeAssignedToAgents: false,
          canBeAssignedToApiKeys: false,
        });
      }

      if (!dryRun) {
        await client.query(sql.workspaceUpdateDefaultRole, [memberRoleId, workspace.id]);
      }
    }

    if (workspaceId) {
      let userWorkspaceId;
      const userWorkspaceResult = await client.query(sql.userWorkspaceSelect, [userId, workspace.id]);

      if (userWorkspaceResult.rowCount > 0) {
        userWorkspaceId = userWorkspaceResult.rows[0].id;
      } else if (!dryRun) {
        const insertedUserWorkspace = await client.query(sql.userWorkspaceInsert, [
          randomUUID(),
          workspace.id,
          userId,
          null,
          adminUser.locale,
        ]);

        userWorkspaceId = insertedUserWorkspace.rows[0].id;
      } else {
        userWorkspaceId = randomUUID();
      }

      if (!dryRun) {
        await client.query(sql.roleTargetDelete, [workspace.id, userWorkspaceId]);
        await client.query(sql.roleTargetInsert, [
          randomUUID(),
          adminRoleId,
          userWorkspaceId,
          null,
          null,
          workspace.id,
          workspace.workspaceCustomApplicationId,
          randomUUID(),
        ]);
      }

      console.log(JSON.stringify({
        workspaceId: workspace.id,
        userId,
        userWorkspaceId,
        adminRoleId,
        memberRoleId,
        defaultRoleId: memberRoleId,
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        userId,
        adminRoleId,
        memberRoleId,
      }, null, 2));
    }

    if (dryRun) {
      await client.query('rollback');
    } else {
      await client.query('commit');
    }
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {}

    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
