# Branch strategy

Three product lines, three long-lived branches. Eventually `feature/cloud-multi-tenant` becomes the single maintenance trunk (`main` / release).

| Branch | Product | API database | Deploy |
|--------|---------|--------------|--------|
| `cloud-backend` | Single-customer cloud | SQLite on cPanel | **Tarball** upload to cPanel (no GitHub→cPanel CI) |
| `feature/cloud-multi-tenant` | Multi-tenant SaaS | PostgreSQL | **Tarball** to Postgres host + GitHub CI for **desktop installers only** |
| `sqlite3-windows-debugged` | Offline LAN (bundled API) | SQLite local | GitHub CI for **desktop installers**; no cloud API deploy |

## Rules

- Multi-tenant work happens only on `feature/cloud-multi-tenant`.
- Do **not** merge multi-tenant into `cloud-backend` unless deliberately retiring single-cloud SQLite.
- `cloud-backend` tip before multi-tenant fork: commit `6e5eb5e`.

## Future

When multi-tenant is stable, merge `feature/cloud-multi-tenant` → `main` and ship three **build profiles** (LAN / cloud-single / cloud-multi) from one codebase.
