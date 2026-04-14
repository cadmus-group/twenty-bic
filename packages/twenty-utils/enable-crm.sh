#!/usr/bin/env bash
# Applies core Postgres migrations required for CRM (crmCallLog table and enums).
# Idempotent: safe to run multiple times. From repo root: yarn crm:on
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export NODE_ENV="${NODE_ENV:-development}"

if [[ ! -f "$REPO_ROOT/nx.json" ]]; then
  echo "error: nx.json not found at $REPO_ROOT (wrong script location)." >&2
  exit 1
fi

SERVER_ENV="$REPO_ROOT/packages/twenty-server/.env"
if [[ ! -f "$SERVER_ENV" ]]; then
  echo "error: missing $SERVER_ENV" >&2
  echo "  Copy packages/twenty-server/.env.example to .env or run:" >&2
  echo "  bash packages/twenty-utils/setup-dev-env.sh" >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "error: node_modules missing at repo root; run yarn first." >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "=> Checking Postgres with packages/twenty-server/.env (PG_DATABASE_URL)..."
(
  cd "$REPO_ROOT/packages/twenty-server"
  node <<'NODE'
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');
const { Client } = require('pg');

const envPath = path.join(__dirname, '.env');
const tryConnect = () => {
  config({ path: envPath, override: true });
  const connectionString = process.env.PG_DATABASE_URL;
  if (!connectionString) {
    console.error('error: PG_DATABASE_URL is missing in packages/twenty-server/.env');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  return client.connect().then(() => {
    console.log('   Connection OK.');
    return client.end();
  });
};

tryConnect().catch((error) => {
  const composeFile = path.join(
    __dirname,
    '..',
    'twenty-docker',
    'docker-compose.dev.yml',
  );
  let published = '';
  try {
    const out = execSync(
      `docker compose -f "${composeFile}" port db 5432`,
      { encoding: 'utf8' },
    ).trim();
    const parts = out.split(':');
    published = parts[parts.length - 1] || '';
  } catch {
    // no docker or service not running
  }

  const url = process.env.PG_DATABASE_URL || '';
  const m = url.match(/@(localhost|127\.0\.0\.1):(\d+)\//);
  const urlPort = m ? m[2] : '';

  console.error('error: Postgres refused the connection using PG_DATABASE_URL.');
  console.error(`       ${error.message}`);
  if (error.code === '28P01' && published && urlPort && published !== urlPort) {
    console.error('');
    console.error(
      `  Your .env uses host port ${urlPort}, but Twenty dev DB is published on ${published}.`,
    );
    console.error('  Updating localhost / 127.0.0.1 PG_DATABASE_URL port and retrying once…');
    let body = fs.readFileSync(envPath, 'utf8');
    body = body.replace(
      /^(PG_DATABASE_URL=postgres:\/\/[^@]+@)(localhost|127\.0\.0\.1):\d+(\/.*)$/m,
      `$1$2:${published}$3`,
    );
    fs.writeFileSync(envPath, body);
    config({ path: envPath, override: true });
    const client2 = new Client({ connectionString: process.env.PG_DATABASE_URL });
    return client2
      .connect()
      .then(() => {
        console.log('   Connection OK (after port sync).');
        return client2.end();
      })
      .catch((error2) => {
        console.error(`       Retry failed: ${error2.message}`);
        process.exit(1);
      });
  }
  if (error.code === '28P01') {
    console.error('');
    console.error('  (28P01) Wrong password or wrong Postgres (often wrong localhost port).');
    if (published) {
      console.error(
        `  Docker publishes db:5432 to host port ${published} — set PG_DATABASE_URL ...@${published}/...`,
      );
    } else {
      console.error(
        '  Start: docker compose -f packages/twenty-docker/docker-compose.dev.yml up -d db',
      );
      console.error(
        '  Then: docker compose -f packages/twenty-docker/docker-compose.dev.yml port db 5432',
      );
    }
  }
  process.exit(1);
});
NODE
)

echo "=> Running twenty-server core migrations (includes CRM call log)..."
npx nx run twenty-server:database:migrate

echo "=> CRM persistence is enabled (core.crmCallLog + enums)."
echo "   UI: Settings → CRM (User history, NIPT history, Admin dashboard for admins)."
echo "   Full stack: yarn crm:dev (migrations + API + worker + frontend)."
echo "   Optional with API up: npx nx run twenty-front:graphql:generate"
