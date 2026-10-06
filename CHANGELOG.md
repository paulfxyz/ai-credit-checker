# Changelog

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
