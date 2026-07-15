#!/usr/bin/env bash
# Pack for server.masatechplc.com — SAME layout as the live host.
#
# Live filesystem (from cPanel):
#   /home/masatetw/server.masatechplc.com/
#     api/
#     masatech-admin/
#     masatech-deploy.tar.gz   ← extract HERE (domain root), not inside api/
#
# Archive layout (must match):
#   ./api/...
#   ./masatech-admin/dist/...
#
# Usage:
#   ./scripts/pack-multi-tenant-tarball.sh
#
# Output:
#   dist-release/masatech-deploy.tar.gz
#   ./masatech-deploy.tar.gz          (copy for upload)
#   dist-release/DEPLOY.txt
#   dist-release/sql/*.sql            (phpPgAdmin incremental migrations)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PKG_VERSION="$(node -p "require('./api/package.json').version" 2>/dev/null || echo 1.0.0)"
OUT_DIR="$ROOT/dist-release"
STAGE_API="$OUT_DIR/stage/api"
WRAP="$OUT_DIR/masatech-deploy-wrap"

echo "==> Target layout: server.masatechplc.com/{api,masatech-admin}  (masatech-deploy.tar.gz)"
echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Pack order: (1) build admin  (2) stage api  (3) assemble siblings  (4) tar"

# ---------------------------------------------------------------------------
# 1) Build admin FIRST
# ---------------------------------------------------------------------------
echo "==> [1/4] Building masatech-admin…"
cd "$ROOT/masatech-admin"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build
test -f dist/index.html || { echo "ERROR: masatech-admin/dist/index.html missing"; exit 1; }

# ---------------------------------------------------------------------------
# 2) Stage api/ contents
# ---------------------------------------------------------------------------
echo "==> [2/4] Staging api/…"
rm -rf "$OUT_DIR/stage" "$WRAP"
mkdir -p "$STAGE_API" "$OUT_DIR/sql"

rsync -a \
  --exclude node_modules \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude '.env.development' \
  --exclude data \
  --exclude uploads \
  --exclude coverage \
  --exclude admin-dist \
  --exclude tests \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-*' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude 'startup-error.log' \
  "$ROOT/api/" "$STAGE_API/"

if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE_API/.env.example"
fi
rm -f "$STAGE_API"/test-api.js 2>/dev/null || true

# Also embed admin-dist inside api/ (fallback if only api/ is updated)
mkdir -p "$STAGE_API/admin-dist"
rsync -a "$ROOT/masatech-admin/dist/" "$STAGE_API/admin-dist/"

cat > "$STAGE_API/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-multi-tenant",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$TIMESTAMP",
  "extractAt": "/home/…/server.masatechplc.com/",
  "layout": ["api/", "masatech-admin/dist/"]
}
EOF

# Copy incremental SQL for phpPgAdmin (cPanel Databases)
if [ -d "$ROOT/api/db/sql" ]; then
  rsync -a "$ROOT/api/db/sql/" "$OUT_DIR/sql/"
  mkdir -p "$STAGE_API/db/sql"
  rsync -a "$ROOT/api/db/sql/" "$STAGE_API/db/sql/"
fi

# ---------------------------------------------------------------------------
# 3) Assemble domain-root siblings (matches live cPanel folders)
# ---------------------------------------------------------------------------
echo "==> [3/4] Assembling masatech-deploy wrap (api/ + masatech-admin/dist/)…"
mkdir -p "$WRAP/api" "$WRAP/masatech-admin/dist"
rsync -a "$STAGE_API/" "$WRAP/api/"
rsync -a "$ROOT/masatech-admin/dist/" "$WRAP/masatech-admin/dist/"
test -f "$WRAP/masatech-admin/dist/index.html"
test -f "$WRAP/api/package.json"
test -f "$WRAP/api/startup.cjs"

# ---------------------------------------------------------------------------
# 4) Create masatech-deploy.tar.gz (PRIMARY — same name as on the server)
# ---------------------------------------------------------------------------
echo "==> [4/4] Writing masatech-deploy.tar.gz…"
DEPLOY_TGZ="$OUT_DIR/masatech-deploy.tar.gz"
tar -czf "$DEPLOY_TGZ" -C "$WRAP" .
cp -f "$DEPLOY_TGZ" "$ROOT/masatech-deploy.tar.gz"

# Sanity: must look like the live archive
echo "==> Archive preview (must start with ./api/ and ./masatech-admin/):"
tar -tzf "$DEPLOY_TGZ" | head -12

cat > "$OUT_DIR/DEPLOY.txt" <<EOF
Redeploy server.masatechplc.com (masatech-deploy.tar.gz)
========================================================
Built:  $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

LIVE LAYOUT (from your cPanel screenshot)
-----------------------------------------
  /home/masatetw/server.masatechplc.com/
    api/
    masatech-admin/
    masatech-deploy.tar.gz

UPLOAD FILE
-----------
  dist-release/masatech-deploy.tar.gz
  (also copied to ./masatech-deploy.tar.gz)

EXTRACT (domain root — NOT inside api/)
---------------------------------------
1. Backup Postgres + backup folders api/ and masatech-admin/.
2. Upload masatech-deploy.tar.gz into:
     /home/masatetw/server.masatechplc.com/
3. In File Manager, open that SAME folder (server.masatechplc.com),
   select masatech-deploy.tar.gz → Extract.
   Result should update:
     ./api/...
     ./masatech-admin/dist/...
4. Do NOT extract inside api/ (that creates api/api/).

NODE APP
--------
cPanel Application root should be:
  /home/masatetw/server.masatechplc.com/api
Startup file: startup.cjs
Keep existing env (DATABASE_URL / DB_*, JWT_SECRET). Tarball has no .env.

After extract, install deps (SSH or cPanel Terminal if available):

  cd /home/masatetw/server.masatechplc.com/api
  # activate your nodeenv if required, then:
  npm install --production
  mkdir -p tmp && touch tmp/restart.txt

DATABASE (migrations)
---------------------
npm run migrate often fails / is unavailable on this host.

Option A — SSH + low-memory migrator (preferred when Node works):
  cd /home/masatetw/server.masatechplc.com/api
  # source your nodevenv, ensure DB_* env is set, then:
  node scripts/migrate-lite.mjs

Option B — phpPgAdmin / cPanel → Databases → PostgreSQL (SQL):
  Run incremental scripts from dist-release/sql/ (also in api/db/sql/):
    20260715120000_add_customer_code_to_customers.sql
  Only if that column is not already present.
  The script also inserts into knex_migrations when finished.

VERIFY
------
  https://server.masatechplc.com/health
  https://server.masatechplc.com/api/db-health
  https://server.masatechplc.com/admin

Electron installers are NOT in this tarball (/downloads/cloud-multi/ is separate).
EOF

rm -rf "$OUT_DIR/stage" "$WRAP"

echo ""
echo "Done."
echo "  Upload:  $DEPLOY_TGZ"
echo "  Also:    $ROOT/masatech-deploy.tar.gz"
echo "  SQL:     $OUT_DIR/sql/"
echo "  Guide:   $OUT_DIR/DEPLOY.txt"
ls -lh "$DEPLOY_TGZ"
ls -la "$OUT_DIR/sql" 2>/dev/null || true
