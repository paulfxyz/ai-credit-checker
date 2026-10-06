# Contributing

Small, reviewable improvements are welcome. Please open an issue before implementing a new provider, changing storage or introducing an external service.

## Development

Use Node 22.12 or later, run `npm ci`, then `npm start`. Run `npm test` and the Electron smoke test before sending a pull request.

On Linux, the smoke test runs under `xvfb-run -a npm run test:smoke`. Use synthetic provider pages and fake values. Do not commit real account screenshots, profiles, observation files or authentication data.

## Design and product rules

- Keep the app quiet, legible and local.
- Never represent a missing or failed observation as zero or unlimited.
- Preserve provider units and account scope.
- Prefer exact label anchoring to broad number scraping.
- Keep menu-bar controls simple and expose freshness in the dashboard.
- Do not introduce Stream Deck or browser-extension dependencies.
- Document which behavior was tested and which remains unverified.

## Artwork and screenshots

The app and menu-bar icons are original SVG artwork in `assets/`. Run `npm run assets` to regenerate PNG and ICNS outputs. Public screenshots must use test data and must be identified as illustrative.

## Pull requests

Include the problem, intended behavior, tests and a screenshot for UI changes. Add parser fixtures for label or provider changes. Update CHANGELOG.md for user-visible changes.

Contributions are licensed under the repository's MIT license.
