# Product lines — release branches & workflow

This repo ships **three products**. Each has a long-lived **`release/*` product branch**. Day-to-day work happens on **short-lived fix/feature branches**; you merge to the product `release/*` branch, then **tag** to publish.

Legacy branch names (`feature/cloud-multi-tenant`, `cloud-backend`, `sqlite3-windows-debugged`) remain on the remote as mirrors for a transition period — **do not start new work on them**.

## Canonical map

| Label | Product | Product branch (merge target) | Desktop tag | Update / download feed | API |
|-------|---------|-------------------------------|-------------|------------------------|-----|
| `[Managed]` | Managed Cloud | `release/managed-cloud` | `desktop-cloud-v*` | `…/downloads/cloud-multi/` | `server.masatechplc.com` (Postgres) |
| `[Dedicated]` | Dedicated Cloud | `release/dedicated-cloud` | `desktop-dedicated-v*` (also accepts legacy `desktop-lan-v*`) | `…/downloads/lan/` | Customer cPanel (SQLite) |
| `[LAN]` | Offline LAN | `release/offline-lan` | `desktop-offline-v*` | `…/downloads/offline/` (secret `DOWNLOADS_OFFLINE_SERVER_DIR`) | Bundled local SQLite |

`main` is **not** a product trunk (ops/restore workflows only).

Website first-install: [masatechplc.com/downloads](https://masatechplc.com/downloads). In-app updates use each feed’s `latest.json` / electron-updater yml.

### Legacy aliases (read-only transition)

| Legacy branch | Use instead |
|---------------|-------------|
| `feature/cloud-multi-tenant` | `release/managed-cloud` |
| `cloud-backend` | `release/dedicated-cloud` |
| `sqlite3-windows-debugged` | `release/offline-lan` |

## How to work (every fix / feature)

```text
1. Start from the product release branch (never from main / never commit directly on release/* for long-running work)
     git fetch origin
     git checkout release/managed-cloud    # or dedicated-cloud / offline-lan
     git pull origin release/managed-cloud

2. Create a short-lived branch with a clear name
     git checkout -b fix/managed-api-base-url
     # patterns: fix/<product>-<slug> | feature/<product>-<slug> | chore/<product>-<slug>
     # Cloud agents: cursor/<slug>-d386 is fine if the PR title still has [Managed]|[Dedicated]|[LAN]

3. Implement + PR
     - PR title: [Managed] … / [Dedicated] … / [LAN] …
     - Base branch: the matching release/* product branch
     - One product per PR

4. Merge the PR into release/<product>

5. Publish (desktop / Managed API pack)
     - Bump app/package.json version on the release branch (or in the last PR)
     - Tag from the release tip and push the tag → GitHub Actions publishes
         git checkout release/managed-cloud && git pull
         git tag desktop-cloud-v1.0.4
         git push origin desktop-cloud-v1.0.4
```

Managed API still needs the **ops** half after CI: download `masatech-deploy.tar.gz` from the GitHub Release → cPanel extract → NPM Install → restart ([DOWNLOADS_AND_UPDATES.md](DOWNLOADS_AND_UPDATES.md)). Dedicated API FTPS may also run on push to `release/dedicated-cloud` (see that branch’s `deploy.yml`).

## Hard rules

1. **One product per change.** PR title `[Managed]` | `[Dedicated]` | `[LAN]`; base = matching `release/*`.
2. **No drive-bys** across products in one PR.
3. **Do not merge** Managed ↔ Dedicated (Postgres/tenants vs SQLite). Cherry-pick only with the checklist below.
4. **Do not commit long-running work on `release/*`.** Use a fix/feature branch → PR → merge.
5. **Tags publish.** Cutting a product tag from a commit that is **not** on that product’s `release/*` history will fail CI (guard job).
6. **Feeds stay separate.** Never point Managed builds at `downloads/lan` or Offline at `cloud-multi`.

## Tag & feed hygiene

| Product | Tag | Workflow (on that release branch) | Publish path |
|---------|-----|-----------------------------------|--------------|
| Managed | `desktop-cloud-v*` | `Release Managed Cloud` (`release-cloud-desktop.yml`) | `DOWNLOADS_SERVER_DIR` → `…/cloud-multi/` |
| Dedicated | `desktop-dedicated-v*` (+ legacy `desktop-lan-v*`) | `Release Dedicated Cloud` | `DOWNLOADS_LAN_SERVER_DIR` → `…/lan/` |
| Offline | `desktop-offline-v*` | `Release Offline LAN` | `DOWNLOADS_OFFLINE_SERVER_DIR` → `…/offline/` |

Offline must **not** keep publishing to `downloads/lan/` (that overwrote Dedicated). Set GitHub secret `DOWNLOADS_OFFLINE_SERVER_DIR=server.masatechplc.com/downloads/offline/` before the next Offline tag.

## Cherry-pick checklist

Before cherry-picking onto another product’s `release/*`:

- [ ] Build mode (`dev`/`build` vs `dev:cloud`/`build:cloud`; `IS_CLOUD_BUILD`)
- [ ] Electron builder + bundled API (LAN only)
- [ ] `appId` / artifact names / update feed URL
- [ ] DB (Postgres+tenants vs SQLite; no `client_code` on Dedicated/LAN)
- [ ] Deploy path / workflows for that product
- [ ] Tests pass on the **target** product branch

## PR checklist

```text
- [ ] Title prefixed [Managed] | [Dedicated] | [LAN]
- [ ] Base = release/managed-cloud | release/dedicated-cloud | release/offline-lan
- [ ] Branched from that release tip (not from main / not from another product)
- [ ] No unrelated product changes
- [ ] If cherry-pick: checklist above done
- [ ] If publishing: version bump + correct tag prefix; verify latest.json on the right feed
```

## Local verify

| Product | Branch | Dev | Build |
|---------|--------|-----|-------|
| Managed | `release/managed-cloud` | `cd app && npm run dev:cloud` | `npm run build:cloud` |
| Dedicated | `release/dedicated-cloud` | `cd app && npm run dev:cloud` | `npm run build:cloud` |
| Offline | `release/offline-lan` | `cd app && npm run dev` | `npm run build` |

## Related docs

- Managed ship: [DOWNLOADS_AND_UPDATES.md](DOWNLOADS_AND_UPDATES.md)
- Managed API tarball: [MULTI_TENANT_TARBALL_DEPLOY.md](MULTI_TENANT_TARBALL_DEPLOY.md)
- Short branch overview: [BRANCHING.md](BRANCHING.md)

## Future

When Managed is stable as the single maintenance trunk: fold profiles (LAN / cloud-single / cloud-multi) into one codebase. Until then, `release/*` + fix branches + tags is the operating model.
