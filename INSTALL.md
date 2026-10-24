# Install AI Credit Checker 2.1.3

This release is a standalone Apple Silicon Mac app. There is no extension, Stream Deck component, local server or Terminal-based installer.

## Install

1. Download `AI-Credit-Checker-2.1.3-macOS-arm64.zip` from the GitHub release.
2. Extract the ZIP and move **AI Credit Checker.app** to Applications.
3. Open it. This build is ad-hoc signed, not Developer ID signed or notarized. If macOS blocks opening, review the notice in **System Settings → Privacy & Security** and use **Open Anyway** if offered and you choose to trust the build.
4. If macOS says the app is damaged, or an organization policy blocks it, stop and report the exact message. Do not disable Gatekeeper, remove quarantine with Terminal commands or bypass management policies.
5. Click **Open account** under Perplexity. Sign in on the actual provider page, select your organization if necessary, and verify the available-credit balance is visible.
6. Return to the dashboard and click **Check now**. A check can take up to approximately 65 seconds.
7. Repeat for OpenRouter and Runware. For Fly.io, first enter and save the organization slug in its card: the name after `/dashboard/` in your Fly.io billing URL. Then open the account, sign in and check.
8. Choose the menu-bar display mode from Overview. Close all account windows and turn on automatic checks. Keep the app running, with your Mac awake and online.

## Updating from 2.0 or 2.1.0

Quit AI Credit Checker from its menu before replacing the app in Applications. Do not delete its Application Support directory: current 2.x builds use the same identity, provider sessions, preferences and history. Existing all, icon-only and individual-provider choices migrate to the equivalent checkbox selection.

When upgrading from 2.0, sign in to the new Fly.io and Runware accounts once. Existing 2.1.x sessions do not need to be recreated. Changing the Fly.io organization clears its current displayed balance to prevent showing one organization's balance under another; previous history is retained with its organization label.

## Moving from Credit Monitor POC

Quit the POC before using 2.0. You may remove the old POC application and unused Stream Deck plugin; AI Credit Checker has no dependency on either.

If you want to keep prior observations, do not use an app-cleaner to delete the POC's application-support data before launching 2.0 once. When a new 2.0 profile is created, it looks for:

```text
~/Library/Application Support/Credit Monitor POC/observations.json
```

Only valid numeric observations and history are imported. The old file is left unchanged. Cookies, passwords and browser sessions are deliberately not migrated, so **sign in once in the new app**.

After you verify the imported history, you may remove the old POC data yourself if no longer needed. If you already removed it, start fresh; no recovery is implied.

## Menu bar

Tick any combination of providers on Overview or in **Menu bar display** in the native menu. **All** selects four; **None (icon only)** hides all counters beside the icon. Preferences lets you switch between compact and exact credit counts. All four balances remain in the native dropdown even when none are selected. This display choice does not pause collection.

Example: `P 12.4K · O $85.20 · F $24.50 · R $39.87`. A Runware observation of `39.872` displays as `$39.87`, rounded to two decimal places, while its full observed value stays in history and JSON exports. These are examples, not starting balances.

Click the icon or its text to open the native menu, where you can open the dashboard, open an account page, check balances, pause automatic checks or quit.

## Running in the background

Closing the dashboard hides it without quitting. Choose every **10, 30 or 60 minutes** on Overview or in the native menu's Balance check interval submenu. Changing the interval resets the next scheduled check without turning a paused schedule on. The choice survives restart.

Collection skips visible account windows and does not prevent sleep. A wake event requests a new check when automatic checks are enabled. Successful readings become stale after twice the selected interval (20, 60 or 120 minutes); a failed reading becomes unavailable immediately. GitHub app-update checks remain separate, every six hours.

Enable **Open at login** in Preferences if desired. It is off by default and uses the standard macOS login-item integration. It is not a privileged daemon.

## App updates via GitHub

The updater is available in **2.1.1 and later**. Use **Preferences → Check for updates → Download & restart** to install 2.1.3. From an older version, install the latest ZIP manually once.

The updater checks the public repository's latest stable release about 15 seconds after launch and every six hours while running. Disable automatic checks in Preferences if desired; manual **Check for updates** remains available there and in the native menu.

When a newer release is available, Preferences offers **Download & restart**. Confirmation is required before downloading and quitting. The updater verifies GitHub's SHA-256 asset digest, the exact bundle identifier and version, the Apple Silicon executable, and the ad-hoc code-signature integrity. The trust source is the project's GitHub repository, not an Apple-verified developer identity.

Install the app in a writable Applications folder (or `~/Applications`) with the name **AI Credit Checker.app**. Read-only folders, app translocation or insufficient permissions prevent automatic installation; the current app remains usable and a manual GitHub download is offered. No sudo, quarantine removal, Gatekeeper changes or managed-policy bypass is attempted.

The old app is retained in a hidden `.ai-credit-checker-update-*` directory beside the installed app. File replacement/open-command failures attempt to restore it; a later application crash is not automatically detected. Saved account sessions and observations are not modified. Installer messages are in `~/Library/Application Support/AI Credit Checker/updates/install.log`; downloaded archives stay in that updates folder. After confirming the new version works, old backup folders and ZIPs can be removed manually.

The new build is still not notarized. macOS may require approval to open it, and automated runner tests cannot guarantee acceptance on every managed Mac.

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

**Fly.io:** Save the correct organization slug before opening its account page. The parser reads “Credit Balance,” not invoice totals or remaining active-credit entries.

**Runware:** Open [Billing](https://runware.ai/settings/billing) and select the intended workspace. The parser reads “Available balance” in the Inference credits card, not “Spent this month.” The old “Current Balance” label remains supported. Full observed precision is retained; the dashboard and menu intentionally display two decimals. Version 2.1.3 fixes the old `/wallet` route being rejected after Runware redirects it to Billing. Existing login sessions are retained.

**Login blocked:** Follow the provider's supported sign-in flow. If embedded browsers are refused, stop; this app does not copy sessions from another browser or bypass SSO policy.

**Unexpected stale values:** Make sure the Mac is awake, automatic checks are enabled, and the account windows are closed. The history shows both successful and failed attempts.

**No visible menu-bar numbers:** Choose a non-icon-only display mode. macOS can hide menu-bar items when horizontal space is limited; try the compact option or a single provider.
