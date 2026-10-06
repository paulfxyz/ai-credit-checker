# AI Credit Checker 2.0

Your AI credits, quietly in your macOS menu bar.

This first public, desktop-only release builds on the Perplexity and OpenRouter collector verified in the original proof of concept. It has no Stream Deck dependency and requires no browser extension or companion server.

## Highlights

- Redesigned balance overview, activity history and preferences.
- Original app icon and monochrome native menu-bar icon.
- Display both balances, either provider, or icon only.
- Compact or exact credit counts next to the icon.
- Ten-minute checks, optional launch at login and refresh on wake.
- Local history and JSON export.
- Automatic import of valid old POC observations, without copying cookies or credentials.
- MIT source, documentation and automated tests.

## Install

Download **AI-Credit-Checker-2.0.0-macOS-arm64.zip**, extract it and drag **AI Credit Checker.app** to Applications. This release is for Apple Silicon Macs running macOS 13 or later.

The app is **ad-hoc signed, not Apple Developer ID signed or notarized**. Follow the macOS approval prompt if you choose to trust the build; do not disable system security controls. If macOS reports that the app is damaged, stop and report that exact message.

## Moving from the POC

Quit the old POC. Sign in once per provider in the new app, because its browser sessions are separate.

To retain observation history, launch 2.0 before using an app-cleaner to remove the POC's application-support data. Removing just the old `.app` is fine. The importer leaves the original history untouched.

## First checks

Use Open account and Check now for both providers. Compare the dashboard balances with the account pages. Then select the menu-bar display, close the account windows and enable automatic checks.

Fixture tests pass for extraction, menu-bar modes, persistence, isolation and failure handling. Native installation, the menu-bar presentation and the new identity's live login sessions remain release-level checks on the target Mac. Website changes or embedded-browser login restrictions may affect reliability.

`∞` means unavailable or stale, not unlimited. Perplexity organization credits are not dollars.

See **SHA256SUMS.txt** for the archive checksum. No silent auto-updater is included.
