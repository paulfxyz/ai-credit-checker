#!/bin/bash
# Local, unprivileged updater. No sudo, quarantine removal or security overrides.
set -euo pipefail
PID="$1"
TARGET="$2"
CANDIDATE="$3"
STAGE="$4"
BACKUP="$STAGE/Previous AI Credit Checker.app"
[[ "$PID" =~ ^[0-9]+$ ]] || exit 1
[[ "$TARGET" == */"AI Credit Checker.app" && "$CANDIDATE" == "$STAGE/AI Credit Checker.app" ]] || exit 1
[[ "$(dirname "$STAGE")" == "$(dirname "$TARGET")" && "$(basename "$STAGE")" == .ai-credit-checker-update-* ]] || exit 1
[[ -d "$TARGET" && -d "$CANDIDATE" && ! -L "$TARGET" && ! -L "$CANDIDATE" && ! -e "$BACKUP" ]] || exit 1
for ((i=0; i<60; i++)); do
  if ! kill -0 "$PID" 2>/dev/null; then break; fi
  sleep 1
done
if kill -0 "$PID" 2>/dev/null; then echo "Update cancelled: app did not quit."; exit 1; fi
/usr/bin/codesign --verify --deep --strict "$CANDIDATE"
rollback() {
  echo "Update failed; restoring previous app."
  if [[ -d "$BACKUP" ]]; then
    if [[ -e "$TARGET" ]]; then mv "$TARGET" "$STAGE/Failed AI Credit Checker.app"; fi
    mv "$BACKUP" "$TARGET"
    /usr/bin/open "$TARGET" || true
  fi
}
trap rollback ERR
mv "$TARGET" "$BACKUP"
mv "$CANDIDATE" "$TARGET"
/usr/bin/open "$TARGET"
trap - ERR
echo "Update installed. Previous app retained at: $BACKUP"
