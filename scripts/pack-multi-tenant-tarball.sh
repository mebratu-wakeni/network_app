#!/usr/bin/env bash
# Pack multi-tenant API (+ built admin) the same way server.masatechplc.com expects.
#
# Historical formats on this machine / host:
#   api.tar.gz           → FLAT (./package.json, ./src/, …). Extract INTO the Node app root
#                          (the directory that already has package.json — usually …/api/).
#   masatech-deploy.tar.gz → NESTED (./api/… + ./masatech-admin/dist/…). Extract at the
#                          PARENT of api/ (e.g. …/network-desktop-app/).
#
# This script builds BOTH, with the same contents you need for redeploy:
#   - multi-tenant api source (no .env, no node_modules)
#   - admin SPA for /admin
#
# Usage (repo root, feature/cloud-multi-tenant):
#   ./scripts/pack-multi-tenant-tarball.sh
#
# Output (dist-release/):
#   api.tar.gz                 ← prefer this (matches prior /api.tar.gz workflow)
#   masatech-deploy.tar.gz     ← parent-folder layout (api/ + masatech-admin/dist/)
#   DEPLOY.txt

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y%m%dT%H:%M:%SZ)"
PKG_VERSION="$(node -p "require('./api/package.json').version" 2>/dev/null || echo 1.0.0)"
OUT_DIR="$ROOT/dist-release"
STAGE="$OUT_DIR/stage-api"

echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Pack order: (1) build admin  (2) stage api  (3) embed admin  (4) write api.tar.gz + masatech-deploy.tar.gz"

# ---------------------------------------------------------------------------
# 1) Build masatech-admin FIRST (so dist exists before we stage)
# ---------------------------------------------------------------------------
echo "==> [1/4] Building masatech-admin…"
cd "$ROOT/masatech-admin"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
test -f dist/index.html || { echo "ERROR: masatech-admin/dist/index.html missing after build"; exit 1; }

# ---------------------------------------------------------------------------
# 2) Stage api/ (same root layout as historical api.tar.gz)
# ---------------------------------------------------------------------------
echo "==> [2/4] Staging api/ (flat layout like api.tar.gz)…"
rm -rf "$STAGE"
mkdir -p "$STAGE" "$OUT_DIR"

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
  --exclude '*.sqlite' \
  --exclude '*.sqlite-*' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude 'startup-error.log' \
  "$ROOT/api/" "$STAGE/"

# Keep .env.example (never ship real .env — production env stays in cPanel)
if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE/.env.example"
fi

# Drop local-only / non-runtime noise (keeps extract clean on redeploy)
rm -rf "$STAGE/tests" "$STAGE/coverage"
rm -f "$STAGE"/test-api.js "$STAGE"/startup-error.log 2>/dev/null || true

# ---------------------------------------------------------------------------
# 3) Embed admin for /admin
#    - Flat api.tar.gz → ./admin-dist/  (resolved by api/src/app.js)
#    - Also keep masatech-admin/dist sibling for masatech-deploy.tar.gz
# ---------------------------------------------------------------------------
echo "==> [3/4] Embedding admin SPA…"
rm -rf "$STAGE/admin-dist"
mkdir -p "$STAGE/admin-dist"
rsync -a "$ROOT/masatech-admin/dist/" "$STAGE/admin-dist/"
test -f "$STAGE/admin-dist/index.html" || { echo "ERROR: admin-dist/index.html missing"; exit 1; }

cat > "$STAGE/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-multi-tenant-api",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$TIMESTAMP",
  "includesAdmin": true,
  "adminPath": "/admin",
  "formats": ["api.tar.gz", "masatech-deploy.tar.gz"]
}
EOF

# ---------------------------------------------------------------------------
# 4) Write archives (names match what you already use on the host)
# ---------------------------------------------------------------------------
echo "==> [4/4] Writing tarballs…"

# Primary: flat api.tar.gz — extract INTO Node application root (…/api/)
FLAT="$OUT_DIR/api.tar.gz"
tar -czf "$FLAT" -C "$STAGE" .
# Convenience copy at repo root (same as historical ./api.tar.gz)
cp -f "$FLAT" "$ROOT/api.tar.gz"

# Secondary: masatech-deploy.tar.gz — extract at PARENT of api/
# Layout: ./api/...  ./masatech-admin/dist/...
WRAP="$OUT_DIR/masatech-deploy-wrap"
rm -rf "$WRAP"
mkdir -p "$WRAP/api" "$WRAP/masatech-admin/dist"
rsync -a "$STAGE/" "$WRAP/api/"
rsync -a "$ROOT/masatech-admin/dist/" "$WRAP/masatech-admin/dist/"
DEPLOY_TGZ="$OUT_DIR/masatech-deploy.tar.gz"
tar -czf "$DEPLOY_TGZ" -C "$WRAP" .
cp -f "$DEPLOY_TGZ" "$ROOT/masatech-deploy.tar.gz"
rm -rf "$WRAP"

cat > "$OUT_DIR/DEPLOY.txt" <<EOF
PharmaSuit multi-tenant — redeploy (server.masatechplc.com)
==========================================================
Built:  $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

WHICH FILE TO USE
-----------------
Prefer:  dist-release/api.tar.gz   (also copied to ./api.tar.gz)
Same packing style as your previous /api.tar.gz:
  archive root = package.json, src/, db/, startup.cjs, admin-dist/, …

Optional: dist-release/masatech-deploy.tar.gz
  archive root = api/ + masatech-admin/dist/
  Extract at the PARENT of the Node app (e.g. network-desktop-app/).

REDEPLOY WITH api.tar.gz (recommended — matches prior workflow)
---------------------------------------------------------------
1. Backup Postgres + current server api/ folder.
2. Upload api.tar.gz (File Manager / SFTP).
3. On the server, go to the Node app root (folder that already has package.json),
   then extract OVER it (does not replace cPanel .env / env vars):

     cd ~/network-desktop-app/api    # ← your real Application root
     tar -xzf /path/to/api.tar.gz

   Do NOT extract into a nested api/api/ folder.
   Do NOT extract at the parent unless you are using masatech-deploy.tar.gz.

4. Install + migrate + restart:

     npm install --production
     npm run migrate
     # first time only (no platform admin yet):
     # npm run seed
     mkdir -p tmp && touch tmp/restart.txt

5. Verify:

     curl -sS https://server.masatechplc.com/health
     curl -sS https://server.masatechplc.com/api/db-health
     open https://server.masatechplc.com/admin

Startup file in cPanel: startup.cjs
Keep existing JWT_SECRET / DATABASE_URL (or DB_*) in the Node app env panel.

ADMIN
-----
api.tar.gz includes ./admin-dist/ → served at /admin.
masatech-deploy.tar.gz includes ./masatech-admin/dist/ (sibling of api/) — also supported.

NOT IN THIS TARBALL
-------------------
Electron installers (use GitHub Action → /downloads/cloud-multi/).
EOF

rm -rf "$STAGE"

echo ""
echo "Done. Pack order complete."
echo "  Primary:  $FLAT"
echo "  Also:     $ROOT/api.tar.gz"
echo "  Alt:      $DEPLOY_TGZ"
echo "  Guide:    $OUT_DIR/DEPLOY.txt"
echo ""
echo "Quick check (flat api.tar.gz must start with package.json / src / admin-dist):"
tar -tzf "$FLAT" | head -15
echo "..."
tar -tzf "$FLAT" | rg -n "^(./)?(package.json|startup.cjs|admin-dist/index.html|src/app.js|db/migrations/)" || true
ls -lh "$FLAT" "$DEPLOY_TGZ"
