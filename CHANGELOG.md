# Changelog

## 2.1.1 · 2026-10-13

- Independently select any combination of menu-bar counters with checkboxes, plus All and None shortcuts.
- Equivalent multi-selection controls in the native menu; all four dropdown balances stay available.
- Choose 10, 30 or 60-minute balance checks, with saved cadence and matching freshness thresholds.
- Preserve previous display choices, sessions, history and provider configuration.
- Add automatic GitHub stable-release checks, manual checking and confirmed Download & restart.
- Verify GitHub asset SHA-256, bundle identity/version, architecture and code-signature integrity before replacement.
- Unprivileged local installer retains the previous app and attempts rollback on replacement/open-command failure.
- Extend tests for all 16 selections, native menu callbacks, persistence, updater metadata and corrupt downloads; add a native macOS installer fixture test.

All four providers in 2.1.0 were confirmed working by the original user. Updater behavior on the user's Mac remains a separate acceptance check.

## 2.1.0 · 2026-10-13

- Add Fly.io organization Credit Balance and Runware Current Balance collectors.
- Four-provider 2×2 dashboard, with configurable Fly.io organization.
- All four counters in the menu-bar title and native dropdown, including icon-only mode.
- Runware displays two decimals while preserving full observed precision in local history.
- Changing Fly.io organization invalidates the old current balance and retains account-labelled history.
- Preserve existing 2.0 sessions, history and app identity; migrate “Both balances” to “All four balances.”
- Nine unit tests and four-provider Electron fixture coverage, updated screenshots and documentation.

Fly.io and Runware live sign-in/extraction still require first-run acceptance on the target Mac.

## 2.0.0 · 2026-10-06

First standalone public release as **AI Credit Checker**.

- Desktop-only scope; no Stream Deck or browser-extension code in the new repository.
- Redesigned overview, account activity and preferences.
- Original app icon and native monochrome menu-bar icon.
- Configurable menu-bar display: both balances, either provider or icon only.
- Compact/exact credit-count preference and optional launch at login.
- Ten-minute background collection and refresh on wake.
- Local observation history and JSON export.
- Numeric history migration from Credit Monitor POC, without copying credentials.
- Preserves the tested Perplexity UK/US/abbreviated label handling.
- Public MIT source, documentation, synthetic screenshots and CI tests.

The working collector originated in the private POC. This new release changes app identity and UI; native installation, login-item behavior and provider sessions need release-level testing on the target Mac.
