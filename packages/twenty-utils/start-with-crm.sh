#!/usr/bin/env bash
# Core CRM migrations, then full dev stack (API + worker + Vite front).
# From repo root: yarn crm:dev
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ ! -f "$REPO_ROOT/nx.json" ]]; then
  echo "error: nx.json not found at $REPO_ROOT (wrong script location)." >&2
  exit 1
fi

cd "$REPO_ROOT"

bash "$SCRIPT_DIR/enable-crm.sh"

echo "=> Starting dev stack (API first, then web + worker after :3000 is up)…"
exec yarn start
