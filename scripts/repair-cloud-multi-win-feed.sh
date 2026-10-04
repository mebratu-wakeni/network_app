#!/usr/bin/env bash
# Repair Managed Cloud Windows update feed on the downloads host.
#
# Root cause we hit in 1.0.7:
#   - latest.yml path pointed at PharmaSuit-Cloud-Windows-*-Setup.exe
#   - FTPS left that file 5 bytes larger than sha512/size in latest.yml
#   - in-app updater reached ~99% then net::ERR_CONNECTION_RESET
#   - differential/blockmap downloads on LiteSpeed are flaky
#
# This script:
#   1) Re-uploads the universal Setup.exe from the GitHub Release (correct bytes)
#   2) Points latest.json win + latest.yml path at the x64 installer
#   3) Removes Windows .blockmap files so old clients do a full download
#
# Usage (CI):
#   VERSION=1.0.7 TAG=desktop-cloud-v1.0.7 \
#   DOWNLOADS_HOST=... DOWNLOADS_USERNAME=... DOWNLOADS_PASSWORD=... \
#   DOWNLOADS_SERVER_DIR=server.masatechplc.com/downloads/cloud-multi/ \
#   bash scripts/repair-cloud-multi-win-feed.sh

set -euo pipefail

VERSION="${VERSION:?VERSION required}"
TAG="${TAG:-desktop-cloud-v${VERSION}}"
HOST="${DOWNLOADS_HOST:?DOWNLOADS_HOST required}"
USER="${DOWNLOADS_USERNAME:?DOWNLOADS_USERNAME required}"
PASS="${DOWNLOADS_PASSWORD:?DOWNLOADS_PASSWORD required}"
SERVER_DIR="${DOWNLOADS_SERVER_DIR:?DOWNLOADS_SERVER_DIR required}"
SERVER_DIR="${SERVER_DIR%/}"
REPO="${GITHUB_REPOSITORY:-mebratu-wakeni/network_app}"
BASE_URL="https://server.masatechplc.com/downloads/cloud-multi"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

curl_ftp() {
  curl -sS --fail --ftp-ssl --insecure --ftp-pasv \
    --connect-timeout 30 --max-time 1800 \
    --retry 2 --retry-delay 5 --retry-all-errors \
    --user "${USER}:${PASS}" \
    "$@"
}

gh_asset() {
  local name="$1"
  local out="$2"
  echo "download ${name}"
  curl -fL --retry 5 --retry-delay 3 \
    -H "Accept: application/octet-stream" \
    -o "$out" \
    "https://github.com/${REPO}/releases/download/${TAG}/${name}"
  ls -lh "$out"
}

X64="PharmaSuit-Cloud-Windows-${VERSION}-x64-Setup.exe"
IA32="PharmaSuit-Cloud-Windows-${VERSION}-ia32-Setup.exe"
SETUP="PharmaSuit-Cloud-Windows-${VERSION}-Setup.exe"

gh_asset "$SETUP" "$WORKDIR/$SETUP"
gh_asset "$X64" "$WORKDIR/$X64"

SETUP_SIZE="$(wc -c < "$WORKDIR/$SETUP" | tr -d ' ')"
X64_SIZE="$(wc -c < "$WORKDIR/$X64" | tr -d ' ')"
X64_SHA="$(openssl dgst -sha512 -binary "$WORKDIR/$X64" | base64 -w0)"

echo "Setup.exe size=${SETUP_SIZE} (must match Release / latest.yml)"
echo "x64 size=${X64_SIZE} sha512=${X64_SHA}"

echo "== re-upload Setup.exe (correct bytes) =="
curl_ftp --ftp-create-dirs \
  -T "$WORKDIR/$SETUP" \
  "ftp://${HOST}/${SERVER_DIR}/${VERSION}/${SETUP}"

echo "== re-upload x64 (belt and suspenders) =="
curl_ftp --ftp-create-dirs \
  -T "$WORKDIR/$X64" \
  "ftp://${HOST}/${SERVER_DIR}/${VERSION}/${X64}"

