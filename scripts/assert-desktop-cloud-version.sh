#!/usr/bin/env bash
# Assert release version matches app/package.json.
#
# Usage:
#   scripts/assert-desktop-cloud-version.sh <resolved-version>
#
# Exit 1 if app/package.json version differs from the argument.
# When GITHUB_REF is refs/tags/desktop-cloud-v*, also require the tag suffix
# to equal app/package.json (guards mismatched tags).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# Use a relative require so Git Bash paths on Windows runners work with Node.
PKG_VERSION="$(node -p "require('./app/package.json').version")"
RESOLVED="${1:-}"

if [ -z "$RESOLVED" ]; then
  echo "Usage: $0 <resolved-version>"
  exit 2
fi

echo "app/package.json version: $PKG_VERSION"
echo "resolved release version: $RESOLVED"

if [ "$PKG_VERSION" != "$RESOLVED" ]; then
  echo "ERROR: Version mismatch."
  echo "  Bump app/package.json to $RESOLVED (or retag to desktop-cloud-v$PKG_VERSION)."
  exit 1
fi

if [[ "${GITHUB_REF:-}" == refs/tags/desktop-cloud-v* ]]; then
  TAG_VERSION="${GITHUB_REF_NAME#desktop-cloud-v}"
  echo "git tag version: $TAG_VERSION"
  if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
    echo "ERROR: Tag desktop-cloud-v$TAG_VERSION does not match app/package.json ($PKG_VERSION)."
    exit 1
  fi
fi

echo "OK: versions locked at $PKG_VERSION"
