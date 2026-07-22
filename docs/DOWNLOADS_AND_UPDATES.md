# Downloads and desktop auto-update

## Deployment model

| Target | Method | GitHub Actions |
|--------|--------|----------------|
| **API (Postgres multi-tenant)** | **Tarball** on the server — extract, `npm install`, migrate, restart | No API deploy via CI to cPanel |
| **Desktop installers (cloud-multi)** | CI builds Mac/Windows/Linux **and uploads** to the downloads host | **Yes** — `.github/workflows/release-cloud-desktop.yml` |

Public downloads + update feed: **`https://server.masatechplc.com/downloads/cloud-multi/`**

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

## One-time server setup (remaining checklist)

1. **Redeploy API** that includes `/downloads` static serving (see `api/src/app.js`), then restart the Node app.
2. **Create the folder** in File Manager (domain root, sibling of `api/`):
   - `server.masatechplc.com/downloads/cloud-multi/`
3. **Put at least a page there** (until CI publishes real installers):
   - Upload repo file `downloads/cloud-multi/index.html` into that folder, **or**
   - Run a desktop release (step 5) which uploads `index.html` + manifests + installers.
4. **Restart** the Node app (Stop/Start or `api/tmp/restart.txt`) so it picks up the new `downloads/` directory if it was created after boot.
5. **GitHub Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Example | Purpose |
|--------|---------|---------|
| `DOWNLOADS_HOST` | FTP hostname (e.g. `masatechplc.com`) | FTP/FTPS host |
| `DOWNLOADS_USERNAME` | cPanel FTP user (e.g. `masatetw`) | Upload auth |
| `DOWNLOADS_PASSWORD` | FTP password | Upload auth |
| `DOWNLOADS_SERVER_DIR` | **`server.masatechplc.com/downloads/cloud-multi/`** | Remote path **relative to the FTP account home** (trailing slash) |

**Important:** `DOWNLOADS_SERVER_DIR` must be **relative to `/home/masatetw`**, not an absolute `/home/masatetw/...` path.

- Correct: `server.masatechplc.com/downloads/cloud-multi/`
- Wrong: `/home/masatetw/server.masatechplc.com/downloads/cloud-multi/`  
  (FTP treats that as a second `home/masatetw/...` nest — “ghost” files that search finds but the live site never serves)

After changing the secret, re-run **Release Cloud Desktop** (or move the installers from the nested junk path into the real `server.masatechplc.com/downloads/cloud-multi/1.0.0/` folder).

6. **Publish installers**: bump `app/package.json` version → tag `desktop-cloud-vX.Y.Z` → Action **Release Cloud Desktop** uploads the bundle.

7. **Verify**:
   - https://server.masatechplc.com/downloads/cloud-multi/  → HTML page (not JSON)
   - https://server.masatechplc.com/downloads/cloud-multi/1.0.0/…Installer… → real download
   - https://server.masatechplc.com/downloads/cloud-multi/latest.json

Optional env override: `DOWNLOADS_STATIC_DIR` = absolute path to the `downloads` directory (parent of `cloud-multi/`) on the **Node** host — unrelated to the FTP secret.

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

(`latest-mac.yml` / `latest.yml` / `latest-linux.yml`). Users get a banner/wizard to download and restart.

Policy in `latest.json`:
- `mandatory: true` — required update UI (no permanent Later)
- `minSupportedVersion` — clients below this version also get a required update

### Hard API floor (optional)

Set on the **API host** (cPanel env), then restart Node:

```bash
MIN_SUPPORTED_CLIENT_VERSION=1.0.3
```

Desktop clients send `X-Client-Version` on every `/api` call. Older clients get **HTTP 426** `CLIENT_OUTDATED` and the app opens the required updater. Leave unset to allow all versions. Keep this in sync with `latest.json` `minSupportedVersion` when you force an upgrade.

Dev (`npm run dev:cloud`) does not check for updates (use the Updater test panel).

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
