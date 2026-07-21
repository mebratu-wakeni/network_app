# Single-tenant cloud installers (`downloads/lan`)

`cloud-backend` desktop clients (no tenant/`client_code`) publish here.

| Channel | URL | Secret |
|---------|-----|--------|
| Single-tenant cloud (Dedicated Cloud) | https://server.masatechplc.com/downloads/lan/ | `DOWNLOADS_LAN_SERVER_DIR` = `server.masatechplc.com/downloads/lan/` |
| Multi-tenant (Managed Cloud) | https://server.masatechplc.com/downloads/cloud-multi/ | `DOWNLOADS_SERVER_DIR` |

Connect UX: **Server URL only**, then username/password. No tenant code.

Tag: `desktop-lan-v*` on branch `cloud-backend` → workflow **Release LAN Desktop** (`npm run build:cloud`).

## In-app updates (Dedicated Cloud)

Packaged cloud builds use `electron-updater` against this feed:

- `latest.yml` / `latest-mac.yml` / `latest-linux.yml` — installer paths for the updater
- `latest.json` — UI policy used by the app:

```json
{
  "version": "1.0.3",
  "mandatory": false,
  "minSupportedVersion": "1.0.0",
  "releaseNotes": "…"
}
```

| Field | Effect in app |
|-------|----------------|
| `mandatory: false` | Banner with **Update now** / **Later** |
| `mandatory: true` | Required update (no permanent dismiss) |
| `minSupportedVersion` | If installed app is older, treat as required |

Prepare script flags:

```bash
node scripts/prepare-lan-release.mjs \
  --version 1.0.3 \
  --artifacts-dir ./staging/artifacts \
  --out-dir ./staging/publish \
  --notes "Bug fixes" \
  --mandatory \
  --min-supported-version 1.0.2
```

Feed URL is baked at build time (`VITE_CLOUD_UPDATES_URL`, default `https://server.masatechplc.com/downloads/lan`). Do not share the Managed Cloud (`cloud-multi`) feed — same `appId`.
