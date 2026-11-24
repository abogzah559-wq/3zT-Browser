# Security policy

## Supported versions

Only the latest release receives fixes. Installed copies update themselves; the update is signed (Ed25519) and its
SHA-256 is verified before it is installed.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include the 3zT version (*Settings → About*), the steps to reproduce, and what an attacker gains. You will get a
reply within a few days, and a fix is released as soon as it is verified.

## Scope

In scope: the browser's own code in this repository (main process, preload scripts, internal pages, the updater,
the built-in features). Chromium and Electron issues belong upstream; 3zT follows Electron's patch releases
(see `.github/workflows/electron-watch.yml`).
