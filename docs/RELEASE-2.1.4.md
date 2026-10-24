# AI Credit Checker 2.1.4

The recommended Runware compatibility update, including the route and label fixes from 2.1.3 plus a final HTML-whitespace regression fix. The other providers, menu controls, check intervals and saved sessions are unchanged.

## Runware fixes

- Open `/settings/billing` directly instead of the old `/wallet` URL.
- Read the new “Available balance” label; retain support for “Current Balance.”
- Exclude “Spent this month” inside the balance card, including nested HTML with no whitespace between the label and amount.
- Preserve full observed precision and the existing two-decimal USD display. Ambiguous amounts fail rather than guess.

## Update

On **2.1.1 or later**, use **Preferences → Check for updates → Download & restart**. For a manual install, quit the app and replace it in Applications with the app from `AI-Credit-Checker-2.1.4-macOS-arm64.zip`.

Keep Application Support data to retain sessions, preferences and history. After updating, open Runware, confirm the intended workspace on Billing, and click **Check now**.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized.

## Validation and release numbering

All 15 unit tests and the real Electron fixture suite passed on 2.1.4, covering all four providers, sessions, menu controls, cadence, layout and updater UI. The macOS packaging workflow runs the native updater fixture and signature verification.

The new Runware fixture is a synthetic reconstruction from the user's screenshot, not a captured live DOM. Authenticated live collection on the redesigned site still needs the first check on the user's Mac. No private screenshot or account data is published.

GitHub published the initial 2.1.3 build before its cancellation took effect. The final whitespace fix is released as 2.1.4 so the published 2.1.3 tag and installer remain unchanged. Packaging now rejects duplicate versions before building.
