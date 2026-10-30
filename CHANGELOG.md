# Changelog

User-facing changes by release, newest first. Dates use UTC publication dates; validation notes describe the evidence available for that release.

## 2.1.7 · 2026-10-30

### Fixed

- **Perplexity personal check failed with “Sign-in, verification, or organization selection is required”:** Perplexity opens Usage and credits as a Settings modal and changes the page address, so the exact `/account/usage` guard rejected a signed-in page. In personal mode the guard now accepts any `https://www.perplexity.ai` page except sign-in and organization routes; the reader still requires the exact “credits left” total.
- **Fly.io “Available-credit label not found”:** Fly.io renamed the billing label to “Purchased Credit Balance.” The parser accepts it alongside the older “Credit Balance,” still ignoring invoices.

### Validation

- 17 unit tests, now including rewritten Perplexity addresses, rejected sign-in, http and look-alike hosts, and Fly.io's new label with an info icon. The Electron suite's Perplexity fixture rewrites its address after loading and the Fly.io fixture uses the new label. Live checks remain user acceptance checks.

## 2.1.6 · 2026-10-30

### Added

- **Perplexity personal plans:** The Perplexity card now has an account choice. **Personal plan (Pro or Max)** is the default and reads “credits left” from Usage and credits (`/account/usage`), the same total as “Total available credits” in the Usage menu. **Enterprise organization pool** keeps the previous organization reader.

### Fixed

- **Fly.io sign-in not remembered:** Fly.io's sign-in cookie (`_fly`) has no expiry, so Chromium deleted it on every quit or update. Perplexity, OpenRouter and Runware cookies have expiry dates. Inside the isolated Fly.io partition only, first-party fly.io session cookies are now kept for 30 days locally, and cookie stores are flushed before quitting. Fly.io still decides whether a session is valid.

### Changed

- Upgrades default to the personal Perplexity balance. A saved organization reading is not shown as personal; choose Enterprise to keep the previous behaviour. History rows are labelled personal or organization, and the chart shows only the selected type.

### Validation

- 17 unit tests: personal and Enterprise URLs, page guard, preference allowlist, and personal parsing (settings text, styled numbers, Usage menu “75,134 / 773,877”, zero, singular, accessible labels, hidden, ambiguous and malformed values). Plan, purchased and bonus sub-balances are never read.
- Electron suite: default personal read of a synthetic Usage and credits page, Enterprise switch clearing it, and the organization reader. A synthetic `_fly` session cookie survives an app restart, while a non-Fly cookie in that partition and an OpenRouter session cookie do not.
- A standalone probe on this Electron version confirmed an expiry-less cookie is deleted across restarts while an expiring cookie survives, matching the report. Live checks of the personal Perplexity page and Fly.io after restart remain user acceptance checks.

## 2.1.5 · 2026-10-24

### Fixed

- **Checks after closing an account window:** Runware worked only while its window stayed open. A window that has been shown and then closed is hidden, and Chromium stops rendering it; Runware's Billing page renders its balance client-side, so the hidden page never showed it. Checks for a closed window now use a temporary offscreen reader on the same saved session, then destroy it. A visible window is still read directly. Applies to all four providers.

### Validation

- **Root cause reproduced:** Without automation attached, a shown-then-hidden Electron window did not render a client-side fixture; an offscreen reader did. `tests/hidden-render.cjs` runs this probe in CI and on the macOS release runner.
- **Regression:** The Electron suite opens and closes the Runware window, then checks a client-rendered Billing fixture and asserts a temporary offscreen reader was used and cleaned up. The old code fails this test.
- Playwright keeps attached hidden windows rendering, which is why earlier fixture tests passed. The live check after closing the Runware window remains a user acceptance check.

## 2.1.4 · 2026-10-24

### Fixed

- **Runware nested spend:** Exclude “Spent this month” even when adjacent HTML elements join its label and amount without whitespace.
- **Release guard:** Serialize packaging and refuse duplicate version numbers before building.

### Validation

All 15 unit tests and the four-provider Electron suite passed on 2.1.4 before packaging. Live Runware collection remains a user acceptance check. This follow-up preserves the already-published 2.1.3 installer and tag rather than replacing their contents.

## 2.1.3 · 2026-10-24

### Fixed

- **Runware route:** Target `/settings/billing` directly. The old `/wallet` redirect no longer causes the destination to fail the exact-page guard.
- **Runware balance:** Recognize “Available balance” from the redesigned billing card, retain the old label, and exclude explicitly labelled monthly spend in the same card.
- **Precision:** Keep full observed precision and the existing two-decimal display.

### Validation

All 14 unit tests and the four-provider Electron suite passed before packaging. Added a synthetic regression fixture based on the user-supplied screenshot, with zero, hidden, malformed, ambiguous and nested fractional amounts. The Electron suite uses the new Runware layout. Authenticated live DOM verification was unavailable; the first updated Runware collection remains a user acceptance check. Existing sessions, preferences and history are preserved.

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
