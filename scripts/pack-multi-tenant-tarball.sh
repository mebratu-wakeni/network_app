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
# Excludes (required for cPanel / Linux extract):
#   - macOS AppleDouble / resource-fork files: ._*
#   - documentation: *.md
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

# Prevent macOS tar from embedding AppleDouble (._*) metadata in the archive
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PKG_VERSION="$(node -p "require('./api/package.json').version" 2>/dev/null || echo 1.0.0)"
OUT_DIR="$ROOT/dist-release"
STAGE_API="$OUT_DIR/stage/api"
WRAP="$OUT_DIR/masatech-deploy-wrap"

# Shared rsync excludes: secrets, local data, macOS junk, docs
RSYNC_EXCLUDES=(
  --exclude node_modules
  --exclude '.env'
  --exclude '.env.local'
  --exclude '.env.production'
  --exclude '.env.development'
  --exclude data
  --exclude uploads
  --exclude coverage
  --exclude admin-dist
  --exclude tests
  --exclude '*.sqlite'
  --exclude '*.sqlite-*'
  --exclude '.DS_Store'
  --exclude '._*'
  --exclude '**/._*'
  --exclude '*.md'
  --exclude '**/*.md'
  --exclude 'startup-error.log'
)

# Remove any ._* or *.md that slipped through (macOS / nested copies)
scrub_stage() {
  local dir="$1"
  find "$dir" \( -name '._*' -o -name '.DS_Store' -o -name '*.md' \) -type f -delete 2>/dev/null || true
  find "$dir" -type d -name '__MACOSX' -exec rm -rf {} + 2>/dev/null || true
}

echo "==> Target layout: server.masatechplc.com/{api,masatech-admin}  (masatech-deploy.tar.gz)"
echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Excludes: ._* (macOS forks), *.md, node_modules, .env, coverage, tests"
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

rsync -a "${RSYNC_EXCLUDES[@]}" \
  "$ROOT/api/" "$STAGE_API/"

if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE_API/.env.example"
fi
rm -f "$STAGE_API"/test-api.js 2>/dev/null || true

# Also embed admin-dist inside api/ (fallback if only api/ is updated)
mkdir -p "$STAGE_API/admin-dist"
rsync -a \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '**/._*' \
  --exclude '*.md' \
  "$ROOT/masatech-admin/dist/" "$STAGE_API/admin-dist/"

cat > "$STAGE_API/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-multi-tenant",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$TIMESTAMP",
  "extractAt": "/home/…/server.masatechplc.com/",
  "layout": ["api/", "masatech-admin/dist/", "downloads/cloud-multi/"],
  "excludes": ["._*", "*.md", "node_modules", ".env"]
}
EOF

# Copy incremental SQL for phpPgAdmin (cPanel Databases)
if [ -d "$ROOT/api/db/sql" ]; then
  rsync -a \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '*.md' \
    "$ROOT/api/db/sql/" "$OUT_DIR/sql/"
  mkdir -p "$STAGE_API/db/sql"
  rsync -a \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '*.md' \
    "$ROOT/api/db/sql/" "$STAGE_API/db/sql/"
fi

scrub_stage "$STAGE_API"

# ---------------------------------------------------------------------------
# 3) Assemble domain-root siblings (matches live cPanel folders)
# ---------------------------------------------------------------------------
echo "==> [3/4] Assembling masatech-deploy wrap (api/ + masatech-admin/dist/ + downloads/)…"
mkdir -p "$WRAP/api" "$WRAP/masatech-admin/dist" "$WRAP/downloads/cloud-multi"
rsync -a \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '**/._*' \
  --exclude '*.md' \
  "$STAGE_API/" "$WRAP/api/"
rsync -a \
  --exclude '.DS_Store' \
  --exclude '._*' \
  --exclude '**/._*' \
  --exclude '*.md' \
  "$ROOT/masatech-admin/dist/" "$WRAP/masatech-admin/dist/"

# Seed downloads page (installers come later via GitHub Actions / FTP)
if [ -f "$ROOT/downloads/cloud-multi/index.html" ]; then
  cp "$ROOT/downloads/cloud-multi/index.html" "$WRAP/downloads/cloud-multi/index.html"
fi
if [ -f "$ROOT/downloads/cloud-multi/latest.json.example" ]; then
  cp "$ROOT/downloads/cloud-multi/latest.json.example" "$WRAP/downloads/cloud-multi/latest.json"
fi

scrub_stage "$WRAP"

test -f "$WRAP/masatech-admin/dist/index.html"
test -f "$WRAP/api/package.json"
test -f "$WRAP/api/startup.cjs"
test -f "$WRAP/downloads/cloud-multi/index.html" || {
  echo "ERROR: downloads/cloud-multi/index.html missing from wrap"
  exit 1
}

