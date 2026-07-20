# Deploy API to cPanel from GitHub Actions (mltplc)

Goal: deploy `api/` to **mltplc.com** over **FTPS** without touching live SQLite.  
perloss.com is out of scope until a later pass (different remote path — see below).

Tarball remains a **manual emergency** path; see [CLOUD_BACKEND_DEPLOY_SAFETY.md](./CLOUD_BACKEND_DEPLOY_SAFETY.md).

## GitHub secrets (mltplc FTPS)

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `MLTPLC_HOST` | From cPanel → FTP Accounts → Configure FTP Client (e.g. `ftp.mltplc.com`) |
| `MLTPLC_USERNAME` | `mltplcpi` |
| `MLTPLC_PASSWORD` | cPanel password |

Optional (SSH step — enable after provider turns on shell access):

| Secret | Value |
|--------|--------|
| `MLTPLC_SSH_KEY` | Private key (preferred over password for SSH) |
| `MLTPLC_SSH_PORT` | From cPanel SSH Access (often `22`) |
| `MLTPLC_SSH_HOST` | Optional. If SSH rejects `ftp.mltplc.com`, use `mltplc.com` (or the hostname cPanel SSH Access shows) |

Do **not** put these values in chat, commits, or workflow YAML.

**Do not reuse** `DOWNLOADS_*` (those are for `server.masatechplc.com` installer publish).

## Remote layout (already live from tarball)

**mltplc.com** (this workflow):

```text
~/network-desktop-app/
  api/                   ← FTPS target (code)
  db/pharmasuit_lan.db   ← LIVE data — never synced
```

**perloss.com** (later — do not use mltplc paths):

```text
~/network-app/
  api/                   ← FTPS target when we add PERLOSS_* secrets
  db/pharmasuit_lan.db   ← LIVE data — never synced
```

Same code branch; different `server-dir` / home layout per tenant. Production `DB_FILE` on each host must point at that site’s sibling live file, not a path under `api/`.

## What the workflow does

Workflow: **Deploy API (mltplc)** (`.github/workflows/deploy.yml`)

1. Refuses to run if any `*.db` exists under `api/` in the checkout
2. FTPS sync `api/` → `network-desktop-app/api/` with excludes for `.env`, `*.db`, `uploads/`, `node_modules/`, …
3. Optional SSH (manual input `run_ssh`): `npm install --omit=dev`, optional `migrate`, `touch tmp/restart.txt`

`dangerous-clean-slate` is **false** so remote-only files are not wiped.

## Safe first test

1. Actions → **Deploy API (mltplc)** → **Run workflow**
2. Leave **dry-run = true** (default) — lists planned FTPS changes only
3. Confirm the list does **not** include any `.db` / live data paths
4. Re-run with **dry-run = false**
5. Until SSH is ready: **cPanel → Setup Node.js App → Restart**
6. Smoke-test login against mltplc

Leave **run_ssh** / **run_migrate** off until SSH works. Migrate changes schema *inside* the live file; it does not replace the file — still use only when you intend schema updates.

## Push trigger

Pushes to `cloud-backend` that touch `api/**` run a **real** FTPS sync (not dry-run), still **without** SSH/migrate. Editing only this workflow file does **not** auto-deploy. Prefer a manual dry-run once before relying on push.

## If it fails

| Symptom | Likely fix |
|---------|------------|
| FTPS login / TLS errors | Confirm `MLTPLC_HOST` is `ftp.mltplc.com`; password correct |
| Wrong remote folder | Confirm File Manager has `network-desktop-app/api/package.json` |
| App not picking up code | Restart Node app in cPanel (or enable SSH + `run_ssh`) |
| SSH timeout | Enable SSH; set `MLTPLC_SSH_PORT`; prefer `MLTPLC_SSH_KEY` |
| Knex reads `._*.js` | Workflow deletes `db/**/._*` on SSH; avoid uploading Mac junk |

## Related

- [CLOUD_BACKEND_DEPLOY_SAFETY.md](./CLOUD_BACKEND_DEPLOY_SAFETY.md) — why tarball once wiped DB
- `scripts/pack-cloud-backend-api.sh` — emergency pack (no `.db`)
