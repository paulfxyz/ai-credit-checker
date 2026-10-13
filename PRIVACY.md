# Privacy

AI Credit Checker stores observations, preferences and website sessions locally on your Mac. It does not send them to a project-operated server and includes no analytics or telemetry integration.

## Network activity

The embedded browser connects to Perplexity, OpenRouter, Fly.io, Runware, their sign-in providers and the resources those websites load. Their own privacy policies and website behavior still apply. “Local only” describes this app's storage and absence of a hosted relay; it does not mean websites are accessed offline.

The app does not call an AI model or use an inference API. It reads explicitly labelled available-balance content from the rendered pages.

Starting with 2.1.1, automatic update checks connect to GitHub's public Releases API on launch and every six hours while the packaged app runs. You can disable these in Preferences. Confirmed downloads use GitHub release-asset servers; no provider cookies, balances, organization slug or account history are included in update requests. GitHub still receives normal connection metadata such as your IP address.

## Storage

The application's user-data directory contains `observations.json` and persistent browser session partitions. The history keeps the latest 2,000 check records. It records balances, units, scope, timestamps, extraction method and bounded error messages. Fly.io's organization slug is stored in preferences and attached to its new observations; Runware observations retain their full parsed precision.

Browser sessions are sensitive. This document does not promise encryption for every file in the app directory. macOS and Chromium manage session storage; use your normal device account and disk protections.

The updates subfolder stores downloaded ZIPs and an installer log. Previous application bundles are retained in hidden update directories beside the installed app; these backups do not copy your account-data directory. Installation requires an explicit restart confirmation.

Exports include observations and history, not cookies, passwords, authorization headers or full page HTML. An export can still disclose financial/account-usage information, so review it before sharing.

## Permissions and isolation

Provider windows have Node integration disabled and no privileged preload bridge. Context isolation, the renderer sandbox and web security remain enabled. Downloads and permission requests such as location/camera are denied. Each provider has its own persistent session partition.

The app does not alter Comet policies, import another browser's cookies, spoof a browser identity to defeat an access restriction, or automate security challenges.

## POC migration

On initial setup, if the previous POC history file exists locally, valid numeric observations may be imported. The original file is not modified. Cookies and credentials are not imported.

## Deletion and reports

Quit the app before deleting its user-data directory. That removes its saved history, preferences and local sessions. Provider-side records remain under the provider's control.

Before posting an issue or screenshot, remove account names, email addresses, balances if sensitive, and any authentication data. See [SECURITY.md](SECURITY.md).
