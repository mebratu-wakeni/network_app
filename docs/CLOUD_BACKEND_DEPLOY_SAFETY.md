# Cloud-backend deploy safety (cPanel + SQLite)

Lessons from the Jul 2026 single-tenant cloud redeploy incident.  
**Read this before packing or extracting `api.tar.gz` on a live customer host.**

## 1. Two different `db` folders (do not confuse them)

On a typical host (e.g. perlosgo / PERLOSS):

```text
/home/<user>/network-app/
  api/                         ← Node application root (package.json, src/, …)
    db/                        ← CODE only: migrations, seeds, knexfile.js
  db/
    pharmasuit_lan.db          ← LIVE customer SQLite (data)
    pharmasuit_lan.db-wal
    pharmasuit_lan.db-shm
```

| Path | Role |
|------|------|
| `network-app/api/db/` | Knex migrations / seeds / config — **code** |
| `network-app/db/pharmasuit_lan.db` | Live database — **data** |

Setup Node.js **`DB_FILE`** must point at the **live** file, e.g.:

```text
DB_FILE=/home/<user>/network-app/db/pharmasuit_lan.db
```

Default resolver (when `DB_FILE` is unset) is the same idea: **sibling of `api/`** → `../db/pharmasuit_lan.db`  
(see `api/db/resolve-db-file.js`).

Local development may set `DB_FILE` in `api/.env` to `api/db/pharmasuit_lan.db`. That override is **dev-only** — do not copy that into production env.

## 2. What went wrong (root cause)

### Old (unsafe) tarball layout — flat

```text
package.json
src/
db/migrations/…     ← top-level folder named "db"
db/pharmasuit_lan.db ← (bug) local SQLite was sometimes packed too
```

If this archive was extracted at **`network-app/`** (parent) instead of **`network-app/api/`**:

- Tarball `./db/*` landed on **`network-app/db/`**
- That is the **same folder as live `DB_FILE`**
- Migrations/knexfile appeared next to the SQLite file (timestamps looked like “redeploy touched data”)
- A packed local `pharmasuit_lan.db` could **overwrite customer data**

### What did *not* cause the wipe

- **Setup Node.js → Restart** does not recreate or replace the SQLite file. It may only update `.db-shm` / `.db-wal` mtimes when the app opens the DB.
- **Knex migrate** changes tables *inside* the `.db` file; it does not copy `migrations/` JS into the live data folder.

## 3. Current (safe) tarball layout — nested

Built by `scripts/pack-cloud-backend-api.sh`:

```text
api/package.json
api/src/
api/db/migrations/…   ← under api/ only
(no top-level ./db/)
(no *.db / *.db-wal / *.db-shm)
```

### Extract (mandatory)

Extract at the **parent** of the Node app (folder that contains both `api/` and live `db/`):

```bash
cd /home/<user>/network-app
tar -xzf api.tar.gz
```

| Extract here | Result |
|--------------|--------|
| `network-app/` | Updates `api/` only — **safe**; live `db/` untouched |
| `network-app/api/` | Creates nested `api/api/` — **wrong** |

Then in Setup Node.js:

1. **Run NPM Install** if `api/node_modules` is missing (tarball never includes it)
2. **Restart**
3. **Do not migrate** unless you intentionally need schema changes

Guide also written next to each pack: `dist-release/DEPLOY-cloud-backend.txt`.

## 4. Packer rules (never regress)

`scripts/pack-cloud-backend-api.sh` must:

1. Nest all API files under **`api/`**
2. Exclude **`*.db`**, **`*.db-wal`**, **`*.db-shm`**, **`pharmasuit_lan.db*`**
3. Fail the pack if top-level `./db/` or any SQLite file appears in the archive

After packing, sanity-check:

```bash
tar tzf dist-release/api.tar.gz | grep -E '^\./db(/|$)' && echo FAIL || echo OK
tar tzf dist-release/api.tar.gz | grep -iE '\.db$' && echo FAIL || echo OK
tar tzf dist-release/api.tar.gz | grep 'api/package.json'
```

## 5. Backups and restore (SQLite is a file)

- Live DB is **not** under cPanel “Databases” (MySQL/Postgres). Use **Home Directory** / file backup (JetBackup or host equivalent).
- Restore path: `network-app/db/pharmasuit_lan.db` (+ wal/shm if present).
- Prefer restoring **`network-app/db`** (or that single file), not the entire home directory.
- If the tool **merges** and may skip overwriting an existing file: rename the live `.db` (and wal/shm) aside first, then restore so a full file is written.
- After restore, verify size and row counts (products / inventories should be &gt; 0 for an established pharmacy). Empty ~700KB files with only `admin` are **not** customer data.

JetBackup (or similar) may exist on one cPanel account and not another — that is host/plan configuration, not an app bug.

## 6. Desktop downloads vs API deploy

| Artifact | Channel | Touches live SQLite? |
|----------|---------|----------------------|
| Cloud desktop installers | `downloads/lan/` (workflow **Release LAN Desktop**) | No |
| `api.tar.gz` | Manual cPanel extract | **Yes, if extract path is wrong** |

Keep multi-tenant (`downloads/cloud-multi/`) and single-tenant (`downloads/lan/`) channels separate.

## 7. Quick checklist before every live API redeploy

- [ ] Pack with current `scripts/pack-cloud-backend-api.sh` (nested `api/`, no `.db`)
- [ ] Confirm archive has `./api/package.json` and **no** top-level `./db/`
- [ ] Confirm production `DB_FILE` points at sibling live DB
- [ ] Extract at `network-app/`, not inside `api/`
- [ ] NPM Install if needed → Restart → smoke login
- [ ] Do not migrate unless schema changed
- [ ] Prefer a known-good file backup of `network-app/db/` before risky ops

## Related files

- `scripts/pack-cloud-backend-api.sh`
- `api/db/resolve-db-file.js`
- `dist-release/DEPLOY-cloud-backend.txt` (generated on each pack)
- `docs/DOWNLOADS_LAN.md` (desktop publish channel)
