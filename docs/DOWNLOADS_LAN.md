# LAN offline installers (`downloads/lan`)

**PharmaSuit** single-tenant **online** cloud client (no bundled API) is published separately from cloud-multi so cloud installers are never overwritten.

| Channel | URL | GitHub secret (FTP dir) |
|---------|-----|-------------------------|
| Cloud multi-tenant | https://server.masatechplc.com/downloads/cloud-multi/ | `DOWNLOADS_SERVER_DIR` |
| **LAN offline** | https://server.masatechplc.com/downloads/lan/ | **`DOWNLOADS_LAN_SERVER_DIR`** |

## One-time setup

1. In File Manager create: `server.masatechplc.com/downloads/lan/` (sibling of `cloud-multi/`).
2. GitHub → Settings → Secrets → Actions — add:

| Secret | Value |
|--------|--------|
| `DOWNLOADS_HOST` / `USERNAME` / `PASSWORD` | Same FTP as cloud (reuse) |
| `DOWNLOADS_LAN_SERVER_DIR` | `server.masatechplc.com/downloads/lan/` |

**Relative path only** (no `/home/masatetw/...`). Never point this at `cloud-multi`.

3. The live API already serves anything under `downloads/` (including `lan/`) after the folder exists; restart Node if you just created `downloads/`.

## Publish a LAN build

On branch `cloud-backend`:

1. Bump `app/package.json` version if needed.
2. Commit and push.
3. Tag and push:

```bash
git tag desktop-lan-v1.0.0
git push origin cloud-backend
git push origin desktop-lan-v1.0.0
```

Workflow **Release LAN Desktop** builds Mac (universal) / Windows x64+ia32 / Linux and FTPs only into `downloads/lan/`.

## Verify

- https://server.masatechplc.com/downloads/lan/
- https://server.masatechplc.com/downloads/cloud-multi/  (must still show cloud builds)

## This release (1.0.0)

Build uses `npm run build:cloud` (universal Mac, Win x64+ia32). Product-create modal fix included on this branch.
