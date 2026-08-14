# Branch strategy

**Operating model:** three product **`release/*`** branches; short-lived fix/feature branches; merge → tag → publish.

Full policy: **[PRODUCT_LINES.md](PRODUCT_LINES.md)**.

| Product branch | Product | Legacy name (transition) |
|----------------|---------|--------------------------|
| `release/managed-cloud` | Managed Cloud (Postgres SaaS) | `feature/cloud-multi-tenant` |
| `release/dedicated-cloud` | Dedicated Cloud (SQLite cPanel) | `cloud-backend` |
| `release/offline-lan` | Offline LAN (bundled API) | `sqlite3-windows-debugged` |

## Rules

- New work: branch off the matching `release/*`, PR back into that `release/*` (title `[Managed]` / `[Dedicated]` / `[LAN]`).
- Do **not** merge Managed ↔ Dedicated unless deliberately retiring one line.
- Do **not** use `main` as a product trunk.
- Publish desktops by tagging from the product release tip (`desktop-cloud-v*` / `desktop-dedicated-v*` / `desktop-offline-v*`).

## Future

When multi-tenant is stable, promote Managed into a single trunk and ship three **build profiles** from one codebase.
