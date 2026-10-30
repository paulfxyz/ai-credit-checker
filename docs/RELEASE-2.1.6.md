# AI Credit Checker 2.1.6

Personal Perplexity plans and a fix for Fly.io sign-ins not being remembered.

## Perplexity: personal Pro/Max or Enterprise

- The Perplexity card has an account choice. **Personal plan (Pro or Max)** is the default and reads the “credits left” total from Usage and credits, which matches “Total available credits” in the Usage menu (plan + purchased + bonus).
- **Enterprise organization pool** keeps the previous organization reader.
- Switching clears the displayed balance so personal and organization values are never mixed. History is labelled personal or organization.

## Fly.io stays signed in

Fly.io's sign-in cookie expires when the browser closes, so every quit or update signed you out. Perplexity, OpenRouter and Runware use expiring cookies and were unaffected. The app now keeps first-party fly.io session cookies for 30 days, only inside its isolated Fly.io partition, and saves cookies before quitting. Fly.io still decides whether the session is valid; signing out on fly.io works as usual.

## Update

On **2.1.1 or later**, use **Preferences → Check for updates → Download & restart**. For a manual install, quit the app and replace it in Applications with the app from `AI-Credit-Checker-2.1.6-macOS-arm64.zip`.

After updating: click **Check now** on Perplexity (personal is the default), then sign in to Fly.io once more. Later restarts should keep the Fly.io sign-in. Other sessions, preferences and history are retained.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized.

## Validation

- 17 unit tests and the full Electron suite pass. New tests cover the personal Perplexity reader (credits left, Usage-menu total, zero, ambiguity, hidden and malformed values), the Enterprise option, and a synthetic Fly.io session cookie surviving a restart while other session cookies do not.
- A standalone probe confirmed this Electron version deletes expiry-less cookies on restart, matching the reported Fly.io behaviour.
- Fixtures are synthetic. Live checks of the personal Perplexity page and of Fly.io after a restart remain user acceptance checks.
