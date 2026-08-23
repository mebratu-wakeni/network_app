#!/usr/bin/env bash
# Verify a public PharmaSuit download feed is live and consistent.
#
# Usage:
#   scripts/verify-download-feed.sh <cloud-multi|lan> [expected-version]
#
# Exit 0 only when latest.json is reachable, optional version matches, and every
# artifacts.*.url returns HTTP 200 with Content-Length >= MIN_BYTES (installers).

set -euo pipefail

CHANNEL="${1:-}"
EXPECTED_VERSION="${2:-}"
MIN_BYTES="${MIN_BYTES:-1000000}"
SLEEP_BEFORE="${SLEEP_BEFORE:-5}"

case "$CHANNEL" in
  cloud-multi)
    BASE="https://server.masatechplc.com/downloads/cloud-multi"
    ;;
  lan)
    BASE="https://server.masatechplc.com/downloads/lan"
    ;;
  *)
    echo "Usage: $0 <cloud-multi|lan> [expected-version]"
    exit 2
    ;;
esac

if [ "${SLEEP_BEFORE}" -gt 0 ] 2>/dev/null; then
  echo "Waiting ${SLEEP_BEFORE}s for host flush…"
  sleep "$SLEEP_BEFORE"
fi

LATEST_URL="${BASE}/latest.json"
echo "Fetching $LATEST_URL"
TMP="$(mktemp)"
LIST="$(mktemp)"
trap 'rm -f "$TMP" "$LIST"' EXIT
curl -sS -L --max-time 60 "$LATEST_URL" -o "$TMP"
head -c 1200 "$TMP" || true
echo

VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8")).get("version") or "")' "$TMP")"
echo "feed version: ${VERSION}"

if [ -n "$EXPECTED_VERSION" ] && [ "$VERSION" != "$EXPECTED_VERSION" ]; then
  echo "ERROR: expected version ${EXPECTED_VERSION}, feed has ${VERSION}"
  exit 1
fi

python3 - "$TMP" "$LIST" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
arts = data.get("artifacts") or {}
required = ["mac", "win", "linux"]
missing = [k for k in required if not (arts.get(k) or {}).get("url")]
if missing:
    raise SystemExit("ERROR: latest.json missing required platforms: " + ", ".join(missing))
with open(sys.argv[2], "w", encoding="utf-8") as out:
    for key in ("mac", "win", "win32", "linux"):
        url = (arts.get(key) or {}).get("url") or ""
        if url:
            out.write(f"{key}|{url}\n")
PY

fail=0
while IFS='|' read -r key url; do
  [ -n "${key:-}" ] || continue
  headers="$(curl -sS -L --max-time 60 -I "$url" || true)"
  code="$(printf '%s' "$headers" | awk 'BEGIN{c="000"} /^HTTP\//{c=$2} END{print c}')"
  clen="$(printf '%s' "$headers" | awk -F': ' 'tolower($1)=="content-length"{gsub(/\r/,"",$2); print $2; exit}')"
  ctype="$(printf '%s' "$headers" | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,"",$2); print $2; exit}')"
  clen_i="${clen:-0}"
  if [ "$code" = "200" ] && [ "$clen_i" -ge "$MIN_BYTES" ] 2>/dev/null; then
    echo "OK ${key}: HTTP ${code} Content-Length=${clen:-?} type=${ctype:-?} ${url}"
  else
    echo "FAIL ${key}: HTTP ${code} Content-Length=${clen:-?} type=${ctype:-?} ${url}"
    fail=1
  fi
done < "$LIST"

if [ "$fail" -ne 0 ]; then
  echo "ERROR: one or more installer URLs failed public HTTP verification"
  exit 1
fi

echo "OK: ${CHANNEL} feed verified${EXPECTED_VERSION:+ at ${EXPECTED_VERSION}}"
