# Product lines — policy & release matrix

This repo ships **three related products** from **three long-lived branches**. Shared code makes it easy to fix one product and break another. Follow this policy until we move to a single trunk with build profiles (see [BRANCHING.md](BRANCHING.md)).

## Canonical map

| Label (use in PRs) | Product | Long-lived branch | Desktop tag prefix | Update / download feed | API host |
|--------------------|---------|-------------------|--------------------|------------------------|----------|
| `[Managed]` | Managed Cloud (multi-tenant SaaS) | `feature/cloud-multi-tenant` | `desktop-cloud-v*` | `…/downloads/cloud-multi/` | `server.masatechplc.com` (Postgres) |
| `[Dedicated]` | Dedicated Cloud (single-tenant) | `cloud-backend` | `desktop-dedicated-v*` (preferred); legacy `desktop-lan-v*` still used | `…/downloads/lan/` | Customer cPanel hosts (SQLite) |
| `[LAN]` | Offline LAN (bundled API) | `sqlite3-windows-debugged` | `desktop-offline-v*` (preferred) | **Must not** share Dedicated’s `lan` feed long-term — target `…/downloads/offline/` | None (local SQLite in installer) |

`main` is **not** a product trunk. Do not ship or validate product work from `main` unless the task is explicitly about shared ops (e.g. download restore workflows).

Website first-install links: [masatechplc.com/downloads](https://masatechplc.com/downloads) (Managed → `cloud-multi`, Dedicated → `lan`). In-app updates use each product’s `latest.json` / electron-updater yml on its feed path.

## Hard rules

1. **One product per change.** PR title starts with `[Managed]`, `[Dedicated]`, or `[LAN]`. Base branch must match the table above.
2. **No cross-product drive-bys.** Do not mix Managed/Dedicated/LAN fixes in one PR “while you’re here.”
3. **Do not merge** Managed ↔ Dedicated (Postgres/tenants vs SQLite cPanel). Only **cherry-pick** with the checklist below.
4. **Pin agents and local work** to the product branch named in the task. Do not auto-commit WIP from another product line onto the active branch.
5. **Ship gate is per product:** green release workflow for *that* branch’s tag, then verify *that* product’s `latest.json` version (and website links if first-install URLs changed).

## Tag & feed hygiene (prevent overwrites)

| Risk | Policy |
|------|--------|
| Dedicated and Offline both used `desktop-lan-v*` → `downloads/lan/` | New Offline tags: `desktop-offline-v*`. Move Offline publish to `downloads/offline/` before the next Offline release. Dedicated keeps `downloads/lan/` for now. |
| Managed vs Dedicated same Electron `appId` (`com.masatech.pharmasuit`) | Feeds **must** stay separate (`cloud-multi` vs `lan`). Never point a Managed build at the Dedicated update URL (or the reverse). |
| Misleading “lan” name on Dedicated | Prefer tags `desktop-dedicated-v*`; update website/docs when renaming. Legacy `desktop-lan-v*` may still exist on `cloud-backend` until workflows are renamed. |

## Cherry-pick checklist

Before cherry-picking a commit onto another product branch, confirm each item and **adapt** if it differs:

- [ ] Build mode: `dev` / `build` vs `dev:cloud` / `build:cloud`; `VITE_CLOUD_MODE` / `IS_CLOUD_BUILD` (hardcoded vs injected)
- [ ] Electron builder config (`electron-builder.json5` vs `electron-builder.cloud.json5`); bundled API `extraResources` (LAN only)
- [ ] `appId` / `productName` / artifact names
- [ ] Update feed URL (`CLOUD_UPDATES_URL` / `VITE_CLOUD_UPDATES_URL`)
- [ ] DB assumptions (Postgres + tenants vs SQLite; no tenant `client_code` on Dedicated/LAN)
- [ ] Deploy path (Managed tarball + cPanel Node vs Dedicated FTPS API vs LAN installer-only)
- [ ] Tests that encode product-specific behavior still pass on the **target** branch

If more than two checklist items need rewriting, prefer a small native fix on the target branch instead of a blind cherry-pick.

## PR checklist (copy into description)

```text
- [ ] PR title prefixed [Managed] | [Dedicated] | [LAN]
- [ ] Base branch matches product table
- [ ] No unrelated product changes in this PR
- [ ] If cherry-pick: checklist above completed
- [ ] Local verify: correct npm script for this product
- [ ] If release: tag prefix + feed path match product; latest.json checked on the right URL
```

## Local verify (quick)

| Product | Branch | Dev | Build |
|---------|--------|-----|-------|
| Managed | `feature/cloud-multi-tenant` | `cd app && npm run dev:cloud` | `npm run build:cloud` |
| Dedicated | `cloud-backend` | `cd app && npm run dev:cloud` | `npm run build:cloud` |
| LAN Offline | `sqlite3-windows-debugged` | `cd app && npm run dev` | `npm run build` |

After Managed connect/bootstrap, Electron should log API base for `server.masatechplc.com` (not `localhost`) when using a saved Managed client config.

## Release pointers

- Managed ship checklist: [DOWNLOADS_AND_UPDATES.md](DOWNLOADS_AND_UPDATES.md)
- Managed API tarball: [MULTI_TENANT_TARBALL_DEPLOY.md](MULTI_TENANT_TARBALL_DEPLOY.md)
- Branch overview: [BRANCHING.md](BRANCHING.md)

## Future (single trunk)

When Managed is stable enough to be the maintenance trunk: merge `feature/cloud-multi-tenant` → `main`, then ship **three build profiles** (LAN / cloud-single / cloud-multi) from one codebase instead of three diverging trees. Until then, this policy is the safety net.
