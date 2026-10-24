# Changelog

User-facing changes by release, newest first. Dates use UTC publication dates; validation notes describe the evidence available for that release.

## 2.1.3 · 2026-10-24

### Fixed

- **Runware route:** Target `/settings/billing` directly. The old `/wallet` redirect no longer causes the destination to fail the exact-page guard.
- **Runware balance:** Recognize “Available balance” from the redesigned billing card, retain the old label, and exclude explicitly labelled monthly spend in the same card.
- **Precision:** Keep full observed precision and the existing two-decimal display.

### Validation

All 15 unit tests and the four-provider Electron suite passed before packaging. Added synthetic regression fixtures based on the user-supplied screenshot, with zero, hidden, malformed, ambiguous and nested fractional amounts, including adjacent HTML without whitespace. The Electron suite uses the new Runware layout. Authenticated live DOM verification was unavailable; the first updated Runware collection remains a user acceptance check. Existing sessions, preferences and history are preserved.

## 2.1.2 · 2026-10-13

### Fixed

- **Duplicate scrollbars:** Constrained the outer app window and made the content pane the single vertical scroll container, without cutting off bottom controls.
- **Screenshots:** Regenerated Overview, Activity, Preferences and counter controls from the corrected app.

### Documentation and tests

- **README:** Moved installation and upgrade guidance ahead of features; separated balance polling from GitHub update checks and clarified privacy, signing and recovery limits.
- **Changelog:** Grouped historical changes by type and distinguished release-time test limitations from later user confirmation.
- **Regression coverage:** Checked all three views at default and minimum window sizes for document overflow, horizontal overflow and access to the bottom of the content pane.
- **Updater fixtures:** Derived the next test version from the package version so a version bump cannot make the simulated update equal to the installed build.

No collector, counter-selection, polling or updater behavior changed. Existing accounts, preferences and history are retained; 2.1.1 users can install this patch with the in-app updater.

## [2.1.1](https://github.com/paulfxyz/ai-credit-checker/releases/tag/v2.1.1) · 2026-10-13

### Added

- **Counter selection:** Independent checkboxes for any combination of providers, plus All / None shortcuts in Overview and the native menu. All four dropdown balances remain available.
- **Balance cadence:** Saved 10, 30 or 60-minute intervals. Changing the interval resets the next check without unpausing a paused schedule.
- **GitHub updater:** Automatic stable-release checks on launch and every six hours, manual checking, and confirmed Download & restart.
- **Update verification:** GitHub asset SHA-256, bundle identity/version, arm64 executable and signature-integrity checks. Direct architecture validation does not require Xcode on the user's Mac.
- **Recovery:** Previous app retained; replacement/open-command failures attempt rollback without administrator privileges. No automatic post-launch crash detection.

### Changed

- **Freshness:** Age-based staleness follows twice the chosen balance interval: 20, 60 or 120 minutes. Failed reads become unavailable immediately.
- **Preferences:** Existing all, individual-provider and icon-only modes migrate to the equivalent checkbox selection. Sessions and history are preserved.

### Validation

Thirteen unit tests, the Electron fixture suite and a native macOS signed-fixture replacement/launch test passed. All four live providers had been user-confirmed in 2.1.0; future-release installation on the user's Mac remained a separate acceptance check.

## [2.1.0](https://github.com/paulfxyz/ai-credit-checker/releases/tag/v2.1.0) · 2026-10-13

### Added

- **Providers:** Fly.io organization Credit Balance and Runware wallet Current Balance.
- **Overview:** Four-provider 2×2 grid with configurable Fly.io organization.
- **Menu bar:** All four counters or one provider beside the icon; all four balances also available in icon-only dropdown mode.

### Changed

- **Runware precision:** Two-decimal USD display with full parsed precision retained locally.
- **Fly.io scope:** Changing organization clears its current balance and retains account-labelled history.
- **Upgrade path:** Preserved 2.0 sessions, history and app identity; migrated “Both balances” to “All four balances.”

### Validation

Nine unit tests and four-provider Electron fixture tests passed before publication. Live sign-in and extraction for the new providers were pending at release time and were subsequently confirmed working by the original user.

## 2.0.0 · 2026-10-06

First standalone public release as AI Credit Checker, based on the working private POC.

### Added

- **Desktop app:** Perplexity organization and OpenRouter account collectors, redesigned Overview/Activity/Preferences, original icons and optional launch at login.
- **Menu bar:** Both balances, either provider or icon only, with compact or exact credit counts.
- **Collection:** Ten-minute background checks, wake refresh, local history and JSON export.
- **Migration:** Numeric history import from Credit Monitor POC, without copying cookies or passwords.
- **Open source:** MIT repository, installation/privacy/security documentation, synthetic screenshots and CI.

### Compatibility

The new app identity required fresh sign-in. Perplexity retained support for abbreviated, US-English and UK-English organization labels; Stream Deck and browser-extension code were not included.
