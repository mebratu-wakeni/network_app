#!/usr/bin/env bash
# Pack flat api.tar.gz for cloud-backend cPanel redeploy.
#
# Layout (matches historical live archive):
#   archive root = package.json, src/, db/, startup.cjs, …
#   Extract INTO the Node application root (do not nest api/api/).
#
# Excludes:
#   - macOS AppleDouble / resource forks: ._*
#   - .DS_Store, *.md, node_modules, .env*, tests, coverage, sqlite data
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
  --exclude 'test-api.js'
)

scrub_stage() {
  local dir="$1"
  find "$dir" \( -name '._*' -o -name '.DS_Store' -o -name '*.md' \) -type f -delete 2>/dev/null || true
  find "$dir" -type d -name '__MACOSX' -exec rm -rf {} + 2>/dev/null || true
}

echo "==> Pack flat api.tar.gz for cloud-backend"
echo "==> Branch: $BRANCH  commit: $COMMIT"
echo "==> Excludes: ._*, *.md, node_modules, .env, tests, coverage"

rm -rf "$STAGE"
mkdir -p "$STAGE" "$OUT_DIR"

rsync -a "${RSYNC_EXCLUDES[@]}" "$ROOT/api/" "$STAGE/"

if [ -f "$ROOT/api/.env.example" ]; then
  cp "$ROOT/api/.env.example" "$STAGE/.env.example"
fi

# Embed admin SPA when present (served at /admin)
if [ -f "$ROOT/masatech-admin/package.json" ]; then
  echo "==> Building masatech-admin…"
  (
    cd "$ROOT/masatech-admin"
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
  )
  mkdir -p "$STAGE/admin-dist"
  rsync -a \
    --exclude '.DS_Store' \
    --exclude '._*' \
    --exclude '**/._*' \
    --exclude '*.md' \
    "$ROOT/masatech-admin/dist/" "$STAGE/admin-dist/"
  test -f "$STAGE/admin-dist/index.html"
else
  echo "==> Skipping masatech-admin (not present on this branch)"
fi

cat > "$STAGE/DEPLOY_BUILD.json" <<EOF
{
  "product": "pharmasuit-cloud-backend",
  "version": "$PKG_VERSION",
  "gitBranch": "$BRANCH",
  "gitCommit": "$COMMIT",
  "builtAt": "$TIMESTAMP",
  "layout": "flat-api-root",
  "excludes": ["._*", "*.md", "node_modules", ".env", "tests"]
}
EOF

scrub_stage "$STAGE"

test -f "$STAGE/package.json"
test -f "$STAGE/startup.cjs" || test -f "$STAGE/src/server.js" || true

FLAT="$OUT_DIR/api.tar.gz"
tar -czf "$FLAT" \
  --exclude='._*' \
  --exclude='*/._*' \
  --exclude='.DS_Store' \
  --exclude='*.md' \
  -C "$STAGE" .

cp -f "$FLAT" "$ROOT/api.tar.gz"

echo "==> Archive preview:"
tar -tzf "$FLAT" | head -20

BAD_MD="$(tar -tzf "$FLAT" | grep -E '\.md$' || true)"
BAD_DOT="$(tar -tzf "$FLAT" | grep -E '(^|/)\._' || true)"
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
echo "==> OK: no .md and no ._* files in archive"

# Confirm FY guards are present in the packed tree
if ! grep -q 'assertFiscalYearOpen' "$STAGE/src/services/fiscal-year.guard.js" 2>/dev/null; then
  echo "ERROR: fiscal-year.guard.js missing from stage"
  exit 1
fi
if ! grep -q 'getAnyOpen' "$STAGE/src/modules/fiscal-years/fiscal-years.repository.js"; then
  echo "ERROR: getAnyOpen missing from fiscal-years.repository.js"
  exit 1
fi
GUARD_CALLS="$(grep -R "assertFiscalYearOpen" "$STAGE/src/modules" --include='*.js' | wc -l | tr -d ' ')"
echo "==> assertFiscalYearOpen call sites in modules: $GUARD_CALLS"
if [ "${GUARD_CALLS:-0}" -lt 10 ]; then
  echo "ERROR: expected FY ledger guards wired into modules"
  exit 1
fi

cat > "$OUT_DIR/DEPLOY-cloud-backend.txt" <<EOF
cloud-backend API redeploy (api.tar.gz)
=======================================
Built:  $TIMESTAMP
Branch: $BRANCH
Commit: $COMMIT

Upload:  dist-release/api.tar.gz  (also ./api.tar.gz)

Extract INTO the Node application root (folder that already has package.json):
  tar -xzf api.tar.gz
Do NOT extract at parent (that creates api/api/).

Then:
  npm install --production
  # migrate if your host allows (or use phpPgAdmin / migrate-lite)
  mkdir -p tmp && touch tmp/restart.txt

This build includes:
  - Only one open fiscal year (create/reopen blocked otherwise)
  - FY open guard on sales / purchase / financial / inventory ledger txs
  - No ._* / *.md in the archive
EOF

rm -rf "$STAGE"

echo ""
echo "Done."
echo "  Upload: $FLAT"
echo "  Also:   $ROOT/api.tar.gz"
echo "  Guide:  $OUT_DIR/DEPLOY-cloud-backend.txt"
ls -lh "$FLAT"
