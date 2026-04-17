# Twenty (twenty-bic) — short deploy runbook

For a **VPS** (Docker or bare Node): keep Postgres and Redis reachable from the app,
set strong secrets, run migrations on each release, and run **API + worker**
as separate processes.

Use **Docker Compose v2** (`docker compose`, not `docker-compose`). Dev scripts use
`docker compose up -d --build` so images stay current without a separate `build` step.

## One-command production (bare metal)

From the repo root (after Node + Yarn are installed):

```bash
chmod +x run-all.sh
./run-all.sh --profile production -- \
  --domain crm.example.com \
  --server-url https://crm.example.com \
  --frontend-url https://crm.example.com \
  --pg-url postgres://user:pass@127.0.0.1:5432/default \
  --redis-url redis://127.0.0.1:6379 \
  --app-secret "$(openssl rand -base64 32)"
```

Optional: `./run-all.sh --profile production --install-systemd -- …` appends
`--install-systemd` to the bare-metal script (requires `sudo` when that script installs the unit).

Dev infra only: `./run-all.sh` or `./run-all.sh --docker`.

## First deploy

1. Install Node (see root `package.json` `engines`), Yarn 4, and build tools.
2. Copy env files:
   - `packages/twenty-server/.env` from `.env.example`
   - `packages/twenty-front/.env` from `.env.example` — set
     `REACT_APP_SERVER_BASE_URL` to the public API URL (scheme + host, no path).
3. Set `NODE_ENV=production`, `PG_DATABASE_URL`, `REDIS_URL`, `APP_SECRET`,
   `FRONTEND_URL`, `SERVER_URL` (and email/auth vars as needed).
4. Preflight: `yarn deploy:check`
5. Migrate: `yarn deploy:bootstrap` (includes check + migrations)
6. Build and run API, worker, and static front (see `deploy-bootstrap.sh` footer).
7. **PM2** (optional): `packages/twenty-utils/ecosystem.config.js` runs API + worker
   from `packages/twenty-server/dist` (with `dotenv` loading `packages/twenty-server/.env`)
   and optionally serves the SPA from `packages/twenty-front/build` on `127.0.0.1:3001`.
   - Start: `yarn deploy:pm2:start` (requires `npx` and a prior production build).
   - Omit static app: `TWENTY_PM2_NO_FRONT=1 yarn deploy:pm2:start` if nginx serves `build/` directly.
   - Reload after a new build: `yarn deploy:pm2:reload`
   - Stop: `yarn deploy:pm2:stop` — remove from PM2: `yarn deploy:pm2:delete`
8. **Smoke test**: `yarn deploy:smoke` — hits `/healthz` and `/client-config`; if
   `FRONTEND_URL` is set (or `TWENTY_SMOKE_FRONT_URL`), also checks the front root.
9. Put **TLS + reverse proxy** in front (examples under `packages/twenty-utils/examples/`).
   Forward `X-Forwarded-Proto` / `Host` if the API needs correct public URLs.

## Upgrade

1. Pull the release; `yarn install` if lockfile changed.
2. `yarn deploy:check`
3. Rebuild server/front as you normally do for production.
4. `yarn deploy:migrate` (or `yarn deploy:bootstrap` — idempotent migrate).
5. Restart API and worker (`yarn deploy:pm2:reload` if using PM2); reload nginx/Caddy
   if config changed.
6. `yarn deploy:smoke` before switching traffic or closing the deploy.

## Rollback

- **App only**: redeploy previous image/commit and restart processes.
- **Database**: avoid `migration:revert` in production unless you know exactly
  which migration failed; prefer **restore from backup** if schema/data is wrong.

## Backups

- **Postgres**: scheduled `pg_dump` / managed backups; test restore periodically.
- **Files**: if `STORAGE_TYPE=local`, backup `STORAGE_LOCAL_PATH` with the DB.

## Staging parity

Use the same env shape as production (different URLs/secrets), run the same
`deploy:check` + `deploy:migrate` before promoting a release.
