# Deploy API to cPanel from GitHub Actions

Goal: FTPS-sync `api/` to dedicated-cloud hosts **without** touching live SQLite.  
After each real upload: **cPanel → Setup Node.js App → Restart** (SSH is not used).

Tarball remains a **manual emergency** path; see [CLOUD_BACKEND_DEPLOY_SAFETY.md](./CLOUD_BACKEND_DEPLOY_SAFETY.md).

## GitHub secrets (names must match the workflow)

Repo → **Settings → Secrets and variables → Actions**.  
Use these **exact** names (same as in `.github/workflows/deploy.yml`):

### mltplc.com

| Secret | Value |
|--------|--------|
| `MLTPLC_HOST` | From cPanel → FTP Accounts → Configure FTP Client (e.g. `ftp.mltplc.com`) |
| `MLTPLC_USERNAME` | cPanel/FTP user (e.g. `mltplcpi`) |
| `MLTPLC_PASSWORD` | cPanel password |

### perloss.com

| Secret | Value |
|--------|--------|
| `PERLOSS_HOST` | From perloss cPanel → Configure FTP Client (often `ftp.perloss.com` or as shown) |
| `PERLOSS_USERNAME` | perloss cPanel/FTP user |
| `PERLOSS_PASSWORD` | that account’s password |

Do **not** put these values in chat, commits, or workflow YAML.  
Do **not** reuse `DOWNLOADS_*` (those are for `server.masatechplc.com` installer publish).

## Remote layouts (do not mix)

**mltplc.com**

```text
~/network-desktop-app/
  api/                   ← FTPS → network-desktop-app/api/
  db/pharmasuit_lan.db   ← LIVE — never synced
```

**perloss.com**

```text
~/network-app/
  api/                   ← FTPS → network-app/api/
  db/pharmasuit_lan.db   ← LIVE — never synced
```

Same `cloud-backend` code; different `server-dir` and secrets per tenant.  
Production `DB_FILE` on each host must point at that site’s sibling live file, not under `api/`.

## Workflow

**Deploy API (cPanel)** (`.github/workflows/deploy.yml`)

| Manual input | Meaning |
|--------------|---------|
| `target` | `mltplc` / `perloss` / `both` |
| `dry_run` | default `true` — list FTPS changes only |

1. Refuses to run if any `*.db` exists under `api/` in the checkout  
2. FTPS sync with excludes (`.env`, `*.db`, `uploads/`, `node_modules/`, …)  
3. `dangerous-clean-slate: false`  
4. You restart Node in that site’s cPanel  

Push to `cloud-backend` touching `api/**` auto-deploys **mltplc only** (real sync, not dry-run). perloss stays manual until you’ve dry-run it once.

## Safe first test (perloss)

1. Add the three `PERLOSS_*` secrets (from perloss **Configure FTP Client**)  
2. Actions → **Deploy API (cPanel)** → **Run workflow**  
3. `target = perloss`, **dry-run = true**  
4. Confirm planned paths under `network-app/api/` only — no `.db`  
5. Re-run with **dry-run = false**  
6. **perloss cPanel → Setup Node.js App → Restart**  
7. Smoke-test login  

## If it fails

| Symptom | Likely fix |
|---------|------------|
| Missing secret | Add `PERLOSS_HOST` / `USERNAME` / `PASSWORD` (exact names) |
| FTPS login / TLS | Use hostname from Configure FTP Client, not a guess |
| Wrong folder | mltplc = `network-desktop-app/api/`; perloss = `network-app/api/` |
| App not updating | Restart Node app in that site’s cPanel after real sync |

## Related

- [CLOUD_BACKEND_DEPLOY_SAFETY.md](./CLOUD_BACKEND_DEPLOY_SAFETY.md)
- `scripts/pack-cloud-backend-api.sh`
