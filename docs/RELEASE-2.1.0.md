# AI Credit Checker 2.1.0

Four balances, one Mac menu bar. This release adds Fly.io and Runware alongside Perplexity and OpenRouter in a 2×2 overview.

## New

- Fly.io: configure your organization slug, then collect its labelled Credit Balance.
- Runware: collect Current Balance, display USD to two decimals and retain full observed precision locally.
- Show all four counters beside the icon, any one provider, or just the icon.
- The native dropdown always includes all four balances, including in icon-only mode.
- Existing history, preferences and provider sessions are retained from 2.0.

## Install or update

Download `AI-Credit-Checker-2.1.0-macOS-arm64.zip`, quit the existing app and replace it in Applications. Do not delete the AI Credit Checker Application Support directory.

Save the Fly.io organization slug in its card, then use Open account to sign in to Fly.io and Runware. Click Check now for each and compare with the visible provider balance. Close account windows before enabling ten-minute background checks.

This is an Apple Silicon, ad-hoc-signed community build, not Developer ID signed or notarized. Follow the included START-HERE.md; do not disable macOS security controls.

## Validation and limitations

Nine unit tests and the real Electron four-provider smoke suite passed against synthetic fixtures, including persistence, precision, isolated sessions and icon-only dropdown contents. Live authentication/extraction for the two new providers and native macOS menu-bar layout still need first-run acceptance.

No cloud relay, API keys, inference calls or Stream Deck component. Website changes can break collection; infinity means unavailable, not unlimited.
