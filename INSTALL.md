# Install AI Credit Checker 2.0

This release is a standalone Apple Silicon Mac app. There is no extension, Stream Deck component, local server or Terminal-based installer.

## Install

1. Download `AI-Credit-Checker-2.0.0-macOS-arm64.zip` from the GitHub release.
2. Extract the ZIP and move **AI Credit Checker.app** to Applications.
3. Open it. This build is ad-hoc signed, not Developer ID signed or notarized. If macOS blocks opening, review the notice in **System Settings → Privacy & Security** and use **Open Anyway** if offered and you choose to trust the build.
4. If macOS says the app is damaged, or an organization policy blocks it, stop and report the exact message. Do not disable Gatekeeper, remove quarantine with Terminal commands or bypass management policies.
5. Click **Open account** under Perplexity. Sign in on the actual provider page, select your organization if necessary, and verify the available-credit balance is visible.
6. Return to the dashboard and click **Check now**. A check can take up to approximately 65 seconds.
7. Repeat for OpenRouter. Choose the menu-bar display mode from Overview.
8. Close both account windows and turn on automatic checks. Keep the app running, with your Mac awake and online.

## Moving from Credit Monitor POC

Quit the POC before using 2.0. You may remove the old POC application and unused Stream Deck plugin; AI Credit Checker has no dependency on either.

If you want to keep prior observations, do not use an app-cleaner to delete the POC's application-support data before launching 2.0 once. When a new 2.0 profile is created, it looks for:

```text
~/Library/Application Support/Credit Monitor POC/observations.json
```

Only valid numeric observations and history are imported. The old file is left unchanged. Cookies, passwords and browser sessions are deliberately not migrated, so **sign in once in the new app**.

After you verify the imported history, you may remove the old POC data yourself if no longer needed. If you already removed it, start fresh; no recovery is implied.

## Menu bar

Choose **Both balances**, **Perplexity only**, **OpenRouter only** or **Icon only** on Overview or in the native menu. Preferences lets you switch between compact and exact credit counts.

Example: 12,499 Perplexity credits displays as `12.4K` in compact mode; USD remains `$85.20`. These are examples, not starting balances.

Click the icon or its text to open the native menu, where you can open the dashboard, open an account page, check balances, pause automatic checks or quit.

## Running in the background

Closing the dashboard hides it without quitting. Automatic collection targets every ten minutes, skips visible account windows and does not prevent sleep. A wake event requests a new check when automatic checks are enabled.

Enable **Open at login** in Preferences if desired. It is off by default and uses the standard macOS login-item integration. It is not a privileged daemon.

## Data and removal

The active storage location is shown in Preferences, under Local data & privacy. A typical location is:

```text
~/Library/Application Support/AI Credit Checker/observations.json
```

The same app directory contains browser-session data. Treat it as sensitive even though history exports exclude sessions.

To remove the app, first disable Open at login and quit it, then remove it from Applications. Removing the app does not automatically erase the application-support directory. If you choose to remove that directory too, you will lose saved sessions, preferences and history.

## Troubleshooting

**Infinity:** `∞` means no fresh successful observation, not an unlimited balance. Open the account page, complete login and use Check now.

**Perplexity:** The implemented source is the available organization credit pool, not personal plan usage. The account must have access to the organization Usage page and one of the supported English labels.

**Login blocked:** Follow the provider's supported sign-in flow. If embedded browsers are refused, stop; this app does not copy sessions from another browser or bypass SSO policy.

**Unexpected stale values:** Make sure the Mac is awake, automatic checks are enabled, and the account windows are closed. The history shows both successful and failed attempts.

**No visible menu-bar numbers:** Choose a non-icon-only display mode. macOS can hide menu-bar items when horizontal space is limited; try the compact option or a single provider.