# Patch latest.yml: keep file list, force path/sha512/size onto x64.
echo "== fetch + patch latest.yml =="
curl -fsSL "${BASE_URL}/latest.yml" -o "$WORKDIR/latest.yml" || true
if [ -s "$WORKDIR/latest.yml" ]; then
  python3 - "$WORKDIR/latest.yml" "$VERSION" "$X64" "$X64_SHA" "$X64_SIZE" <<'PY'
import pathlib, re, sys
path, version, x64, sha, size = sys.argv[1:6]
text = pathlib.Path(path).read_text(encoding="utf-8")
preferred = f"{version}/{x64}"
text = re.sub(r"^path:\s*.*$", f"path: {preferred}", text, count=1, flags=re.M)
text = re.sub(r"^sha512:\s*.*$", f"sha512: {sha}", text, count=1, flags=re.M)
if re.search(r"^size:\s*", text, flags=re.M):
    text = re.sub(r"^size:\s*.*$", f"size: {size}", text, count=1, flags=re.M)
else:
    # insert size after sha512
    text = re.sub(r"^(sha512:\s*.*)$", rf"\1\nsize: {size}", text, count=1, flags=re.M)
pathlib.Path(path).write_text(text, encoding="utf-8")
print(text)
PY
else
  cat > "$WORKDIR/latest.yml" <<EOF
version: ${VERSION}
files:
  - url: ${VERSION}/${X64}
    sha512: ${X64_SHA}
    size: ${X64_SIZE}
path: ${VERSION}/${X64}
sha512: ${X64_SHA}
size: ${X64_SIZE}
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
EOF
fi

curl_ftp -T "$WORKDIR/latest.yml" "ftp://${HOST}/${SERVER_DIR}/latest.yml"

echo "== write latest.json preferring x64 =="
python3 - "$WORKDIR/latest.json" "$VERSION" "$X64" "$IA32" "$BASE_URL" <<'PY'
import json, pathlib, sys
from datetime import datetime, timezone
out, version, x64, ia32, base = sys.argv[1:6]
base = base.rstrip("/")
latest = {
  "product": "PharmaSuit Cloud (multi-tenant)",
  "channel": "cloud-multi",
  "version": version,
  "releaseNotes": f"PharmaSuit Cloud {version} (Windows)",
  "publishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
  "mandatory": False,
  "minSupportedVersion": None,
  "artifacts": {
    "win": {"file": x64, "url": f"{base}/{version}/{x64}"},
    "win32": {"file": ia32, "url": f"{base}/{version}/{ia32}"},
  },
}
pathlib.Path(out).write_text(json.dumps(latest, indent=2) + "\n", encoding="utf-8")
print(pathlib.Path(out).read_text(encoding="utf-8"))
PY

curl_ftp -T "$WORKDIR/latest.json" "ftp://${HOST}/${SERVER_DIR}/latest.json"

echo "== remove Windows blockmaps (force full download for old clients) =="
for f in \
  "${X64}.blockmap" \
  "${IA32}.blockmap" \
  "${SETUP}.blockmap"
do
  echo "DELE ${VERSION}/${f}"
  curl -sS --ftp-ssl --insecure --ftp-pasv \
    --connect-timeout 20 --max-time 60 \
    --user "${USER}:${PASS}" \
    -Q "DELE ${SERVER_DIR}/${VERSION}/${f}" \
    "ftp://${HOST}/" -o /dev/null || true
done

echo "== verify =="
sleep 3
for f in "$SETUP" "$X64"; do
  cl=$(curl -sI "${BASE_URL}/${VERSION}/${f}" | awk -F': ' 'tolower($1)=="content-length"{gsub("\r","",$2); print $2}')
  echo "${f}: content-length=${cl}"
done
echo "latest.yml path:" 
curl -fsSL "${BASE_URL}/latest.yml" | head -20
echo "latest.json:"
curl -fsSL "${BASE_URL}/latest.json"

echo "Repair complete."
