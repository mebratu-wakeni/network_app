#!/usr/bin/env bash
# Build masatech-admin + package api/ (with admin-dist) as a cPanel tarball.
# Does NOT include Electron installers (those use GitHub Actions → downloads/).
#
# Usage (from repo root, on feature/cloud-multi-tenant):
#   ./scripts/pack-multi-tenant-tarball.sh
#
# Output:
#   dist-release/pharmasuit-multi-tenant-api-<version>-<timestamp>.tar.gz
#   dist-release/DEPLOY.txt  (upload + extract + migrate checklist)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PKG_VERSION="$(node -p "require('./api/package.json').version" 2>/dev/null || echo 1.0.0)"
OUT_DIR="$ROOT/dist-release"
TARBALL_NAME="pharmasuit-multi-tenant-api-${PKG_VERSION}-${TIMESTAMP}.tar.gz"
TARBALL_PATH="$OUT_DIR/$TARBALL_NAME"
STAGE="$OUT_DIR/stage-api"

echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Building masatech-admin…"
cd "$ROOT/masatech-admin"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
test -f dist/index.html || { echo "masatech-admin build missing dist/index.html"; exit 1; }

echo "==> Staging api + admin-dist…"
rm -rf "$STAGE"
mkdir -p "$STAGE"
# Copy api tree without heavy/local-only paths
rsync -a \
  --exclude node_modules \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '!.env.example' \
  --exclude data \
  --exclude uploads \
  --exclude coverage \
  --exclude '*.sqlite' \
  --exclude '*.sqlite-*' \
  --exclude '.DS_Store' \
  --exclude '._*' \
  "$ROOT/api/" "$STAGE/"

# Ensure .env.example is present even if rsync exclude pattern is awkward
if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE/.env.example"
fi

rm -rf "$STAGE/admin-dist"
mkdir -p "$STAGE/admin-dist"
rsync -a "$ROOT/masatech-admin/dist/" "$STAGE/admin-dist/"

# Drop tests from production tarball (optional size/safety)
rm -rf "$STAGE/tests"

# Record build metadata
cat > "$STAGE/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-multi-tenant-api",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "includesAdmin": true,
  "adminPath": "/admin"
}
EOF

echo "==> Creating tarball…"
mkdir -p "$OUT_DIR"
# Archive contents at tarball root as the api app folder files (extract into existing api dir)
tar -czf "$TARBALL_PATH" -C "$STAGE" .

# Also write a nested form some hosts prefer: unpacks to ./api/
NESTED_NAME="pharmasuit-multi-tenant-api-${PKG_VERSION}-${TIMESTAMP}-nested.tar.gz"
mkdir -p "$OUT_DIR/nested-wrap/api"
rsync -a "$STAGE/" "$OUT_DIR/nested-wrap/api/"
tar -czf "$OUT_DIR/$NESTED_NAME" -C "$OUT_DIR/nested-wrap" api
rm -rf "$OUT_DIR/nested-wrap"

cat > "$OUT_DIR/DEPLOY.txt" <<EOF
PharmaSuit multi-tenant cloud — tarball deploy
==============================================
Built:   $(date -u +%Y-%m-%dT%H:%M:%SZ)
Branch:  $BRANCH
Commit:  $COMMIT
Files:
  $TARBALL_NAME          ← extract INTO your existing api/ directory
  $NESTED_NAME           ← extract at parent; creates ./api/

Server target: https://server.masatechplc.com
  API:   https://server.masatechplc.com/api/...
  Admin: https://server.masatechplc.com/admin
  Health: https://server.masatechplc.com/health

BEFORE UPLOAD
-------------
1. Backup Postgres DB.
2. Backup current api/ folder on the server (or rename to api.bak).
3. Confirm cPanel Node app env has Postgres vars (DATABASE_URL or DB_*)
   and a strong JWT_SECRET. Do NOT overwrite production .env with this tarball
   (tarball has no .env).

UPLOAD + EXTRACT (flat tarball into existing api dir)
----------------------------------------------------
1. Upload $TARBALL_NAME via cPanel File Manager / SFTP.
2. SSH or File Manager → extract into the Node app directory, e.g.:
     cd ~/network-desktop-app/api   # adjust to your path
     tar -xzf /path/to/$TARBALL_NAME
3. Ensure startup file is: startup.cjs
4. On the server:
     npm install --production
     npm run migrate
     # first time only, if no platform admin yet:
     # npm run seed
5. Restart Node app (cPanel Restart, or: mkdir -p tmp && touch tmp/restart.txt)

VERIFY
------
  curl -sS https://server.masatechplc.com/health
  curl -sS https://server.masatechplc.com/api/db-health
  Open https://server.masatechplc.com/admin  → platform admin login
  Change default password immediately if you just seeded.

NOTES
-----
- Electron desktop installers are NOT in this tarball.
  Use GitHub Action "Release Cloud Desktop" → /downloads/cloud-multi/
- admin-dist/ is the built SPA; API serves it at /admin automatically.
EOF

# Keep stage for inspection; remove to save space
rm -rf "$STAGE"

echo ""
echo "Done."
echo "  Flat:   $TARBALL_PATH"
echo "  Nested: $OUT_DIR/$NESTED_NAME"
echo "  Guide:  $OUT_DIR/DEPLOY.txt"
ls -lh "$TARBALL_PATH" "$OUT_DIR/$NESTED_NAME"
