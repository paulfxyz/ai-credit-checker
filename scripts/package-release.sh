#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
VERSION="$(node -p 'require("./package.json").version')"
APP="$ROOT/dist/AI Credit Checker-darwin-arm64/AI Credit Checker.app"
npm run package:mac
if [[ "$(uname -s)" == "Darwin" ]]; then
  /usr/bin/codesign --force --deep --sign - "$APP"
  /usr/bin/codesign --verify --deep --strict "$APP"
else
  "${RCODESIGN:-rcodesign}" sign "$APP"
fi
cp INSTALL.md "$ROOT/dist/AI Credit Checker-darwin-arm64/START-HERE.md"
cp LICENSE "$ROOT/dist/AI Credit Checker-darwin-arm64/LICENSE.txt"
ARCHIVE="AI-Credit-Checker-${VERSION}-macOS-arm64.zip"
rm -f "$ROOT/dist/$ARCHIVE"
(cd "$ROOT/dist/AI Credit Checker-darwin-arm64" && zip -qry -y "../$ARCHIVE" "AI Credit Checker.app" START-HERE.md LICENSE.txt)
(cd "$ROOT/dist" && unzip -tq "$ARCHIVE" && shasum -a 256 "$ARCHIVE" > SHA256SUMS.txt)
echo "$ROOT/dist/$ARCHIVE"
