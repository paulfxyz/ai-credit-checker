# AI Credit Checker 2.1.1

Choose exactly which counters belong in your menu bar, and get future updates from GitHub without leaving the app.

## Counter selection

- Four independent checkboxes: select one, two, three or all four providers.
- All and None (icon only) shortcuts in Overview and the native menu.
- All four balances remain in the dropdown, regardless of the title selection.
- Existing display choice, sign-ins, history and organization configuration are preserved.

## Balance-check schedule

Choose every 10, 30 or 60 minutes in Overview or the native menu. The saved selection resets the next scheduled run without unpausing a paused schedule. Freshness follows twice the chosen interval so hourly readings remain visible between checks.

## GitHub updater

- Automatically checks the public repository's latest stable release on launch and every six hours. Optional in Preferences.
- Manual Check for updates in Preferences and the menu bar.
- Download & restart asks for confirmation, verifies GitHub's SHA-256 digest and the app bundle, and installs without administrator privileges.
- Retains the previous app and attempts rollback if file replacement or the open command fails. No automatic post-launch crash detection.
- No Gatekeeper bypass, quarantine removal, provider credentials or account data in update requests.

## Install this version once

Download **AI-Credit-Checker-2.1.1-macOS-arm64.zip**, quit the current app and replace it in Applications. Do not delete Application Support data. The updater is new in this version, so 2.1.0 needs this one manual replacement.

The Apple Silicon build remains ad-hoc signed, not Developer ID signed or notarized. macOS may ask for approval. Automatic installation requires a writable app directory; a manual release download remains available if it cannot proceed.

## Validation

Unit and Electron fixture tests cover counter selection, persistence, native dropdown contents, version checks and corrupt-download rejection. The release workflow also runs a native macOS test with a harmless signed fixture app to exercise bundle verification, replacement, launch and backup retention.

The user confirmed all four live providers working in 2.1.0. A real future-version update on the target Mac is still an acceptance check; runner tests do not prove Gatekeeper approval on every Mac.
