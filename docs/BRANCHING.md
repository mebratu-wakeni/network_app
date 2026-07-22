# Branch strategy

Three product lines, three long-lived branches. Eventually `feature/cloud-multi-tenant` becomes the single maintenance trunk (`main` / release).

**Day-to-day policy, tags, feeds, and cherry-pick rules:** see **[PRODUCT_LINES.md](PRODUCT_LINES.md)**.

| Branch | Product | API database | Deploy |
|--------|---------|--------------|--------|
| `cloud-backend` | Single-customer cloud (Dedicated) | SQLite on cPanel | **Tarball** / FTPS to cPanel + desktop to `downloads/lan/` |
| `feature/cloud-multi-tenant` | Multi-tenant SaaS (Managed) | PostgreSQL | **Tarball** to Postgres host + GitHub CI for **desktop** → `downloads/cloud-multi/` |
| `sqlite3-windows-debugged` | Offline LAN (bundled API) | SQLite local | GitHub CI for **desktop installers**; no cloud API deploy |

## Rules

- Multi-tenant / Managed work happens only on `feature/cloud-multi-tenant`.
- Do **not** merge multi-tenant into `cloud-backend` unless deliberately retiring single-cloud SQLite.
- `cloud-backend` tip before multi-tenant fork: commit `6e5eb5e`.
- Prefix PRs with `[Managed]`, `[Dedicated]`, or `[LAN]` and keep one product per PR ([PRODUCT_LINES.md](PRODUCT_LINES.md)).

## Future

When multi-tenant is stable, merge `feature/cloud-multi-tenant` → `main` and ship three **build profiles** (LAN / cloud-single / cloud-multi) from one codebase.
