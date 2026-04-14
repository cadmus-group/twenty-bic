#!/usr/bin/env bash
# Production-oriented bootstrap: env + DB/Redis checks, then core DB migrations.
# Does not start processes — use your process manager after building artifacts.
# Usage: from repo root — bash packages/twenty-utils/deploy-bootstrap.sh
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_directory/../.." && pwd)"

bash "$script_directory/deploy-preflight.sh"
cd "$repository_root"
echo '=> Running database migrations (twenty-server)…'
npx nx run twenty-server:database:migrate

cat <<'EOF'

=> Bootstrap finished.

Next (typical VPS, same machine as the repo):

  1) Build shared + server + front (production):
       NODE_ENV=production npx nx run twenty-shared:build
       NODE_ENV=production npx nx run twenty-server:build
       NODE_ENV=production npx nx run twenty-front:build

  2) Run API (from packages/twenty-server, after build):
       NODE_ENV=production node dist/main.js

  3) Run worker (separate process):
       NODE_ENV=production node dist/queue-worker/queue-worker.js

  4) Serve static UI (example — tune host/port):
       npx nx run twenty-front:serve
     Or put packages/twenty-front/build behind nginx/Caddy; see
     packages/twenty-utils/examples/ and packages/twenty-utils/DEPLOY-RUNBOOK.md

  Health: GET /healthz on the API (liveness). Optional preflight with API up:
       TWENTY_PREFLIGHT_HTTP=1 bash packages/twenty-utils/deploy-preflight.sh

  Smoke (healthz + public client-config; optional front URL from .env):
       yarn deploy:smoke

  PM2 (after builds — see packages/twenty-utils/ecosystem.config.js):
       yarn deploy:pm2:start
       yarn deploy:smoke

EOF
