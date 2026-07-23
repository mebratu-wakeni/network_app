# Downloads and desktop auto-update (Managed Cloud)

## Deployment model

| Target | Method | GitHub Actions |
|--------|--------|----------------|
| **API + admin (Postgres multi-tenant)** | **Tarball** extract on cPanel (`masatech-deploy.tar.gz`) | Packed + attached as a **GitHub Release asset** by the same release workflow |
| **Desktop installers (cloud-multi)** | CI builds Mac/Windows/Linux **and uploads** to the downloads host | Same workflow — FTPS to `DOWNLOADS_SERVER_DIR` |

Public downloads + update feed: **`https://server.masatechplc.com/downloads/cloud-multi/`**

Product-line policy (branches, tags, cherry-picks): [`PRODUCT_LINES.md`](PRODUCT_LINES.md).

> **Note:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) on this branch is a **legacy** Dedicated/SQLite SFTP stub. It does **not** deploy Managed Cloud (`server.masatechplc.com`).

## Ship Managed Cloud (API + app together)

One tag drives both the API pack and the desktop update feed.

Work on a short-lived branch off **`release/managed-cloud`**, merge the PR, then:

1. On `release/managed-cloud`, bump `"version"` in [`app/package.json`](../app/package.json) (e.g. `1.0.4` → `1.0.5`) if not already bumped in the PR.
2. Commit/push the release branch if needed.
3. Tag and push **from that tip**:

```bash
git checkout release/managed-cloud
git pull origin release/managed-cloud
git tag desktop-cloud-v1.0.5
git push origin desktop-cloud-v1.0.5
```

4. Wait for Action **Release Managed Cloud** (workflow file: `release-cloud-desktop.yml`) to go green. It will:
   - **Fail early** if the tag is not on `release/managed-cloud` (or legacy tip) or version ≠ `app/package.json`
   - Pack `masatech-deploy.tar.gz` and attach it (plus `DEPLOY.txt` / `sql/*`) to the **GitHub Release** for that tag
   - Build Mac / Windows / Linux installers and FTPS-publish to `downloads/cloud-multi/`

5. **API host (ops):** Download `masatech-deploy.tar.gz` from the GitHub Release → extract at **domain root** (`server.masatechplc.com/`, next to `api/`) → Setup Node.js App → **Run NPM Install** → **Restart** → run any new SQL from the Release `sql/` folder via phpPgAdmin if needed. Full steps: [`MULTI_TENANT_TARBALL_DEPLOY.md`](MULTI_TENANT_TARBALL_DEPLOY.md).

6. **Website first-install links:** Update Managed Cloud URLs in the company site [`masatech-website/content/downloads.json`](../../masatech-website/content/downloads.json) to `…/downloads/cloud-multi/X.Y.Z/…` for the new version, then deploy the website. In-app updates use `latest.json`; the website is for **new** installs.

7. **Verify:**
   - https://server.masatechplc.com/health → `{"ok":true}`
   - https://server.masatechplc.com/api/db-health → database online
   - https://server.masatechplc.com/downloads/cloud-multi/latest.json → `"version": "X.Y.Z"`
   - https://masatechplc.com/downloads → Managed buttons hit the new `X.Y.Z` installers

Optional: Actions → **Release Managed Cloud** → Run workflow (must still match `app/package.json`; creates/updates tag `desktop-cloud-v*` assets).

Policy inputs on manual run:
- `mandatory` — required in-app update
- `min_supported_version` — oldest client still allowed (written into `latest.json`)

## Why you see `{ ok: false, error: "Not Found" }`

`https://server.masatechplc.com` is the **Node app** (same as `/api` and `/admin`). Putting files under `public_html/` does **not** make them appear on this hostname. The API must serve `/downloads`, and the files must live next to `api/` on disk.

Target layout:

```text
/home/masatetw/server.masatechplc.com/
  api/
  masatech-admin/
  downloads/
    cloud-multi/
      index.html
      latest.json
      …
```

URL `…/downloads/cloud-multi/` → Express static → that folder.

## One-time server / secrets setup

