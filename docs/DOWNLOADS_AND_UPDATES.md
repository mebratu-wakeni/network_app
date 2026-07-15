# Downloads and desktop auto-update

## Deployment model

| Target | Method | GitHub Actions |
|--------|--------|----------------|
| **API (Postgres multi-tenant)** | **Tarball** on the server — extract, `npm install`, migrate, restart | No API deploy via CI to cPanel |
| **Desktop installers (cloud-multi)** | CI builds Mac/Windows/Linux **and uploads** to the downloads host | **Yes** — `.github/workflows/release-cloud-desktop.yml` |

Public downloads + update feed: **`https://server.masatechplc.com/downloads/cloud-multi/`**

## One-time server setup

1. Create a web-visible folder on the host, for example:
   - `public_html/downloads/cloud-multi/`
2. Ensure that URL opens over HTTPS (no directory listing required; `index.html` is the page).
3. Add GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Example | Purpose |
|--------|---------|---------|
| `DOWNLOADS_HOST` | `server.masatechplc.com` | FTP/FTPS host |
| `DOWNLOADS_USERNAME` | cPanel FTP user | Upload auth |
| `DOWNLOADS_PASSWORD` | FTP password | Upload auth |
| `DOWNLOADS_SERVER_DIR` | `public_html/downloads/cloud-multi/` | Remote path (trailing slash) |

You can reuse the same host/credentials as other FTP accounts; keep `DOWNLOADS_SERVER_DIR` pointed only at the downloads folder (not the API tree).

Protocol in the workflow is **FTPS**. If your host needs plain FTP or SFTP, change `protocol:` in the publish step of `release-cloud-desktop.yml`.

## Release layout (after CI publish)

```text
/downloads/cloud-multi/
  index.html                 # Downloads page (loads latest.json)
  latest.json                # Version + Mac/Win/Linux URLs
  latest-mac.yml             # electron-updater (macOS)
  latest.yml                 # electron-updater (Windows)
  latest-linux.yml           # electron-updater (Linux)
  1.0.0/
    PharmaSuit-Cloud-Mac-1.0.0-Installer.dmg
    PharmaSuit-Cloud-Windows-1.0.0-Setup.exe
    PharmaSuit-Cloud-Linux-1.0.0.AppImage
    *.blockmap
```

## How to publish a new desktop version (fully automatic)

On `feature/cloud-multi-tenant`:

1. Bump `"version"` in `app/package.json` (e.g. `1.0.0` → `1.0.1`).
2. Commit and push the branch.
3. Tag and push:

```bash
git tag desktop-cloud-v1.0.1
git push origin feature/cloud-multi-tenant
git push origin desktop-cloud-v1.0.1
```

4. GitHub Action **Release Cloud Desktop**:
   - Builds installers on macOS, Windows, and Linux runners
   - Runs `scripts/prepare-cloud-multi-release.mjs`
   - Uploads the publish bundle to `DOWNLOADS_SERVER_DIR`

5. Verify:
   - Page: https://server.masatechplc.com/downloads/cloud-multi/
   - Manifest: https://server.masatechplc.com/downloads/cloud-multi/latest.json

Optional: Actions → **Release Cloud Desktop** → Run workflow (uses `app/package.json` version if no tag).

## In-app updates

Packaged cloud clients call `initCloudAutoUpdater()` and poll:

`https://server.masatechplc.com/downloads/cloud-multi/`

(`latest-mac.yml` / `latest.yml` / `latest-linux.yml`). Users get a dialog to download and restart.

Dev (`npm run dev:cloud`) does not check for updates.

Override feed at build time: `VITE_CLOUD_UPDATES_URL`.

## Local dry-run (prepare only)

```bash
# After a local npm run build:cloud
node scripts/prepare-cloud-multi-release.mjs \
  --version 1.0.0 \
  --artifacts-dir app/release-cloud \
  --out-dir /tmp/cloud-multi-publish
```

Inspect `/tmp/cloud-multi-publish` before relying on CI upload.

## Channels (later)

| Channel | Path | Status |
|---------|------|--------|
| `cloud-multi` | `/downloads/cloud-multi/` | **This workflow** |
| `cloud-single` | `/downloads/cloud-single/` | Planned |
| `lan` | `/downloads/lan/` | Planned |

## Repo files

| Path | Role |
|------|------|
| `downloads/cloud-multi/index.html` | Downloads page template |
| `scripts/prepare-cloud-multi-release.mjs` | Bundle installers + manifests |
| `.github/workflows/release-cloud-desktop.yml` | Build + FTP publish |
| `app/electron/cloudUpdater.js` | In-app update UI |
