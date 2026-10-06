# Security policy

This project is a small community utility, not an official provider client or an audited financial system. Only the latest release is maintained on a best-effort basis.

## Report privately

Use GitHub's private vulnerability-reporting feature if available for this repository. If it is not available, open an issue asking for a private contact channel without including exploit details, credentials or private account data.

Do not post cookies, session directories, passwords, authorization headers or screenshots containing sensitive account information. For ordinary parsing failures, report the app version, provider, visible balance label and redacted error message.

## Boundaries

Provider pages are remote, untrusted content. They must not gain Node access, application IPC access or disabled web security. Changes that weaken sandboxing, bypass provider restrictions or copy sessions from another browser will not be accepted.

The distributable is currently ad-hoc signed, not Apple Developer ID signed or notarized. Release checksums support file-integrity checks, not proof of publisher identity on their own.
