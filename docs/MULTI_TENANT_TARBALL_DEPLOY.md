# Redeploy `server.masatechplc.com` (API + admin)

**Preferred release path:** bump `app/package.json`, tag `desktop-cloud-vX.Y.Z`, wait for **Release Managed Cloud**. Download `masatech-deploy.tar.gz` from that GitHub Release (same tag also publishes desktop installers). Full checklist: [`DOWNLOADS_AND_UPDATES.md`](DOWNLOADS_AND_UPDATES.md) → *Ship Managed Cloud*.

This doc is the **cPanel extract / restart** half (and local pack for API-only hotfixes).

Your live layout (cPanel):

```text
/home/masatetw/server.masatechplc.com/
  api/                      ← Node application root
  masatech-admin/           ← admin SPA (dist served at /admin)
  masatech-deploy.tar.gz    ← extract in THIS folder
```

That is **`masatech-deploy.tar.gz`**, not a flat `api.tar.gz`.

**You do not need cPanel Terminal** for this redeploy. Use File Manager + Setup Node.js App + phpPgAdmin.

## Pack on your Mac (API-only / hotfix)

Prefer the GitHub Release asset from **Release Managed Cloud** when shipping a versioned release. Local pack remains useful when you need an API hotfix without a desktop bump:

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
./downloads/cloud-multi/index.html   ← downloads page seed
./downloads/cloud-multi/latest.json
```

Pack excludes (same idea as the previous live tarball): **`._*`** (macOS AppleDouble), **`.DS_Store`**, and **all `*.md`**. The pack script fails if any of those slip into the archive.

## Step 1 — Upload + extract (File Manager)

1. In cPanel open **File Manager**.
2. Go to the domain root:  
   `home/masatetw/server.masatechplc.com/`  
   You should already see folders named `api` and `masatech-admin` here.
3. Upload `masatech-deploy.tar.gz` into **this same folder** (next to `api` and `masatech-admin`, not inside them).
4. Right-click `masatech-deploy.tar.gz` → **Extract**.
5. Confirm extract location is `server.masatechplc.com/` (domain root).

**Wrong:** open `api/` first, then extract there → creates nested `api/api/`.  
**Right:** extract at domain root → updates existing `api/` and `masatech-admin/`.

Optional: delete the uploaded `.tar.gz` after a successful extract to free space.

## Step 2 — Install packages + restart (Setup Node.js App)

1. In cPanel open **Setup Node.js App** (sometimes labeled **Application Manager**).
2. Find the app whose **Application root** is:  
   `server.masatechplc.com/api`  
   Startup file should be `startup.cjs`.
3. Click **Run NPM Install** (or equivalent). Wait until it finishes.  
   Do **not** run migrate scripts from this UI (they often OOM on this host).
4. Restart the app — pick one:
   - In Setup Node.js App: **Stop App**, then **Start App**, **or**
   - In File Manager: go to `server.masatechplc.com/api/tmp/`  
     (create the `tmp` folder if it is missing)  
     Create or edit a file named `restart.txt` and Save (empty is fine).  
     That tells the Node/Passenger process to reload.

Do **not** replace env vars. Keep your existing Postgres + `JWT_SECRET` settings. The tarball does not include `.env`.

## Step 3 — Database migration (phpPgAdmin)

1. On your Mac open:  
   `dist-release/sql/20260715120000_add_customer_code_to_customers.sql`
2. In cPanel open **PostgreSQL Databases** → **phpPgAdmin** (or your host’s Postgres tool).
3. Select the database used by this Node app.
4. Paste the SQL and **Execute** / **Go**.

That adds `customer_code`, backfills `CUST0001`…, and records the migration in `knex_migrations`.

Do **not** re-run the full `masatech-db-init-phpPgAdmin.sql` on a live DB (empty-init only).

If your host later enables Terminal/SSH, you can use `node scripts/migrate-lite.mjs` instead of Step 3 — not required.

## Verify

- https://server.masatechplc.com/health  
- https://server.masatechplc.com/api/db-health  
- https://server.masatechplc.com/admin  

## Not in the tarball’s job (desktop + website)

- Electron installers + update feed → same tag’s **Release Managed Cloud** publish job → `/downloads/cloud-multi/`
- First-install buttons on https://masatechplc.com/downloads → bump Managed URLs in `masatech-website/content/downloads.json` to the new `cloud-multi/X.Y.Z/` paths after the feed is live
