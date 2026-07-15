# Redeploy `server.masatechplc.com` (API + admin)

Your live layout (cPanel):

```text
/home/masatetw/server.masatechplc.com/
  api/                      ← Node application root
  masatech-admin/           ← admin SPA (dist served at /admin)
  masatech-deploy.tar.gz    ← extract in THIS folder
```

That is **`masatech-deploy.tar.gz`**, not a flat `api.tar.gz`.

## Pack on your Mac

```bash
cd /path/to/network-desktop-app
git checkout feature/cloud-multi-tenant
./scripts/pack-multi-tenant-tarball.sh
```

Produces:

| File | Role |
|------|------|
| `dist-release/masatech-deploy.tar.gz` | **Upload this** (also `./masatech-deploy.tar.gz`) |
| `dist-release/sql/*.sql` | Incremental SQL for phpPgAdmin |
| `dist-release/DEPLOY.txt` | Checklist |

Archive contents:

```text
./api/...
./masatech-admin/dist/...
```

## Extract (important)

1. Upload `masatech-deploy.tar.gz` into **`/home/masatetw/server.masatechplc.com/`**
2. Extract **there** (domain root) so it updates `api/` and `masatech-admin/`
3. **Do not** open `api/` and extract inside it → that creates `api/api/`

## After extract

```bash
cd /home/masatetw/server.masatechplc.com/api
npm install --production
mkdir -p tmp && touch tmp/restart.txt
```

cPanel Node app:

- Application root: `…/server.masatechplc.com/api`
- Startup: `startup.cjs`
- Keep existing Postgres + `JWT_SECRET` env (tarball has no `.env`)

## Database migrations (no `npm run migrate` in cPanel UI)

Knex JS migrations often cannot be run from the File Manager / package.json UI on this host. Use one of:

### Option A — SSH + migrate-lite (if Terminal/SSH works)

```bash
cd /home/masatetw/server.masatechplc.com/api
# activate nodeenv for this app, then:
node scripts/migrate-lite.mjs
```

(`migrate-lite.mjs` avoids the OOM from full `npm run migrate` on CloudLinux.)

### Option B — phpPgAdmin / cPanel → Databases (what you already use)

1. Open PostgreSQL for this app in cPanel Databases / phpPgAdmin  
2. Run incremental SQL from `dist-release/sql/`, e.g.:

   `20260715120000_add_customer_code_to_customers.sql`

3. That script adds `customer_code`, backfills `CUST0001`…, and records the migration in `knex_migrations`

Do **not** re-run the full `masatech-db-init-phpPgAdmin.sql` on a live DB (that is for empty init).

## Verify

- https://server.masatechplc.com/health  
- https://server.masatechplc.com/api/db-health  
- https://server.masatechplc.com/admin  

## Not in this tarball

Electron installers → GitHub Actions → `/downloads/cloud-multi/`
