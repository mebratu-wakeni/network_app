# Multi-tenant cloud — tarball deploy (API + admin)

Target: **https://server.masatechplc.com**

| URL | What |
|-----|------|
| `/health`, `/api/...` | Multi-tenant API (Postgres) |
| `/admin` | masatech-admin (tenant management SPA) |
| `/downloads/cloud-multi/` | Electron installers (separate GitHub Actions flow) |

cPanel does **not** use GitHub→API CI. You upload a **tarball**.

## What the tarball contains

- Full `api/` application source (no `node_modules`, no `.env`, no local DB/uploads)
- Built **masatech-admin** as `admin-dist/` (served at `/admin`)
- `startup.cjs` for LiteSpeed/cPanel Node launcher
- Migrations + seeds

It does **not** contain Electron installers.

## Prepare the tarball (on your Mac, from this branch)

```bash
cd /path/to/network-desktop-app
git checkout feature/cloud-multi-tenant
git pull

chmod +x scripts/pack-multi-tenant-tarball.sh
./scripts/pack-multi-tenant-tarball.sh
```

Output under `dist-release/`:

| File | Use |
|------|-----|
| `pharmasuit-multi-tenant-api-*-TIMESTAMP.tar.gz` | Extract **into** existing `api/` directory |
| `pharmasuit-multi-tenant-api-*-TIMESTAMP-nested.tar.gz` | Extract at parent so it creates `./api/` |
| `DEPLOY.txt` | Same checklist as below |

## Server env (cPanel Node app — do not put secrets in the tarball)

Confirm these are set on the host (Node.js App → Environment):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` or `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` | **Postgres** |
| `JWT_SECRET` | Strong random; shared by tenant + platform admin JWTs |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | Optional; include `https://server.masatechplc.com` if needed |
| `PORT` | Whatever cPanel assigns |

Startup file: **`startup.cjs`**

## Deploy steps

1. **Backup** Postgres and the current `api/` folder.
2. Upload the flat tarball via File Manager / SFTP.
3. Extract into the Node application directory:

```bash
cd ~/network-desktop-app/api   # adjust to your real path
tar -xzf ~/path/to/pharmasuit-multi-tenant-api-….tar.gz
```

4. Install and migrate:

```bash
npm install --production
npm run migrate
```

5. **First deploy only** — if no platform admin exists yet:

```bash
npm run seed
# default: masaadmin / changeme123  → change immediately in /admin
```

6. Restart the Node app (`touch tmp/restart.txt` or cPanel Restart).

## Verify

```bash
curl -sS https://server.masatechplc.com/health
curl -sS https://server.masatechplc.com/api/db-health
```

Browser:

- https://server.masatechplc.com/admin — login as platform admin  
- Create/suspend tenants as needed  
- Electron clients use server URL + **tenant code** against this host  

## After API is live — desktop downloads (optional next)

Desktop installers are **not** in the tarball. When ready:

1. Set GitHub secrets `DOWNLOADS_*`  
2. Tag `desktop-cloud-v1.0.0` → Actions builds + FTPS to `/downloads/cloud-multi/`  

See [DOWNLOADS_AND_UPDATES.md](./DOWNLOADS_AND_UPDATES.md).
