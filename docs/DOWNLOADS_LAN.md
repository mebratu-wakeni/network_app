# Single-tenant cloud installers (`downloads/lan`)

`cloud-backend` desktop clients (no tenant/`client_code`) publish here.

| Channel | URL | Secret |
|---------|-----|--------|
| Single-tenant cloud | https://server.masatechplc.com/downloads/lan/ | `DOWNLOADS_LAN_SERVER_DIR` = `server.masatechplc.com/downloads/lan/` |
| Multi-tenant | https://server.masatechplc.com/downloads/cloud-multi/ | `DOWNLOADS_SERVER_DIR` |

Connect UX: **Server URL only**, then username/password. No tenant code.

Tag: `desktop-lan-v*` on branch `cloud-backend` → workflow **Release LAN Desktop** (`npm run build:cloud`).
