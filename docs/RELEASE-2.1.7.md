# AI Credit Checker 2.1.7

Fixes two check failures reported on 2.1.6 while both pages were signed in.

## Perplexity personal credits

Perplexity opens Usage and credits as a Settings modal and changes the page address. 2.1.6 required the exact `/account/usage` address, so it reported “Sign-in, verification, or organization selection is required” even when the page showed your credits. Personal mode now accepts any perplexity.ai page except sign-in and organization pages, and still reads only the exact “credits left” total.

## Fly.io balance label

Fly.io renamed its billing label to “Purchased Credit Balance.” The app reads it, keeps supporting the older “Credit Balance,” and still ignores invoice amounts.

## Update

Use **Preferences → Check for updates → Download & restart**, or replace the app with the one from `AI-Credit-Checker-2.1.7-macOS-arm64.zip`. Then click **Check all**. Sessions, preferences and history are retained.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized.

## Validation

- 17 unit tests and the full Electron suite pass, including rewritten Perplexity addresses, rejected sign-in and look-alike hosts, and Fly.io's new label.
- Fixtures are synthetic. Live checks on your Mac remain the acceptance test.