1. **Redeploy API** that includes `/downloads` static serving (see `api/src/app.js`), then restart the Node app.
2. Ensure `server.masatechplc.com/downloads/cloud-multi/` exists (seeded by the tarball).
3. **GitHub Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Example | Purpose |
|--------|---------|---------|
| `DOWNLOADS_HOST` | FTP hostname (e.g. `masatechplc.com`) | FTP/FTPS host |
| `DOWNLOADS_USERNAME` | cPanel FTP user (e.g. `masatetw`) | Upload auth |
| `DOWNLOADS_PASSWORD` | FTP password | Upload auth |
| `DOWNLOADS_SERVER_DIR` | **`server.masatechplc.com/downloads/cloud-multi/`** | Remote path **relative to the FTP account home** (trailing slash) |

**Important:** `DOWNLOADS_SERVER_DIR` must be **relative to `/home/masatetw`**, not an absolute `/home/masatetw/...` path.

- Correct: `server.masatechplc.com/downloads/cloud-multi/`
- Wrong: `/home/masatetw/server.masatechplc.com/downloads/cloud-multi/`

Optional env override on the Node host: `DOWNLOADS_STATIC_DIR` = absolute path to the `downloads` directory (parent of `cloud-multi/`).

Protocol in the workflow is **FTPS**.

## Release layout (after CI publish)

```text
/downloads/cloud-multi/
  index.html                 # Downloads page (loads latest.json)
  latest.json                # Version + Mac/Win/Linux URLs
  latest-mac.yml             # electron-updater (macOS — must reference .zip)
  latest.yml                 # electron-updater (Windows)
  latest-linux.yml           # electron-updater (Linux)
  1.0.5/
    PharmaSuit-Cloud-Mac-1.0.5-Installer.dmg
    PharmaSuit-Cloud-Mac-1.0.5-Installer.zip   # required for in-app Mac updates
    PharmaSuit-Cloud-Windows-1.0.5-x64-Setup.exe
    PharmaSuit-Cloud-Linux-1.0.5.AppImage
    *.blockmap
```

## In-app updates

Packaged cloud clients call `initCloudAutoUpdater()` and poll:

`https://server.masatechplc.com/downloads/cloud-multi/`

(`latest-mac.yml` / `latest.yml` / `latest-linux.yml`). Users get a banner/wizard to download and restart.

**macOS requirements**
- Build publishes **both** `.dmg` (website / first install) and `.zip` (electron-updater).
- `latest-mac.yml` must point at the **zip**. A DMG-only feed will not show an in-app update.
- Apple Developer ID code signing (`CSC_LINK` / `CSC_KEY_PASSWORD` in CI) is strongly recommended; unsigned Mac auto-install often fails. If auto-update cannot run, the client still compares `latest.json` and offers a **Download installer** link.

**Footer version:** the app chrome footer shows `import.meta.env.VITE_APP_VERSION` / `app.getVersion()`, which match `app/package.json` and the installer filename (e.g. `…-1.0.5-…`). It must never be hard-coded.

Policy in `latest.json`:
- `mandatory: true` — required update UI (no permanent Later)
- `minSupportedVersion` — clients below this version also get a required update

Dev (`npm run dev:cloud`) does not check for updates (use the Updater test panel).

Override feed at build time: `VITE_CLOUD_UPDATES_URL`.

## Local dry-run

```bash
# API pack only
./scripts/pack-multi-tenant-tarball.sh

# Desktop prepare only (after a local npm run build:cloud)
node scripts/prepare-cloud-multi-release.mjs \
  --version 1.0.5 \
  --artifacts-dir app/release-cloud \
  --out-dir /tmp/cloud-multi-publish
```

## Channels

| Channel | Path | Status |
|---------|------|--------|
| `cloud-multi` | `/downloads/cloud-multi/` | **This workflow (Managed)** |
| `cloud-single` / `lan` | Dedicated / Offline | Separate branches & tags |

## Repo files

| Path | Role |
|------|------|
| `downloads/cloud-multi/index.html` | Downloads page template |
| `scripts/pack-multi-tenant-tarball.sh` | API + admin + downloads seed tarball |
| `scripts/prepare-cloud-multi-release.mjs` | Bundle installers + manifests |
| `scripts/assert-desktop-cloud-version.sh` | Tag / package.json version lock |
| `.github/workflows/release-cloud-desktop.yml` | **Release Managed Cloud** (API pack + desktop publish) |
| `app/electron/cloudUpdater.js` | In-app update UI |
