#!/usr/bin/env bash
# Pack api.tar.gz for cloud-backend cPanel redeploy.
#
# Layout (SAFE for hosts like perlosgo):
#   archive root = api/package.json, api/src/, api/db/migrations, …
#
# Extract at the PARENT of the Node app (the folder that contains both api/ and db/):
#   /home/.../network-app/   ← extract HERE
#     api/                   ← Node app (package.json) — updated by this archive
#     db/pharmasuit_lan.db   ← LIVE SQLite (DB_FILE) — NEVER in this archive
#
# Why nested under api/?
#   A flat archive had top-level ./db/ (migrations). Extracting one level too high
#   collided with the live sibling db/ folder and could overwrite pharmasuit_lan.db.
#
# Excludes:
#   - macOS AppleDouble / resource forks: ._*
#   - .DS_Store, *.md, node_modules, .env*, tests, coverage, sqlite data (*.db)
#
# Usage:
#   ./scripts/pack-cloud-backend-api.sh
#
# Output:
#   dist-release/api.tar.gz
#   ./api.tar.gz

set -euo pipefail

export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PKG_VERSION="$(node -p "require('./api/package.json').version" 2>/dev/null || echo 1.0.0)"
OUT_DIR="$ROOT/dist-release"
STAGE="$OUT_DIR/stage-api"
STAGE_API="$STAGE/api"

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
  --exclude '*.db'
  --exclude '*.db-wal'
  --exclude '*.db-shm'
  --exclude 'pharmasuit_lan.db*'
  --exclude '.DS_Store'
  --exclude '._*'
  --exclude '**/._*'
  --exclude '*.md'
  --exclude '**/*.md'
  --exclude 'startup-error.log'
  --exclude 'test-api.js'
)

scrub_stage() {
  local dir="$1"
  find "$dir" \( -name '._*' -o -name '.DS_Store' -o -name '*.md' \) -type f -delete 2>/dev/null || true
  # Never ship local SQLite data into cloud redeploy archives
  find "$dir" \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.sqlite' -o -name '*.sqlite-*' \) -type f -delete 2>/dev/null || true
  find "$dir" -type d -name '__MACOSX' -exec rm -rf {} + 2>/dev/null || true
}

echo "==> Pack nested api.tar.gz for cloud-backend (api/… prefix)"
echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Excludes: ._*, *.md, node_modules, .env, tests, coverage, *.db"

rm -rf "$STAGE"
mkdir -p "$STAGE_API" "$OUT_DIR"

rsync -a "${RSYNC_EXCLUDES[@]}" "$ROOT/api/" "$STAGE_API/"

if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE_API/.env.example"
fi

# Embed admin SPA when present (served at /admin)
if [ -f "$ROOT/masatech-admin/package.json" ]; then
  echo "==> Building masatech-admin…"
  (
    cd "$ROOT/masatech-admin"
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
  )
  mkdir -p "$STAGE_API/admin-dist"
  rsync -a \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '**/._*' \
    --exclude '*.md' \
    "$ROOT/masatech-admin/dist/" "$STAGE_API/admin-dist/"
  test -f "$STAGE_API/admin-dist/index.html"
else
  echo "==> Skipping masatech-admin (not present on this branch)"
fi

cat > "$STAGE_API/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-cloud-backend",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$TIMESTAMP",
  "layout": "nested-api-prefix",
  "extractAt": "parent-of-api (folder that contains api/ and live db/)",
  "excludes": ["._*", "*.md", "node_modules", ".env", "tests", "*.db"]
}
EOF

scrub_stage "$STAGE"

test -f "$STAGE_API/package.json"
test -f "$STAGE_API/startup.cjs" || test -f "$STAGE_API/src/server.js" || true

FLAT="$OUT_DIR/api.tar.gz"
tar -czf "$FLAT" \
  --exclude='._*' \
  --exclude='*/._*' \
  --exclude='.DS_Store' \
  --exclude='*.md' \
  -C "$STAGE" .

