# Release validation

## Versions 2.1.3 and 2.1.4

Runware now redirects the old `/wallet` URL to `/settings/billing`, as reported by the user. Their screenshot shows “Available balance” in an “Inference credits” card, with “Spent this month” nearby. The old URL guard and old-only label explain two independent incompatibilities.

Version 2.1.3 passed 14 unit tests and the full Electron suite. The 2.1.4 follow-up adds a fifteenth unit test and hardens monthly spend exclusion for adjacent elements without whitespace; all 15 unit tests and the updated Electron suite passed on 2.1.4 before packaging. The new route remains exact-origin/path guarded. Synthetic tests reconstruct the visible card using non-private values and exercise both old and new labels, nested fractional digits, monthly spend in the same card, zero, hidden and malformed balances, ambiguity, wrong paths and wrong origins. The Electron suite uses the new billing fixture and retains its existing four-provider, session-persistence, menu, updater and layout coverage.

Live authenticated DOM access was unavailable because this older Computer session could not start the local browser connection. The screenshot supports the visible labels, not exact DOM structure. Runware collection in the installed app therefore remains a live acceptance check. No private screenshot, account name or balance is committed.

The first packaging run published 2.1.3 before a cancellation took effect. The additional whitespace fix is therefore shipped as 2.1.4, preserving the published tag and ZIP. Release checks now reject duplicate versions before building.

## Version 2.1.2

The double-scrollbar regression was reproduced before editing: the Overview document overflowed the viewport by 227 pixels while the inner content pane already had its own scrollbar. The fix constrains the document shell and keeps `.workspace` as the vertical scroll container.

The Electron suite now checks Overview, Activity and Preferences at 1180×920 and 820×700 content sizes. It verifies no outer-document overflow, no horizontal content overflow, a viewport-height content pane and access to its bottom. Refreshed screenshots use the same synthetic balances and account names as before.

The updater fixture's next release version is derived from the package version, avoiding a false “up to date” result when the app version increments. The existing collector, counter, cadence, persistence and updater tests remain in place.

## Version 2.1.1

The original user confirmed all four live collectors working in 2.1.0. This patch does not change their extraction logic.

Thirteen unit tests cover all 16 menu-counter combinations, legacy preference migration, ordering/deduplication, 10/30/60-minute interval validation and cadence-aware freshness, stable-release version comparison, fixed GitHub asset provenance, SHA-256 metadata and corrupt-download rejection. The real Electron fixture suite exercises checkbox selection, All/None, native menu callbacks, dropdown contents and persistence of a two-provider selection and hourly cadence, plus schedule resets, the updater's available-release UI and development-build install guard.

The macOS release workflow runs `tests/updater-mac.cjs`: it compiles a harmless arm64 fixture app, ad-hoc signs it, rejects a mismatched version, stages a valid ZIP and exercises the unprivileged replacement helper, launch and backup retention. This is separate from an actual future-release update on the user's Mac, which remains a live acceptance check.

Update checks use public GitHub metadata and a mandatory asset digest. Ad-hoc signature verification checks integrity, not an Apple-verified developer identity. The helper attempts rollback on file/open-command failure, not a later app crash. No privilege escalation or macOS security changes are made.

## Version 2.1.0

Nine unit tests pass, covering all four parsers, strict scope/URL matching, Fly.io slug configuration, precision, zero balances, ambiguity rejection, preferences and history migration. Runware fixtures include nested small fractional digits; Fly.io fixtures include unrelated invoice and purchase amounts.

The real Electron smoke suite passes with four synthetic HTTPS provider pages:

- Four successful observations, a 2×2 dashboard and independent account controls.
- Runware stores `39.872` and displays `$39.87`.
- Six menu modes; icon-only native menu template retains all four balance rows.
- Remote pages cannot access Node or the privileged dashboard bridge.
- Observations, preferences and an isolated session cookie survive restart.
- Hidden-window reads after restart and exact configured Fly.io URL targeting.
- Changing Fly.io organization clears its old balance and labels new history correctly.
- Missing balances show an error and infinity without replacing the last good observation.

The updated overview screenshot was visually checked. Public screenshots use synthetic values and a synthetic organization, not private account data. Packaging runs on a macOS GitHub runner with ad-hoc signature verification.

Live Fly.io and Runware authentication and extraction have not been verified by these tests. Native menu-bar fit (especially with all four counters), login items, wake handling and two ten-minute background cycles remain target-Mac acceptance checks. The 2.1 app retains the 2.0 bundle identity and session paths.

Dependency audit on this revision reports seven development/build dependency findings (four moderate, three high) in the packager/download chain and Sharp. `npm audit --omit=dev` reports zero, but Electron itself is declared as a development dependency, so this is not a blanket runtime-security certification. This feature release does not force unrelated major toolchain upgrades; maintainers should track those findings separately.

## What passed before publishing 2.0.0

- Parser tests for org, organization and organisation labels, OpenRouter USD, zero balances, and rejection of usage/refill/ambiguous amounts.
- Model tests for all menu-bar modes, compact and exact display, stale data, safe preferences and history import.
- Real Electron process tests against synthetic HTTPS provider pages.
- Remote windows have no Node `require` and no privileged monitor bridge.
- Balance observations, preferences and synthetic session cookies survive restart.
- Provider session partitions are isolated.
- Successful hidden-window reads after restart.
- Missing-balance failures show infinity without overwriting the last successful value.
- Overview, activity and preferences views exercised in the running app.
- Apple Silicon bundle packaging and ZIP integrity checks.

All public screenshots use synthetic values. They do not contain live account data.

## What remains a live acceptance check

- The predecessor's collector was user-verified against both live providers, including the UK-English Perplexity label. The new app identity creates fresh browser sessions, so the 2.0 sign-in flow must be checked again.
- Actual native menu-bar icon appearance and title layout on the target Mac.
- Launch-at-login behavior and wake refresh on the target Mac.
- First macOS launch of the ad-hoc-signed 2.0 archive.
- Two ten-minute background checks with both account windows closed.

CI and fixture tests do not establish these live behaviors. There is no claim of Apple notarization, an official provider integration or an independent security audit.
