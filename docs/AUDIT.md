# Code review of earlier AI reports (v0.12.8)

Four AI-written reports were checked against the real code of 0.12.8 before anything was changed.
Nothing was fixed only because a report said so. Every item below was looked up in the code.

Legend: **Confirmed** = real bug, **Possible** = needs a test on Windows, **Suggestion** = not a bug,
**Wrong** = the report's reading of the code is not correct.

| # | Claim | Where | Verdict | Evidence | User impact | Priority | Fix | Test |
|---|---|---|---|---|---|---|---|---|
| 1 | `setUp` and `setUpSessions` duplicate each other | `main.js` `setupSession` | Confirmed (harmless) | two WeakSets guard the same function, the second check can never be true | none | low | keep one guard | private window downloads counted once (e2e) |
| 2 | `resolve(choice, extra)` drops `extra` | `main.js` `finishPermission` | Confirmed (dead code) | a Promise resolves with one value; the device pick travels through `permWait` instead | none today, fragile | low | pass the pick inside the answer itself, drop `permWait` | device/screen pick still works (e2e permissions) |
| 3 | `Ctrl+9` | `main.js` `handleKey` | Confirmed (edge case) | `w.tabs[w.tabs.length-1].id` throws when a window has no tab (while closing) | an error in the log | low | guard | unit |
| 4 | Race when updating a tab title | `main.js` `page-title-updated` | Wrong | the history entry is only renamed when its URL equals the tab's current URL | none | - | - | - |
| 5 | Command quoting in `updater.js` | `waitIfInstalling` | Confirmed (rare) | `"C:\folder\"` is written as `"C:\folder\"` and Windows reads `\"` as a quote | relaunch after an update can lose an argument that ends with `\` | low | Windows argv quoting (double the backslashes before a quote) | unit |
| 6 | EasyList parsing | `adblock.js` `parse` | Confirmed | `$image`, `$script`, `$xmlhttprequest`... are ignored, so a rule meant for one type blocks the whole host; `@@` rules with a type allow the whole host | over-blocking on some sites | medium | keep the resource types of each rule and match them against Electron's `resourceType` | unit tests on sample rules |
| 7 | `bypassCSP` on `zeus-res` | `main.js` / `features.js` | Partly right | needed so YouTube's CSP lets the bundled ambient-light files load; the handler only serves files inside `inject/ambient` (path check present). Any page can still see that the files exist | a site can tell it runs in 3zT (fingerprinting), no file access | low | keep `bypassCSP`; serve only the ambient files that are really used and refuse other hosts (already) | - |
| 8 | Ad blocking supports few rule types | `adblock.js` | Confirmed (by design) | only `||host^` rules; path and cosmetic rules are skipped, YouTube ads are handled separately | some ads stay | medium | add resource types (item 6); cosmetic rules are out of scope for now | - |
| 9 | `uncaughtException` / `unhandledRejection` are swallowed | `main.js` | Partly right | they are logged, but only to the console, which nobody sees in the installed app | errors are invisible | medium | also write them to `logs/3zt.log` (size-limited) | log file appears after a forced error |
| 10 | `main.js` is too big | `main.js` (2 000+ lines) | Suggestion | true | maintenance | low | new features go to their own modules (media downloader, trimming) | - |
| 11 | `installer/3zT.iss` version mismatch | `3zT.iss` | Wrong | the version comes from `package.json` (`/DAppVersion=` in CI); only an old comment says 0.8.0 | none | - | fix the comment | - |
| 12 | `safeStorage` | `passwords.js` | Wrong | passwords are only stored DPAPI-encrypted; without encryption nothing is saved; old `b64:` entries are re-encrypted | none | - | - | - |
| 13 | Disabled Chromium features | `main.js` | Suggestion | `MediaRouter`, `OptimizationHints`, `FedCm`, `WebIdentityDigitalCredentials`; Electron has no UI for FedCM, sites fall back to a normal sign-in popup | none | - | keep | - |
| 14 | Update signing key | `updater.js` | Wrong | Ed25519 public key in the app, private key only in a GitHub secret, unsigned releases are refused | none | - | - | - |
| 15 | Extra permissions | `permissions.js` | Wrong | every request goes through the bar (allow / block / ignore), private windows keep answers in memory only | none | - | - | - |
| 16 | Firefox user agent | `main.js` `SIGNIN_URLS` | Suggestion | only on `accounts.google.com` / `accounts.youtube.com`, needed because Google refuses Electron sign-in | none | - | keep, see the Windows Security window item | - |
| 17 | Link warming | `main.js` `net:warm`, `preload-newtab.js` | Confirmed (small) | a page can fire fake hover events and make the browser pre-connect to hosts it chooses (rate-limited, no data sent) | privacy, minor | low | only real (trusted) mouse events | - |
| 18 | Dark mode detection | `preload-newtab.js` | Fixed in 0.12.0 | dark sites opt out of forced dark | - | - | - | - |

## Found during this review (not in the reports)

| # | Problem | Where | Impact | Fix |
|---|---|---|---|---|
| A | Links and forms that open a new tab (`target=_blank`, `window.open`) lose their **POST data, Referer and `window.opener`**: the new tab is a plain `loadURL` of the address | `main.js` `setWindowOpenHandler` | many download sites send you to another page and straight back, and nothing downloads; sites that open an empty tab and then set its address break | create the tab from Chromium's own new window (`createWindow`), so the request is exactly the one the site made |
| B | A tab that only existed to start a download stays open and empty | `main.js` | extra empty tabs | close it once the download has started, like Chrome |
| C | Downloads made in a private window are kept in the download list after the window is closed | `downloads.js` | privacy | private downloads are not written to `downloads.json` and leave the list with their window |
| D | A light update cannot change the program icon (it lives in `3zT.exe`) | `updater.js` / CI | the new logo would not reach installed copies | releases that change the exe ship the full setup only |