cp -f "$FLAT" "$ROOT/api.tar.gz"

echo "==> Archive preview:"
tar -tzf "$FLAT" | head -25

BAD_MD="$(tar -tzf "$FLAT" | grep -E '\.md$' || true)"
BAD_DOT="$(tar -tzf "$FLAT" | grep -E '(^|/)\._' || true)"
BAD_TOP_DB="$(tar -tzf "$FLAT" | grep -E '^\./db(/|$)' || true)"
BAD_SQLITE="$(tar -tzf "$FLAT" | grep -iE '\.(db|sqlite)(-wal|-shm)?$' || true)"
MISSING_NEST="$(tar -tzf "$FLAT" | grep -E '^\./api/package\.json$' || true)"

if [ -n "$BAD_MD" ]; then
  echo "ERROR: tarball still contains .md files:"
  echo "$BAD_MD"
  exit 1
fi
if [ -n "$BAD_DOT" ]; then
  echo "ERROR: tarball still contains ._* files:"
  echo "$BAD_DOT"
  exit 1
fi
if [ -z "$MISSING_NEST" ]; then
  echo "ERROR: expected nested ./api/package.json (safe layout)"
  exit 1
fi
if [ -n "$BAD_TOP_DB" ]; then
  echo "ERROR: top-level ./db/ must not exist (collides with live DB_FILE folder):"
  echo "$BAD_TOP_DB"
  exit 1
fi
if [ -n "$BAD_SQLITE" ]; then
  echo "ERROR: tarball must not contain SQLite data files:"
  echo "$BAD_SQLITE"
  exit 1
fi
echo "==> OK: nested under api/, no top-level db/, no .db/.md/._* files"

# Confirm FY guards are present in the packed tree
if ! grep -q 'assertFiscalYearOpen' "$STAGE_API/src/services/fiscal-year.guard.js" 2>/dev/null; then
  echo "ERROR: fiscal-year.guard.js missing from stage"
  exit 1
fi
if ! grep -q 'getAnyOpen' "$STAGE_API/src/modules/fiscal-years/fiscal-years.repository.js"; then
  echo "ERROR: getAnyOpen missing from fiscal-years.repository.js"
  exit 1
fi
GUARD_CALLS="$(grep -R "assertFiscalYearOpen" "$STAGE_API/src/modules" --include='*.js' | wc -l | tr -d ' ')"
echo "==> assertFiscalYearOpen call sites in modules: $GUARD_CALLS"
if [ "${GUARD_CALLS:-0}" -lt 10 ]; then
  echo "ERROR: expected FY ledger guards wired into modules"
  exit 1
fi

cat > "$OUT_DIR/DEPLOY-cloud-backend.txt" <<EOF
cloud-backend API redeploy (api.tar.gz) — SAFE nested layout
============================================================
Built:  $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

Upload:  dist-release/api.tar.gz  (also ./api.tar.gz)

LIVE LAYOUT (example: perlosgo)
-------------------------------
  /home/.../network-app/
    api/                      ← Node application root (package.json)
    db/pharmasuit_lan.db      ← LIVE data (DB_FILE) — never in this tarball

EXTRACT (important)
-------------------
Extract at network-app/ (parent of api/), NOT inside api/:

  cd /home/.../network-app
  tar -xzf api.tar.gz

That updates only ./api/… and cannot overwrite ./db/pharmasuit_lan.db.

Then (in Setup Node.js for the api app):
  - optional: Run NPM Install if dependencies changed
  - Restart
  - Do NOT migrate unless you intentionally need schema changes

This build includes:
  - Nested api/ prefix (safe vs sibling live db/)
  - No SQLite *.db in the archive
  - No ._* / *.md
  - FY ledger guards
EOF

rm -rf "$STAGE"

echo ""
echo "Done."
echo "  Upload: $FLAT"
echo "  Also:   $ROOT/api.tar.gz"
echo "  Guide:  $OUT_DIR/DEPLOY-cloud-backend.txt"
ls -lh "$FLAT"
