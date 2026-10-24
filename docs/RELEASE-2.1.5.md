# AI Credit Checker 2.1.5

Fixes balance checks after an account window is closed. In 2.1.4, Runware worked only while its window stayed open.

## Fixed

- **Closed account windows:** Closing an account window hides it, and Chromium then stops rendering that page. Runware's Billing page builds its balance in the browser, so the hidden page never displayed it, causing "Available-credit label not found."
- Checks for a closed window now load the page in a temporary, invisible offscreen reader that uses the same saved login, then discard it. A visible account window is still read directly.
- The change applies to all four providers. Runware's route, label and monthly-spend handling from 2.1.3 and 2.1.4 are unchanged.

## Update

On **2.1.1 or later**, use **Preferences → Check for updates → Download & restart**. For a manual install, quit the app and replace it in Applications with the app from `AI-Credit-Checker-2.1.5-macOS-arm64.zip`. Sessions, preferences and history are retained; you do not need to sign in again.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized.

## Validation

- A standalone Electron probe, run without automation, reproduces the bug: a shown-then-hidden window does not render a client-side page, while the offscreen reader does. It runs in CI and on the macOS release runner.
- The Electron suite opens and closes the Runware window, checks a client-rendered Billing fixture, and asserts a temporary offscreen reader was used and destroyed. The previous code fails this test.
- All 15 unit tests and the full Electron suite pass. Fixtures are synthetic; the first check after closing the live Runware window remains a user acceptance check.
