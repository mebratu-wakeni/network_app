# Downloads and desktop auto-update

## Deployment model (important)

| Target | Method | GitHub Actions |
|--------|--------|----------------|
| **API on cPanel / Postgres host** | **Tarball** — build locally or in CI, upload archive, extract on server, `npm install`, `npm run migrate`, restart | Does **not** SSH/SFTP deploy to cPanel (not supported reliably) |
| **Desktop installers** (LAN, cloud-single, cloud-multi) | CI builds Mac/Windows/Linux; artifacts uploaded for you to place on download server | **Yes** — `.github/workflows/release-cloud-desktop.yml` |

Download/update hosting (Masatech): **`https://server.masatechplc.com/downloads/`**

## Three product channels (future)

| Channel | Path | Connect UI |
|---------|------|------------|
| `lan` | `/downloads/lan/` | Bundled API + SQLite |
| `cloud-single` | `/downloads/cloud-single/` | Server URL only |
| `cloud-multi` | `/downloads/cloud-multi/` | Server URL + tenant code |

**Phase 1 (now):** `cloud-multi` only.

## Server layout (cloud-multi)

```text
/downloads/cloud-multi/
  latest.json              # human-readable manifest (download page)
  latest-mac.yml           # electron-updater (macOS)
  latest.yml               # electron-updater (Windows)
  latest-linux.yml         # electron-updater (Linux)
  1.0.0/
    PharmaSuit-Cloud-Mac-1.0.0-Installer.dmg
    PharmaSuit-Cloud-Windows-1.0.0-Setup.exe
    PharmaSuit-Cloud-Linux-1.0.0.AppImage
```

### `latest.json` (example)

See `downloads/cloud-multi/latest.json.example`.

## Release workflow (desktop)

1. Bump `app/package.json` version (e.g. `1.0.0` → `1.0.1`).
2. Tag: `git tag desktop-cloud-v1.0.1 && git push origin desktop-cloud-v1.0.1`
3. GitHub Action **Release Cloud Desktop** builds three OS installers (artifacts on the run).
4. Copy installers + generated `latest*.yml` files to `server.masatechplc.com` under `/downloads/cloud-multi/` (manual or scripted upload — tarball/rsync/scp).
5. Installed apps check `https://server.masatechplc.com/downloads/cloud-multi/` on startup (packaged builds only).

Override feed URL at build time: `VITE_CLOUD_UPDATES_URL` / `CLOUD_UPDATES_URL`.

## In-app update UX (cloud-multi)

- Packaged cloud client checks for updates after launch.
- Dialog: “Update available — Install now?” → download → “Restart to finish”.
- Dev mode (`npm run dev:cloud`) skips update checks.

## Phase 2+

- Private `/downloads` page (password or masatech-admin link).
- Same pipeline for `lan` and `cloud-single` with separate `appId` and builder configs.
- Optional: API route to serve `latest.json` from the Postgres host (static files preferred).
