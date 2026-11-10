<p align="center">
  <img src="assets/logo.png" width="140" alt="3zT logo">
</p>

<h1 align="center">3zT Browser</h1>

<p align="center">
  A light, fast desktop browser built on Chromium, with an ad blocker, a download manager, a video and
  photo downloader and the YouTube / Twitch extensions people install most often already built in.<br>
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
- [Questions](#questions)
- [Known limits](#known-limits)
- [Changes](#changes)
- [Contributing](#contributing)
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

**Updates are automatic and silent.** While you browse, 3zT checks this repository's releases,
downloads a newer setup in the background and checks it: its SHA-256 must match, and the release
must carry the project's Ed25519 signature (made in GitHub Actions with a key only the repository's
secrets hold; the public half is built into the browser). When you close
the browser it installs it with no windows or questions. The next time you open 3zT, a small green
note says it was updated, with a **Details** button that lists what changed (from
[CHANGELOG.md](CHANGELOG.md)); it disappears after 3 seconds. Your tabs, bookmarks, passwords and
settings stay. (Version 0.8.0 had no updater: install 0.9.0 or newer once by hand.)
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
Results so far (GitHub `windows-latest`, private memory, each run = two rounds averaged):

| Run | 3zT | Brave | Google Chrome |
|---|---|---|---|
| 0.8.0, run 1 | **399 MB** (7 processes) | 440 MB (12) | 738 MB (34) |
| 0.8.0, run 2 | **396 MB** (7) | 436 MB (12) | 908 MB (35) |
| 0.9.0 | 407 MB (7) | **392 MB** (10) | 870 MB (34) |
| 0.13.0 (before release) | **390 MB** (7) | 454 MB (10) | 906 MB (34) |
| 0.14.0 | 388 MB (7) | 450 MB (10) | **360 MB** (10) |

So far 3zT uses **about half the memory of Chrome** and **about the same as Brave** (a few
percent lower or higher depending on the run), with the fewest processes. Each release's own
numbers are in its release notes.
<!-- BENCH:END -->

Each release's notes also list 3zT's own use in everyday situations (1, 5 and 10 websites, a playing
video, a second window, a download, and memory after opening and closing 40 tabs), measured by
[`tests/resources.mjs`](tests/resources.mjs). The GitHub machine has no graphics card, so GPU and
video memory are not measured there.

Numbers change with the websites you visit and your hardware. The gap grows when you would
otherwise run the extensions listed below, because in 3zT they do not add processes.

## Page speed compared with Chrome and Brave

Measured by [`tests/speed.mjs`](tests/speed.mjs) on a GitHub Windows machine: each browser starts with a
new profile and opens the same six websites (Wikipedia, GitHub, Stack Overflow, BBC News, CNN,
Amazon), first with an empty cache and then again; two passes in opposite order, medians. "Usable"
is when the page can be read and used (DOMContentLoaded), "fully loaded" is the load event.

Two runs on the same day, same code (ms, medians):

| Browser | Usable, empty cache | Fully loaded, empty cache | Usable, cached | Fully loaded, cached |
|---|---|---|---|---|
| 3zT (run 1) | 978 | 1578 | 649 | 968 |
| Google Chrome (run 1) | 1306 | 1643 | 586 | 802 |
| Brave (run 1) | 1154 | 1920 | 585 | 1039 |
| 3zT (run 2) | 634 | 1068 | 535 | 954 |
| Google Chrome (run 2) | 494 | 1006 | 540 | 925 |
| Brave (run 2) | 793 | 774 | 587 | 825 |

Honest reading: all three use the same Chromium engine and are about equally fast; which one
"wins" changes from run to run with the network of the test machine. 3zT's advantage is that it
gets there with half the memory of Chrome and without loading ads and trackers. Each release's own numbers are in its release notes.

## Features

### Browsing
- Chromium engine (the same engine as Chrome and Brave), so websites work like in Chrome.
- Dark everywhere: no white flash while pages load; sites with a dark design use it and the rest
  are darkened by Chromium's own dark mode for web pages (photos and video are left as they are).
  Settings → General → *Dark mode for every site*.
- Faster opening of links: while the mouse is on a link, 3zT already connects to that site; the
  address bar does the same for what you type. A spare page process is kept ready.
- Address bar in Arabic or English (Arabic right to left), with your past searches, pages you
  visited and Google suggestions.
- Floating toolbar that takes the colour of the website you are on and keeps it while you browse
  the site.
- Pin a tab (right-click it → *Pin tab*): it shrinks to its icon, stays at the start and comes back
  after a restart.
- Tabs above the toolbar. Drag a tab out to make a new window, drag it onto another window's tabs
  to merge it back. While dragging, move to a screen edge to snap the window: left or right half,
  a corner for a quarter, the top for full screen (a blue preview shows where it goes).
- Private windows (nothing is saved).
- Find in page, zoom per website, print, page translation in place like Chrome (Google Translate: the page stays open and usable, new text is translated too, and the rest of the site follows until you turn it off), full screen,
  developer tools.
- Search from the address bar with Google.
- Interface in the [Thmanyah](https://thmanyah.com) font (top bar, new tab and the browser's own pages) when it is
  installed on Windows; otherwise the previous font is used. The font files are not shipped with 3zT.
  Settings → General → *Thmanyah font on every site* puts it on websites' text too (icons keep their font).
- History page with search. Bookmarks (star button or `Ctrl+D`) show as shortcuts on the new tab page.
- Restore your tabs when the browser opens (can be turned off).
- Links, forms and scripts that open a new tab get exactly the request the site made (its form data,
  the page it came from, `window.opener`), the same as in Chrome. Download sites rely on this.
- Sign-in pages no longer pop up the Windows Security window (Windows Hello / "insert your security
  key") by themselves. **Passkeys are off by default** (*Settings → Ads & privacy → Sign in with passkeys*):
  passkey requests from sites are answered "no passkey", so the site carries on with your password.
  The one exception is a security key used as your account's second step (the site names your key)
  right after you click: that still reaches Windows, so 2-step sign-in with a key keeps working. This also covers embedded sign-in boxes and the blank frames and windows a sign-in page
  makes to get an untouched copy of the passkey function (Google's sign-in does that), and the changed
  functions look built in to the page. Turn the option on if you use a passkey or a security key: then
  only background requests are refused, and a passkey you choose yourself (a click on "Sign in with a
  passkey" / "Use a security key") or one the site asks for a named account opens Windows' window.
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
  - the download button in the toolbar opens a list of this session's downloads: click a file to
    open it, the folder button to show it in File Explorer, or pause / resume / cancel / retry;
    the list starts empty each time the browser opens;
  - downloads page (`3zt://downloads`, `Ctrl+J`) with the full history, search, "show in folder"
    and file icons;
  - drag a finished file from the toolbar list or the downloads page straight onto a website's upload
    box, the desktop or a folder (a real Windows file drag);
  - file names in Arabic and other languages are kept (from the server's `Content-Disposition`,
    including `filename*=UTF-8''…`, or from the page's `<a download="…">`);
  - a tab a site opened only to start a download closes by itself, like in Chrome;
  - private-window downloads are saved as files but are not kept in the list.

### Video, audio and photo downloader
The former **3zT Download** app is now part of the browser.

- On a page with a video or a post (YouTube, TikTok, Instagram, X, Facebook, Twitch clips, Reddit,
  Vimeo, SoundCloud, Pinterest and others, or any page that plays a real video) a small fox button
  appears in the address bar. It opens the downloader's own small window with the page's link filled
  in, and shows the video's picture, title, channel and length so you can confirm before downloading.
  The downloads page has a button to open it too.
- Save the **video** (best quality or 4K / 1440p / 1080p / 720p / 480p / 360p, as MP4), the **audio**
  as MP3, or the **photos** of a post (TikTok photo posts, Instagram, X...): every photo is shown and
  you pick the ones to keep.
- **Download only a part:** as soon as the link's preview shows up, a timeline under it lets you set
  the start and end (drag the handles or type the times, "Current time" takes it from the preview
  player, which only plays your part). Only that part is downloaded, not the whole video. Two ways to cut:
  - *Fast, same quality*: nothing is re-encoded. The cut starts at the nearest key frame before your
    start time, so it can begin a few seconds early.
  - *Frame-exact*: the edges are re-encoded (H.264) so the cut is exact. A little slower.
  A site that can't send a part of a video gets the whole video downloaded and cut on your computer;
  the result is the same, only slower. Finished videos in the downloads list have a *Trim* button too
  (the result is a new "(clip)" file).
- Downloads start right away: the details read for the preview are reused (for 10 minutes), so the
  site is not read a second time; one bar covers the whole job (picture, sound and joining them).
- TikTok's *For You* feed keeps the same address while you scroll: the fox button takes the video
  that is playing on screen and builds its own link (`tiktok.com/@user/video/…`).
- Content you can only see when signed in works too: the site's own cookies (only that site's) are
  handed to the downloader in a temporary file that is deleted when the job ends.
- The tools it uses - [yt-dlp](https://github.com/yt-dlp/yt-dlp),
  [gallery-dl](https://github.com/mikf/gallery-dl) and [FFmpeg](https://ffmpeg.org) (yt-dlp's Windows
  build) - come with the setup (checked against the SHA-256 sums their releases publish when the setup
  is built), so there is nothing to wait for. Nothing runs in the background: they only run while
  something is downloading or being trimmed. If a site stops working, *Update download tools*
  updates yt-dlp and gallery-dl.
- There is no local server and no open port: the downloader window talks to the browser through its
  own internal messaging. Closing the window (asks first if something is still downloading) stops
  every program it started, deletes its temporary files and clears its list; it opens empty next time.
- Files are saved to `Downloads\3zT` (you can choose another folder).

### Site permissions
- When a site wants something sensitive (camera, microphone, location, notifications, reading the
  clipboard, MIDI, window placement, USB / HID / serial devices, screen sharing), a small bar
  appears under the address bar with **Allow** and **Block**. It never blocks the browser; if you
  ignore it, it closes after 6 seconds (it waits while the mouse is on it) and the site is refused
  that time only. A small icon in the address bar then lets you change your mind.
- Allow and Block are remembered for each site (private windows: until they close).
  Camera and microphone are separate.
- The shield button shows the current site's permissions with **Allow / Block / Ask** for each.
  **Settings → Ads & privacy → Site permissions** lists every site and lets you flip or reset them.
- Screen sharing shows a picker with your screens and windows (the computer's sound can be shared
  with a whole screen). USB, HID and serial devices are picked from a list.
- Normal browsing never asks: downloads, PDFs, video and sound, cookies, JavaScript, WebGL /
  WebRTC, full screen, copying to the clipboard and uploading files you choose all just work.

### Passwords
- Saves and fills passwords. They are encrypted with Windows' own protection (DPAPI through
  Electron `safeStorage`), the same way Chrome protects them, and are never saved unencrypted.
- Sites are matched with the Public Suffix List: `a.github.io` and `b.github.io` are different
  sites and never see each other's passwords; `www.bbc.co.uk` and `news.bbc.co.uk` are the same.
- Import from a Chrome passwords CSV export. The file is read on your computer only.

### Performance tools
- Sleeping tabs (memory saver) with a choice of 5, 15, 30 or 60 minutes or never.
- Task manager (`Shift+Esc`) showing memory and CPU for each tab, extension and the browser itself.
- Hardware acceleration switch, performance modes (see above).

### Settings
- One settings page (`3zt://settings`) with collapsible groups: appearance, startup, search,
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
  method SponsorBlock uses), Google's extension servers when you install or update a Chrome
  Web Store extension, and GitHub (`api.github.com`) every few hours to look for a 3zT update
  (installed copies only; nothing about you is sent). The video downloader connects to the site
  you give it (and to GitHub / Codeberg only when you press *Update download tools*).
- Private windows keep nothing after they close.
- Passwords are encrypted with Windows DPAPI.
- Nothing sensitive (camera, microphone, location, notifications, screen...) is given to a site
  without your answer; see *Site permissions* above.
- Updates are signed; an update without the project's signature is never installed.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+T` / `Ctrl+W` | New tab / close tab |
| `Ctrl+Shift+T` | Reopen closed tab |
| `Ctrl+N` / `Ctrl+Shift+N` | New window / new private window |
| `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+PgDn`, `Ctrl+PgUp`, `Ctrl+1…8`, `Ctrl+9` (last) | Switch tabs |
| `Ctrl+Shift+PgDn` / `Ctrl+Shift+PgUp` | Move the tab right / left |
| `Ctrl+Shift+W` | Close the window |
| `Ctrl+L`, `F6`, `Alt+D` | Address bar |
| `Ctrl+F`, `F3` / `Shift+F3` | Find in page, next / previous |
| `Ctrl+R` / `F5` (`Ctrl+Shift+R` without cache) | Reload |
| `Alt+←` / `Alt+→` | Back / forward |
| `Ctrl+H` / `Ctrl+J` | History / downloads page |
| `Ctrl+D` | Bookmark this page |
| `Ctrl+P` | Print |
| `Ctrl` `+` / `-` / `0` | Zoom in / out / reset |
| `F11` | Full screen |
| `F12` / `Ctrl+Shift+I` / `Ctrl+Shift+J` | Developer tools |
| `Alt+Home` | New tab page in this tab |
| `Ctrl+Shift+Delete` | Settings (clear browsing data) |
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
| `adblock\` | the downloaded filter lists (and a parsed copy for a faster start) |
| `media\tools\` | the video downloader's own copies of yt-dlp and gallery-dl (they update themselves) |
| `logs\3zt.log` | errors the browser ran into (kept under 1 MB), useful for bug reports |
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
ISCC installer\3zT.iss /DAppVersion=<version from package.json>
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
  downloads.js         the download manager (file names, resume, private downloads)
  media/engine.js      the video / audio / photo downloader and trimming (yt-dlp, gallery-dl, FFmpeg)
  media/detect.js      which pages get the download button
  updater.js           silent, signed updates from GitHub releases
  permissions.js       site permissions (what is asked, what is remembered)
  domains.js           "same site" from the Public Suffix List (passwords, ad blocker)
  passwords.js         encrypted password store
  chrome-import.js     reads bookmarks, favicons and new-tab settings from Chrome
  ext-import.js        copies Chrome extensions over and patches them for Electron
  ext-shim.js          the compatibility layer added to extensions
  ui/                  the toolbar and tabs (HTML/CSS/JS)
  newtab/              internal pages: new tab, settings, history, downloads, passwords, task manager
  inject/              scripts injected into YouTube / Twitch (third-party, see credits)
  vendor/chrome-web-store/
                       Chrome Web Store support (bundled electron-chrome-web-store)
  vendor/tldts.js      Public Suffix List (bundled tldts)
assets/                logo and icons
installer/             Inno Setup script and wizard images
scripts/               build_win.py (app folder), patch_exe.py (icon and name inside the .exe),
                       sign-update.mjs (signs a release for the updater)
tests/                 e2e.mjs (end-to-end test), update-test.mjs (silent update test),
                       bench.ps1 (memory comparison)
```

Internal pages use the `3zt://` address scheme (`3zt://settings`, `3zt://downloads`,
`3zt://history`, `3zt://passwords`, `3zt://tasks`); the old `zeus://` addresses still open them.

## Automated tests

[`tests/e2e.mjs`](tests/e2e.mjs) starts the installed browser and drives it through the Chrome
DevTools Protocol. On every push, GitHub Actions on Windows:

1. builds the app and the installer,
2. installs it silently and checks the program, the desktop shortcut, the Start menu entry and the
   browser registration,
3. checks that the toolbar and every internal page open with no script errors and that websites load,
   then the site permissions: the question bar, Allow / Block / ignored, remembering, the site
   panel, and screen sharing with the picker,
4. installs **Dark Reader** and **uBlock Origin Lite** from the real Chrome Web Store with the
   store's "Add to 3zT" button, checks that Dark Reader really darkens a website, restarts the browser,
   checks both are still there and removes them again,
5. downloads the ways real sites start them: a form in a new tab (POST data and Referer kept), an
   empty tab whose address the page sets, a redirect to a signed link, a file made in the page
   (`blob:`), several at once, a connection that breaks half way (Range resume, bytes compared),
   cancelling, and Arabic file names,
6. the video downloader: tools ready at once, downloads a video, downloads only a chosen part from
   the window's timeline (frame-exact 3.8 s checked with ffprobe; and a site that can't send parts),
   trims finished files, checks the address-bar button, that closing the window stops its tools and
   clears its list, and tries YouTube and
   TikTok (reported only: sites often refuse GitHub's datacenter machines),
7. checks that a background passkey request on a sign-in page no longer opens the Windows Security
   window, also from a blank frame the page makes (Google's trick), that passkeys are off by default
   and that, turned on, a passkey you click still reaches Windows,
8. tests the silent update: a newer build is offered as a fake release, the running browser must
   download and verify it, install it silently after being closed, reopen by itself if started
   during the install, and show the green note with the release notes,
9. uninstalls and checks everything was removed,
10. runs the memory and page-speed comparisons with Chrome and Brave,
11. publishes a release with the setup, its SHA-256 and the notes from `CHANGELOG.md` when the
   version number changes.

## Questions

**Is it really lighter than Chrome?** It depends on the run. In most of our automated runs it used
about half of Chrome's memory with the same tabs; in the 0.14.0 run Chrome came out slightly lower
(Chrome started fewer processes that time). Against Brave it is usually a little lower (see the tables
above). Page speed is about the same as
both: it is the same engine.

**How do I get an update right now instead of waiting?** Settings → About → *Check for updates*.
It downloads the update at once; *Restart to update* installs it in a few seconds and reopens your
tabs.

**A site's download button sends me to another page and back, and nothing downloads.** This was
fixed in 0.13.0: new tabs now carry the site's exact request. If a site still fails, the file you
expected may be behind a captcha or a timer on the site itself; please open an issue with the
address.

**The Windows Security window still opens when I sign in.** With passkeys off (the default) a site
cannot open it. If you turned *Sign in with passkeys* on, it opens when the site asks in the
foreground (after you chose "Sign in with a passkey", or when your account only allows passkeys):
choose *Try another way* or *Use your password* on the site, or cancel the window.

**Google sometimes says "Couldn't sign you in - this browser or app may not be secure".** Google
refuses browsers built on Electron. 3zT looks like Firefox on Google's sign-in pages only (also inside
their hidden frames), which Google accepts; but Google checks more than it says, and once in a while
it still refuses. *Try again* usually works on the second or third try. The only complete fix would
be a browser built on Chromium's own code instead of Electron, which is a different project.

**Where are my old downloads from 3zT Download?** In `Downloads\3zT Download`; 3zT saves new ones to
`Downloads\3zT` unless you pick that folder again.

## Known limits

- Windows only for now (the code runs on Linux and macOS too, but no installer is made for them).
- Chrome extensions: see the API note above. Extension options pages and popups work; features that
  depend on Chrome-only APIs inside an extension may not.
- No sync between computers, by design.
- The setup is not code-signed yet, so SmartScreen may warn the first time.
- DRM video (Netflix, Disney+, Spotify web player) does not play: Electron does not ship Google's
  Widevine module. The video downloader does not download DRM-protected video either.
- Passkey autofill (picking a saved passkey from the username box) is not available; passkeys work
  when you choose them on the site.

- The ad blocker uses the host rules of EasyList / EasyPrivacy (with their resource types); path and
  cosmetic rules are not applied.
- Sites change often; when one stops working in the video downloader, *Update download tools*
  usually fixes it. Some sites refuse automated downloads entirely.
- The icon of a taskbar shortcut you pinned yourself may keep the old picture until Windows refreshes
  its icon cache (unpin and pin again).

## Changes

Every version's changes, in English and Arabic, are in [CHANGELOG.md](CHANGELOG.md) and in the
[release notes](https://github.com/abogzah559-wq/3zT-Browser/releases).

## Contributing

Bug reports and suggestions are welcome as [issues](https://github.com/abogzah559-wq/3zT-Browser/issues).
Please include the 3zT version (Settings → About), what you did, and if possible the file
`%APPDATA%\3zT Browser\logs\3zt.log`. Pull requests should keep the browser light: no new background
services, and new features loaded only when used.

## Credits and licenses

3zT's own code is released under the [MIT License](LICENSE).
Third-party parts keep their licenses; the full list with license texts is in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). In short:

- [Electron](https://github.com/electron/electron) and [Chromium](https://www.chromium.org) - MIT / BSD-style (license files are shipped with the app).
- [Ambient light for YouTube](https://github.com/WesselKroos/youtube-ambilight) by Wessel Kroos - MIT.
- [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) `vaft` by pixeltris - MIT.
- [electron-chrome-web-store](https://github.com/samuelmaddock/electron-browser-shell) by Samuel Maddock - MIT; [adm-zip](https://github.com/cthackers/adm-zip) - MIT; [pbf](https://github.com/mapbox/pbf) - BSD-3-Clause.
- [tldts](https://github.com/remusao/tldts) - MIT, with the [Public Suffix List](https://publicsuffix.org) - MPL-2.0.
- [SponsorBlock](https://sponsor.ajay.app) data - CC BY-NC-SA 4.0 (used through its public API).
- [EasyList / EasyPrivacy](https://easylist.to) - GPL-3.0 / CC BY-SA 3.0 (downloaded at runtime).
- Clean YouTube (Chrome Web Store) - element list adapted, credited above.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Unlicense, [gallery-dl](https://github.com/mikf/gallery-dl) - GPL-2.0, [FFmpeg](https://ffmpeg.org) (yt-dlp's GPL build) - GPL: shipped unmodified in the setup (`resources\\tools`) and run as separate programs.
- Thmanyah font by [Thmanyah](https://thmanyah.com) - free to use, not redistributed: 3zT only uses the copy you install.

The video on the new tab page is a short anime clip used as a background. It is not covered by the
MIT License and belongs to its rights holders; it will be removed on request.
