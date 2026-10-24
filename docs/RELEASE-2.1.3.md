# AI Credit Checker 2.1.3

A focused Runware compatibility patch for the redesigned Billing page. The other providers, menu-bar controls, check intervals and updater are unchanged.

## Fixed

- Open Runware directly at `/settings/billing` instead of `/wallet`. The old route redirects to Billing, which earlier versions rejected as an unexpected account page.
- Recognize the new “Available balance” label as well as the previous “Current Balance” label.
- Exclude explicitly labelled “Spent this month” amounts inside the same card, including nested currency spans. Ambiguous balances still fail rather than guess.
- Keep the full observed precision in history and two-decimal USD display.

## Update

On **2.1.1 or later**, use **Preferences → Check for updates → Download & restart**. For a manual install, quit the app and replace it in Applications with the app from `AI-Credit-Checker-2.1.3-macOS-arm64.zip`.

Keep the Application Support directory to retain login sessions, preferences and history. After updating, open Runware, confirm the intended workspace on Billing, and click **Check now**.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized.

## Validation

The regression fixture reconstructs the new page's visible labels and layout from a user-provided screenshot using synthetic values. It tests monthly spend exclusion, zero, precision, hidden and malformed values, ambiguity and the new route. The Electron fixture suite checks all four providers and existing controls; the macOS release workflow also runs the native updater fixture.

The authenticated live Runware DOM was not accessible in this Computer session. These fixtures do not establish live collection on the redesigned site; the first Runware check after installation remains a user acceptance check. No private screenshot or account data is included in the repository.
