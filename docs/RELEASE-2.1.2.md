# AI Credit Checker 2.1.2

A focused UI and documentation patch. Account collection, menu-bar selections and check intervals are unchanged.

## Fixed

- Removed the duplicate right-hand scrollbar by giving the app one scrolling content pane.
- Kept bottom controls reachable at both default and minimum window sizes.
- Refreshed the public screenshots from the corrected app.

## Documentation

- Reorganized the README around installation, supported accounts, controls, updates and privacy.
- Clarified 10/30/60-minute balance polling versus six-hour GitHub update checks.
- Grouped changelog entries by change type and separated historical validation caveats from subsequent user confirmation.
- Corrected upgrade guidance: existing 2.1.x sessions remain intact.

## Update

On **2.1.1**, open **Preferences → Check for updates**, then **Download & restart**. The updater asks for confirmation before downloading and replacing the app.

For a manual install, quit the app, download `AI-Credit-Checker-2.1.2-macOS-arm64.zip` and replace it in Applications. Keep Application Support data to retain sessions, preferences and history.

This remains an Apple Silicon, ad-hoc-signed build, not Developer ID signed or notarized. macOS may request approval; no security bypass is provided.

## Validation

The release checks cover unit tests, the real Electron fixture suite and the native macOS updater fixture. New layout regression assertions inspect all three views at default and minimum sizes for outer-document overflow, horizontal overflow and access to the bottom controls.

A future-version update on the user's own Mac still needs live acceptance; fixture tests do not establish Gatekeeper approval on every Mac.
