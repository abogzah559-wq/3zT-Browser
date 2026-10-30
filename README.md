<p align="center">
  <img src="assets/logo.png" width="140" alt="3zT logo">
</p>

<h1 align="center">3zT Browser</h1>

<p align="center">
  A light, fast desktop browser built on Chromium, with an ad blocker, a download manager and the
  YouTube / Twitch extensions people install most often already built in.<br>
  Arabic and English interface. Windows 10 and 11 (64-bit).
</p>

<p align="center">
  <a href="https://github.com/abogzah559-wq/3zT-Browser/releases/latest"><b>Download 3zT-Browser-Setup.exe</b></a>
</p>

---

## Contents

- [Why 3zT](#why-3zt)
- [Install](#install)
- [Memory compared with Chrome and Brave](#memory-compared-with-chrome-and-brave)
- [Features](#features)
- [Built-in extensions and their authors](#built-in-extensions-and-their-authors)
- [Chrome Web Store and your own extensions](#chrome-web-store-and-your-own-extensions)
- [Moving over from Chrome](#moving-over-from-chrome)
- [Privacy](#privacy)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Where your data is kept](#where-your-data-is-kept)
- [Building from source](#building-from-source)
- [How the project is organised](#how-the-project-is-organised)
- [Automated tests](#automated-tests)
- [Known limits](#known-limits)
- [Credits and licenses](#credits-and-licenses)

---

## Why 3zT

Most people end up running Chrome or Brave with the same handful of extensions: an ad blocker,
SponsorBlock, something to clean up YouTube, an ambient-light effect for videos, a Twitch ad
blocker and a download manager. Every extension is another process with its own background page,
so the browser keeps getting heavier.

3zT does those jobs inside the browser itself:

- **No extension processes for the common jobs.** Ad blocking, SponsorBlock, Clean YouTube,
  Ambient light and the Twitch ad blocker run as part of the browser, not as extensions.
- **No background services.** No sync, no account sign-in, no telemetry, no component updater,
  no hidden Chromium background downloads (`--disable-background-networking`), no spare renderer
  process kept warm, no media-router (casting) or optimization-hints services.
- **Sleeping tabs.** Tabs you have not looked at for 15 minutes (you choose 5 to 60, or never) are
  put to sleep and give their memory back. They wake up when you click them.
- **Ads are never downloaded.** The built-in blocker stops ad and tracker requests before they
  load, which saves memory, CPU and data on most websites.
- **A small interface.** The toolbar and tabs are one lightweight page; there is no big settings
  framework running all the time.

There are two performance modes in Settings:

| Mode | What it does |
|---|---|
| **Normal** (default) | Lowest memory: sleeping tabs, background tabs slow down like in Chrome. |
| **Very fast** | Speed first: background tabs keep full speed, the graphics card is used even when Chromium is unsure about it, more raster threads, zero-copy GPU uploads. Uses a bit more memory and power. |

## Install

1. Download **`3zT-Browser-Setup.exe`** from the [latest release](https://github.com/abogzah559-wq/3zT-Browser/releases/latest).
2. Run it. The setup window is dark, needs no administrator rights and installs for your Windows user
   only (in `%LOCALAPPDATA%\Programs\3zT`).
3. Leave **Create a desktop shortcut** ticked if you want a **3zT** icon on the desktop.
   A Start menu entry is always added.
4. Press **Install**, then **Finish** to open 3zT.

To make 3zT your default browser: **⋮ menu → Settings → Default browser → Make default**, then pick
**3zT** in the Windows page that opens (Windows only lets you choose this yourself).

To update, run the newer setup; your tabs, bookmarks, passwords and settings stay.
To uninstall, use **Windows Settings → Apps → 3zT → Uninstall**. Your profile is kept unless you
delete `%APPDATA%\3zT Browser` yourself.

Windows SmartScreen may warn about the setup because it is not code-signed. Choose
**More info → Run anyway**.

## Memory compared with Chrome and Brave

Measured automatically on every release by [`tests/bench.ps1`](tests/bench.ps1) on a GitHub
Windows machine: each browser starts with a new profile and opens the same three websites
(Wikipedia, GitHub, Stack Overflow) in three tabs. Memory is the total of all of the browser's
processes, averaged 30 and 60 seconds after the last tab opened. No extensions are installed in any
of them. The test runs twice, in opposite order, and the two results are averaged.

<!-- BENCH:START -->
Result of version 0.8.0 (GitHub `windows-latest`, two rounds in opposite order, averaged):

| Browser | Processes | Memory (working set) | Memory (private) |
|---|---|---|---|
| **3zT 0.8.0** | 7 | **827 MB** | **399 MB** |
| Brave | 12 | 890 MB | 440 MB |
| Google Chrome | 34 | 1569 MB | 738 MB |

In this test 3zT used about **46% less memory than Chrome** and about **9% less than Brave**,
with fewer processes than both. Each release's own numbers are in its release notes.
<!-- BENCH:END -->

Numbers change with the websites you visit and your hardware. The gap grows when you would
otherwise run the extensions listed below, because in 3zT they do not add processes.

## Features

### Browsing
- Chromium engine (the same engine as Chrome and Brave), so websites work like in Chrome.
- Floating toolbar that takes the colour of the website you are on and keeps it while you browse
  the site.
- Tabs above the toolbar. Drag a tab out to make a new window, drag it onto another window's tabs
  to merge it back. While dragging, move to a screen edge to snap the window: left or right half,
  a corner for a quarter, the top for full screen (a blue preview shows where it goes).
- Private windows (nothing is saved).
- Find in page, zoom per website, print, page translation (Google Translate), full screen,
  developer tools.
- Search from the address bar with Google.
- History page with search. Bookmarks (star button or `Ctrl+D`) show as shortcuts on the new tab page.
- Restore your tabs when the browser opens (can be turned off).
- Opens links for other programs (`mailto:`, `discord://`, `claude://`, ...) through Windows, asking
  first like Chrome does, with an "always allow for this site" option.
- Can be set as the Windows default browser.

### New tab page
- Big clock and date, Google search box, your shortcuts.
- Animated backgrounds drawn in the page (space, galaxy, matrix, aurora, sunset, ocean, fireflies,
  true black, custom colour) or a looping video / your own image or video.
- Can copy the look of your Chrome new tab page.

### Ad blocking
- Built-in blocker using the public **EasyList** and **EasyPrivacy** filter lists, refreshed every
  few hours in the background.
- YouTube video ads are skipped.
- Turn it off for one website from the shield in the toolbar; a counter shows how much was blocked.

### Downloads
- Built-in download manager (no Free Download Manager needed):
  - asks where to save every file with the normal Windows "Save as" window, starting in the
    last folder you used (can be turned off to save straight to a folder);
  - each file downloads over several connections at once (Chromium parallel downloading);
  - pause, resume, cancel and retry, also after closing the browser;
  - speed, size and time left; a progress ring on the toolbar button;
  - downloads page (`zeus://downloads`) with search, "show in folder" and file icons.

### Passwords
- Saves and fills passwords. They are encrypted with Windows' own protection (DPAPI through
  Electron `safeStorage`), the same way Chrome protects them.
- Import from a Chrome passwords CSV export. The file is read on your computer only.

### Performance tools
- Sleeping tabs (memory saver) with a choice of 5, 15, 30 or 60 minutes or never.
- Task manager (`Shift+Esc`) showing memory and CPU for each tab, extension and the browser itself.
- Hardware acceleration switch, performance modes (see above).

### Settings
- One settings page (`zeus://settings`) with collapsible groups: appearance, startup, search,
  privacy and ads, YouTube and Twitch, extensions, downloads, passwords, performance, default
  browser, language and "about".
- Arabic (right-to-left) or English interface.

## Built-in extensions and their authors

These used to be separate Chrome extensions. Their features are now part of 3zT, so they do not run
as extensions. Each one is credited here and in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
If you are an author and want anything changed, please open an issue.

| Feature in 3zT | Original extension | Author | How it is used |
|---|---|---|---|
| **SponsorBlock** - skips sponsor, self-promotion and "subscribe" reminders in YouTube videos (you choose the categories) | [SponsorBlock](https://sponsor.ajay.app) | Ajay Ramachandran and contributors | 3zT's own small implementation that reads skip segments from the public SponsorBlock API (`sponsor.ajay.app`). The segment data is made by the SponsorBlock community and is licensed CC BY-NC-SA 4.0. No SponsorBlock code is included. |
| **Clean YouTube** - hide Shorts, comments, recommendations, notifications, likes, views, live chat, the home feed, end-screen cards; black-and-white and "clean" modes | Clean YouTube: Block Shorts, Hide Comments & Feeds (Chrome Web Store, v1.9.8) | Clean YouTube developer | The list of YouTube page elements to hide is adapted from that extension; the switches and the code that applies them are 3zT's own. |
| **Ambient light** - the glow around YouTube videos that follows the picture | [Ambient light for YouTube™](https://github.com/WesselKroos/youtube-ambilight) v2.38.17 | Wessel Kroos | The original scripts and styles, included unmodified except for one loading line, under the MIT License (`src/inject/ambient/`). |
| **Twitch ad blocking** | [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) - the `vaft` script (as used by Pie Adblock) | pixeltris and contributors | The original `vaft` script, included under the MIT License (`src/inject/twitch-vaft.js`). |
| **Ad blocker** | [EasyList / EasyPrivacy](https://easylist.to) filter lists | The EasyList authors | Downloaded at runtime (not stored in this repository), used under their GPL-3.0 / CC BY-SA 3.0 licenses. |
| **Download manager** | replaces Free Download Manager | - | 3zT's own code using Chromium's download engine. No FDM code is used. |

**Dark Reader** is not built in. Install it from the Chrome Web Store (see below); it works in 3zT.

YouTube is a trademark of Google LLC and Twitch is a trademark of Twitch Interactive, Inc. 3zT is
not affiliated with them or with any of the projects above.

## Chrome Web Store and your own extensions

- **Chrome Web Store:** open **Extensions (puzzle icon) → Chrome Web Store** or
  `https://chromewebstore.google.com`, press **Add to 3zT** on any extension and confirm (the store
  puts the browser's name on its button; it also shows a "Switch to Chrome?" note that you can close).
  3zT downloads it from Google, checks that the package matches the extension ID, installs it and
  keeps it updated (checked at start and every few hours). Remove it from the puzzle menu or
  Settings → Extensions.
- **Your Chrome extensions:** on first start 3zT can bring over the extensions you have in Chrome,
  together with their saved settings. Ones that are now built in are skipped.
- **An unpacked extension folder:** puzzle menu → **Add extension folder…**.
- Pin extensions to the toolbar with the pin button; their popups open under the button.

Only **Manifest V3** extensions can be installed (Chrome itself no longer runs Manifest V2).
Extensions run on Chromium's extension system as provided by Electron, which does not include every
Chrome extension API. 3zT adds a compatibility layer for the common missing ones (`storage.sync`,
`commands`, `windows`, `contextMenus`, `fontSettings`, badge text, `runtime.onInstalled`). Extensions that
need `nativeMessaging` or `offscreen` documents cannot work and are skipped when importing.

## Moving over from Chrome

The first time 3zT starts it reads your Chrome profile (read only; Chrome is not changed) and brings:

- bookmarks and their icons,
- the look of your Chrome new tab page,
- your extensions and their settings (as above).

Passwords are imported separately from a CSV file you export in Chrome
(Chrome → Passwords → Settings → Export), in **⋮ → Passwords → Import**.

## Privacy

- No account, no sync, no telemetry, no crash reports sent anywhere.
- 3zT itself only connects to: the websites you open, Google for search suggestions and translation
  when you use them, `easylist.to` for the ad-block lists, `sponsor.ajay.app` when you watch YouTube
  with SponsorBlock on (only a 4-character hash prefix of the video ID is sent, the same privacy
  method SponsorBlock uses), and Google's extension servers when you install or update a Chrome
  Web Store extension.
- Private windows keep nothing after they close.
- Passwords are encrypted with Windows DPAPI.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+T` / `Ctrl+W` | New tab / close tab |
| `Ctrl+Shift+T` | Reopen closed tab |
| `Ctrl+N` / `Ctrl+Shift+N` | New window / new private window |
| `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+1…8`, `Ctrl+9` (last) | Switch tabs |
| `Ctrl+L`, `F6`, `Alt+D` | Address bar |
| `Ctrl+F` | Find in page |
| `Ctrl+R` / `F5` (`Ctrl+Shift+R` without cache) | Reload |
| `Alt+←` / `Alt+→` | Back / forward |
| `Ctrl+H` / `Ctrl+J` | History / downloads |
| `Ctrl+D` | Bookmark this page |
| `Ctrl+P` | Print |
| `Ctrl` `+` / `-` / `0` | Zoom in / out / reset |
| `F11` | Full screen |
| `F12` / `Ctrl+Shift+I` | Developer tools |
| `Ctrl+U` | View page source |
| `Shift+Esc` | Task manager |

## Where your data is kept

Everything stays on your computer in `%APPDATA%\3zT Browser`:

| File / folder | What |
|---|---|
| `settings.json` | your settings |
| `bookmarks.json`, `history.json`, `favicons.json` | bookmarks, history, site icons |
| `session.json` | open windows and tabs (for "restore tabs") |
| `downloads.json` | the downloads list |
| `passwords.json` | saved passwords, encrypted |
| `extensions\` | extensions copied from Chrome or added from a folder |
| `webstore\` | extensions installed from the Chrome Web Store |
| `adblock\` | the downloaded filter lists |
| the rest | Chromium's own cookies, cache and site storage |

## Building from source

3zT is an [Electron](https://www.electronjs.org) app with **no npm dependencies**: the project folder
is the app. You need [Node.js](https://nodejs.org) 20+ only to run it in development, and Python 3
with Pillow to build the Windows folder.

Run from source:

```
npm install electron@45.1.0 --no-save
npx electron .
```

Build the Windows app folder and the installer (on Windows):

```
:: 1. the official Electron build for Windows
curl -LO https://github.com/electron/electron/releases/download/v45.1.0/electron-v45.1.0-win32-x64.zip

:: 2. dist\3zT\3zT.exe  (renames electron.exe, sets the icon and name, copies the app in)
python -m pip install pillow
python scripts\build_win.py electron-v45.1.0-win32-x64.zip

:: 3. dist\3zT-Browser-Setup.exe  (Inno Setup 6.6 or newer, for the dark wizard)
ISCC installer\3zT.iss /DAppVersion=0.8.0
```

`scripts/build_win.py` also works on Linux; only the installer step needs Windows.
The GitHub Actions workflow in [`.github/workflows/build.yml`](.github/workflows/build.yml) does all
of this, tests the result and publishes a release whenever the version in `package.json` changes.

## How the project is organised

```
src/
  main.js              main process: windows, tabs, toolbar, settings, downloads wiring, extensions,
                       Chrome Web Store, default-browser registration, keyboard, memory saver
  preload-ui.js        bridge for the toolbar
  preload-newtab.js    bridge for the internal pages (new tab, settings, history, downloads, ...)
  features.js          built-in SponsorBlock, Clean YouTube, Ambient light, Twitch ad blocking
  adblock.js           the ad blocker (EasyList / EasyPrivacy matcher)
  downloads.js         the download manager
  passwords.js         encrypted password store
  chrome-import.js     reads bookmarks, favicons and new-tab settings from Chrome
  ext-import.js        copies Chrome extensions over and patches them for Electron
  ext-shim.js          the compatibility layer added to extensions
  ui/                  the toolbar and tabs (HTML/CSS/JS)
  newtab/              internal pages: new tab, settings, history, downloads, passwords, task manager
  inject/              scripts injected into YouTube / Twitch (third-party, see credits)
  vendor/chrome-web-store/
                       Chrome Web Store support (bundled electron-chrome-web-store)
assets/                logo and icons
installer/             Inno Setup script and wizard images
scripts/               build_win.py (app folder), patch_exe.py (icon and name inside the .exe)
tests/                 e2e.mjs (end-to-end test), bench.ps1 (memory comparison)
```

Internal pages use the `zeus://` address scheme (`zeus://settings`, `zeus://downloads`,
`zeus://history`, `zeus://passwords`, `zeus://tasks`).

## Automated tests

[`tests/e2e.mjs`](tests/e2e.mjs) starts the installed browser and drives it through the Chrome
DevTools Protocol. On every push, GitHub Actions on Windows:

1. builds the app and the installer,
2. installs it silently and checks the program, the desktop shortcut, the Start menu entry and the
   browser registration,
3. checks that the toolbar and every internal page open with no script errors and that websites load,
4. installs **Dark Reader** and **uBlock Origin Lite** from the real Chrome Web Store with the
   store's "Add to 3zT" button, checks that Dark Reader really darkens a website, restarts the browser,
   checks both are still there and removes them again,
5. uninstalls and checks everything was removed,
6. on releases, runs the memory comparison with Chrome and Brave.

## Known limits

- Windows only for now (the code runs on Linux and macOS too, but no installer is made for them).
- Chrome extensions: see the API note above. Extension options pages and popups work; features that
  depend on Chrome-only APIs inside an extension may not.
- No sync between computers, by design.
- The setup is not code-signed yet, so SmartScreen may warn the first time.
- DRM video (Netflix, Disney+, Spotify web player) does not play: Electron does not ship Google's
  Widevine module.

## Credits and licenses

3zT's own code is released under the [MIT License](LICENSE).
Third-party parts keep their licenses; the full list with license texts is in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In short:

- [Electron](https://github.com/electron/electron) and [Chromium](https://www.chromium.org) - MIT / BSD-style (license files are shipped with the app).
- [Ambient light for YouTube](https://github.com/WesselKroos/youtube-ambilight) by Wessel Kroos - MIT.
- [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) `vaft` by pixeltris - MIT.
- [electron-chrome-web-store](https://github.com/samuelmaddock/electron-browser-shell) by Samuel Maddock - MIT; [adm-zip](https://github.com/cthackers/adm-zip) - MIT; [pbf](https://github.com/mapbox/pbf) - BSD-3-Clause.
- [SponsorBlock](https://sponsor.ajay.app) data - CC BY-NC-SA 4.0 (used through its public API).
- [EasyList / EasyPrivacy](https://easylist.to) - GPL-3.0 / CC BY-SA 3.0 (downloaded at runtime).
- Clean YouTube (Chrome Web Store) - element list adapted, credited above.

The video on the new tab page is a short anime clip used as a background. It is not covered by the
MIT License and belongs to its rights holders; it will be removed on request.
