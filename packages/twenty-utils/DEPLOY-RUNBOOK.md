# Twenty (twenty-bic) — short deploy runbook

For a **VPS** (Docker or bare Node): keep Postgres and Redis reachable from the app,
set strong secrets, run migrations on each release, and run **API + worker**
as separate processes.

## First deploy

1. Install Node (see root `package.json` `engines`), Yarn 4, and build tools.
2. Configure bare-metal env and generated configs (recommended):
   - `yarn deploy:bare-metal:configure -- --domain crm.example.com --server-url https://crm.example.com --frontend-url https://crm.example.com --pg-url postgres://... --redis-url redis://... --app-secret "<strong-secret>"`
   - This updates `packages/twenty-server/.env`, `packages/twenty-front/.env`, and generates
     nginx/Caddy + `twenty-pm2.service` templates under `packages/twenty-utils/examples/generated/`.
3. Preflight: `yarn deploy:check`
4. Migrate: `yarn deploy:bootstrap` (includes check + migrations)
5. Build and run API, worker, and static front (see `deploy-bootstrap.sh` footer).
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
