# Multi-tenant cloud — tarball redeploy (API + admin)

Target: **https://server.masatechplc.com**

| URL | What |
|-----|------|
| `/health`, `/api/...` | Multi-tenant API (Postgres) |
| `/admin` | masatech-admin SPA |
| `/downloads/cloud-multi/` | Electron installers (separate flow) |

## Packing (matches your existing `api.tar.gz` workflow)

```bash
cd /path/to/network-desktop-app
git checkout feature/cloud-multi-tenant
./scripts/pack-multi-tenant-tarball.sh
```

**Pack order (fixed):**

1. Build `masatech-admin` → `dist/`
2. Stage `api/` (no `.env`, no `node_modules`)
3. Copy admin into `admin-dist/` inside that stage
4. Write **`api.tar.gz`** (flat) + optional **`masatech-deploy.tar.gz`** (nested)

### Which archive?

| File | Layout | Extract where |
|------|--------|----------------|
| **`api.tar.gz`** (use this) | `./package.json`, `./src/`, `./admin-dist/`, … | **Into** Node app root (`…/api/` that already has `package.json`) — same as before |
| `masatech-deploy.tar.gz` | `./api/…` + `./masatech-admin/dist/…` | At **parent** of `api/` |

Wrong extract = `api/api/` nesting or missing `/admin`. Use **`api.tar.gz`** unless you intentionally use the parent layout.

## Redeploy steps

1. Backup Postgres + current `api/` on the server.
2. Upload `dist-release/api.tar.gz` (or repo-root `api.tar.gz` after pack).
3. On the server:

```bash
cd ~/network-desktop-app/api   # Application root = folder with package.json
tar -xzf /path/to/api.tar.gz
npm install --production
npm run migrate
mkdir -p tmp && touch tmp/restart.txt
```

4. First-time only (no platform admin): `npm run seed` then change password at `/admin`.
5. Verify: `/health`, `/api/db-health`, `/admin`.

**Do not** overwrite cPanel env (`.env` / Node env panel). The tarball has no secrets.

Startup file: **`startup.cjs`**.

## Verify archive before upload

```bash
tar -tzf dist-release/api.tar.gz | head
# expect: ./package.json  ./src/…  ./admin-dist/index.html  ./startup.cjs
# NOT:    ./api/package.json
```
