# Release validation

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
