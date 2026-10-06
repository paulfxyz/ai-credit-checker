# Release validation

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