# ---------------------------------------------------------------------------
# 4) Create masatech-deploy.tar.gz (PRIMARY — same name as on the server)
# ---------------------------------------------------------------------------
echo "==> [4/4] Writing masatech-deploy.tar.gz…"
DEPLOY_TGZ="$OUT_DIR/masatech-deploy.tar.gz"
tar -czf "$DEPLOY_TGZ" \
  --exclude='._*' \
  --exclude='*/._*' \
  --exclude='.DS_Store' \
  --exclude='*.md' \
  -C "$WRAP" .
cp -f "$DEPLOY_TGZ" "$ROOT/masatech-deploy.tar.gz"

# Sanity: must look like the live archive; must NOT contain ._* or .md
echo "==> Archive preview (must include ./api/ ./masatech-admin/ ./downloads/):"
tar -tzf "$DEPLOY_TGZ" | head -16
echo "…"
tar -tzf "$DEPLOY_TGZ" | grep -E 'downloads/cloud-multi/(index\.html|latest\.json)$' || {
  echo "ERROR: downloads seed missing from archive"
  exit 1
}

BAD_MD="$(tar -tzf "$DEPLOY_TGZ" | grep -E '\.md$' || true)"
BAD_DOT="$(tar -tzf "$DEPLOY_TGZ" | grep -E '(^|/)\._' || true)"
if [ -n "$BAD_MD" ]; then
  echo "ERROR: tarball still contains .md files:"
  echo "$BAD_MD"
  exit 1
fi
if [ -n "$BAD_DOT" ]; then
  echo "ERROR: tarball still contains ._* (macOS) files:"
  echo "$BAD_DOT"
  exit 1
fi
echo "==> OK: no .md and no ._* files in archive"

cat > "$OUT_DIR/DEPLOY.txt" <<EOF
Redeploy server.masatechplc.com (masatech-deploy.tar.gz)
========================================================
Built:  $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

LIVE LAYOUT (after extract)
---------------------------
  /home/masatetw/server.masatechplc.com/
    api/
    masatech-admin/
    downloads/cloud-multi/index.html   ← seeded by this tarball
    masatech-deploy.tar.gz

NO TERMINAL NEEDED — use cPanel UI only

════════════════════════════════════════════════════════════════
STEP A — Upload + extract (File Manager)
════════════════════════════════════════════════════════════════
1. Open File Manager → go to server.masatechplc.com/
   (you should see api/ and masatech-admin/ here)
2. Upload masatech-deploy.tar.gz into THAT folder
   (next to api/, NOT inside api/)
3. Right-click the .tar.gz → Extract
4. Confirm extract location is server.masatechplc.com/ (domain root)
5. After extract you should also see: downloads/cloud-multi/

════════════════════════════════════════════════════════════════
STEP B — Install packages + restart (Setup Node.js App)
════════════════════════════════════════════════════════════════
1. Open Setup Node.js App (or Application Manager)
2. Open the app with Application root: server.masatechplc.com/api
   Startup file: startup.cjs
3. Click Run NPM Install — wait until finished
   (do NOT run migrate from this UI)
4. Restart — either:
   - Stop App, then Start App
   - OR File Manager → api/tmp/ → create/edit restart.txt → Save
     (create the tmp folder if missing)

Keep existing env (Postgres + JWT_SECRET). Tarball has no .env.

════════════════════════════════════════════════════════════════
STEP C — Database migration (phpPgAdmin) — only if not done yet
════════════════════════════════════════════════════════════════
1. On Mac open: dist-release/sql/20260715120000_add_customer_code_to_customers.sql
2. cPanel → PostgreSQL Databases → phpPgAdmin
3. Select this app's database → paste SQL → Execute
Skip if you already ran this SQL.

════════════════════════════════════════════════════════════════
STEP D — Verify
════════════════════════════════════════════════════════════════
  https://server.masatechplc.com/health
  https://server.masatechplc.com/api/db-health
  https://server.masatechplc.com/admin
  https://server.masatechplc.com/downloads/cloud-multi/
     ← must be an HTML page (NOT {"ok":false,"error":"Not Found"})

════════════════════════════════════════════════════════════════
STEP E — Real installers (later — GitHub Actions)
════════════════════════════════════════════════════════════════
1. Add secrets: DOWNLOADS_HOST, DOWNLOADS_USERNAME, DOWNLOADS_PASSWORD,
   DOWNLOADS_SERVER_DIR = path ending in …/downloads/cloud-multi/
2. Tag desktop-cloud-vX.Y.Z and run workflow "Release Cloud Desktop"
3. Re-check the downloads URL for Mac/Win/Linux buttons

ARCHIVE GUARANTEES
------------------
  - No macOS ._* / .DS_Store files
  - No *.md documentation files
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
