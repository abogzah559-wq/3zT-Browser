<p align="center">
  <img src="assets/logo.png" width="132" alt="3zT logo">
</p>

<h1 align="center">3zT Browser</h1>

<p align="center">
  A lightweight Chromium-based desktop browser for Windows with a built-in ad blocker, download manager,
  video downloader and reader view, and the YouTube and Twitch tools most people install as extensions.
</p>

<p align="center">
  <a href="https://github.com/abogzah559-wq/3zT-Browser/releases/latest"><b>Download for Windows</b></a>
  &nbsp;·&nbsp; Windows 10 / 11, 64-bit &nbsp;·&nbsp; Arabic and English interface &nbsp;·&nbsp; MIT License
</p>

---

## Contents

- [Overview](#overview)
- [Installation](#installation)
- [Features](#features)
- [Architecture](#architecture)
- [Performance](#performance)
- [Privacy](#privacy)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [User data](#user-data)
- [Building from source](#building-from-source)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [FAQ](#faq)
- [Contributing](#contributing)
- [Credits and licenses](#credits-and-licenses)

## Overview

A typical Chrome setup ends up with half a dozen extensions: an ad blocker, SponsorBlock, a YouTube
cleaner, a Twitch ad blocker, a download manager and a video downloader. Each extension adds its own
process and background page.

3zT implements those features inside the browser instead:

- **No extension processes for common tasks.** Ad blocking, SponsorBlock, YouTube cleanup, ambient
  light, Twitch ad blocking, cookie-popup handling and the downloaders are part of the browser.
- **No background services.** No account, sync, telemetry, component updater or Chromium background
  networking (`--disable-background-networking`); no media-router or optimization-hints services.
- **Load on demand.** Features such as the reader view and the video downloader load their code only
  when they are used, and the downloader's tools run only while a job is active.
- **Sleeping tabs.** Tabs left unused for a configurable time (5–60 minutes) release their memory and
  reload when selected.

Two performance modes are available in Settings:

| Mode | Behaviour |
|---|---|
| **Normal** (default) | Lowest memory use: sleeping tabs, and background tabs are throttled as in Chrome. |
| **Very fast** | Background tabs keep full speed, GPU rasterization is forced on, more raster threads and zero-copy uploads. Uses somewhat more memory and power. |

## Installation

1. Download `3zT-Browser-Setup.exe` from the [latest release](https://github.com/abogzah559-wq/3zT-Browser/releases/latest).
2. Run it. The installer needs no administrator rights and installs for the current user
   (`%LOCALAPPDATA%\Programs\3zT`).

The installer is not code-signed yet, so Windows SmartScreen may show a warning the first time;
choose **More info → Run anyway**.

**Default browser:** *Settings → Default browser → Make default*, then select 3zT in the Windows
dialog (Windows requires the user to confirm this choice).

**Updates** are automatic. The browser checks this repository's releases in the background, downloads a
newer installer and verifies both its SHA-256 digest and an Ed25519 signature produced by the release
workflow (the private key exists only in the repository's secrets; the public key is built into the
browser). The update is installed silently when the browser is closed, and a short note with the release
notes appears on the next start. *Settings → About → Check for updates* checks immediately.

**Uninstall** from *Windows Settings → Apps*. The profile in `%APPDATA%\3zT Browser` is kept unless you
delete it.

## Features

### Browsing

- Chromium engine (via Electron), so pages render and behave as in Chrome.
- Dark interface with no white flash while pages load. Optional *Dark mode for every site* uses a
  site's own dark theme when it has one and Chromium's automatic dark mode otherwise.
- Tabs above a floating toolbar that takes the colour of the current site. Pinned tabs, drag a tab out
  into a new window or onto another window, and edge snapping while dragging.
- **Tab hover cards:** hovering a tab shows a small preview image of its page (no text overlay).
- **Tab search** (`Ctrl+Shift+A` or the arrow next to the tabs): searches the open tabs of every window,
  labelled by window, and recently closed tabs. Selecting a result switches to the tab without
  reloading it. Incognito tabs are only listed from their own incognito window.
- **Reader view:** a book button appears in the address bar on article pages. It shows the article
  alone, with its images and captions in their original order, in a layout tuned for long Arabic and
  English text (per-paragraph text direction, adjustable size and width, reading progress, estimated
  reading time).
- **Picture in picture** (`Alt+P` or the video's context menu, on any site including embedded players):
  the video plays in 3zT's own always-on-top window with rounded corners and a thin frame, instead of
  Chromium's built-in one. It can be moved and resized from its edges, and it reopens at the last position
  and size regardless of the video's aspect ratio. Controls appear on hover: back to the tab, close,
  play/pause and a seek bar; on YouTube and YouTube Music also previous/next track. The tab stays in the
  strip and shows a "bring it back" note in its place.
- Address bar with history, previous searches and Google suggestions; preconnects to likely targets.
- In-page translation (Google Translate), find in page, per-site zoom, printing, full screen,
  developer tools, private windows.
- Links, forms and scripts that open new tabs keep the original request (POST data, Referer,
  `window.opener`), which download sites depend on.
- External protocols (`mailto:`, `discord://`, …) open through Windows after confirmation.
- Subtle interface animations (about 150 ms, opacity and movement only), disabled when Windows
  requests reduced motion.

### Ad blocking and privacy protection

- Network-level blocker using the public **EasyList** and **EasyPrivacy** lists, refreshed in the
  background. It can be turned off per site from the shield button, which also shows a counter.
- YouTube and Twitch video ads are blocked. Sponsored posts in the TikTok and Instagram feeds are removed
  from the feed data before the page renders it, so no empty slots are left (follows the ad blocker and
  its per-site switch).
- **Cookie popups:** consent dialogs are answered with "reject" / "necessary only" by DuckDuckGo's
  Autoconsent rules, the same way a person would click them, so pages are not left locked behind a
  hidden overlay. The rules are loaded only on pages that show signs of a consent manager. Sites excluded
  from the ad blocker are left untouched.
- **Passkeys are off by default** (*Settings → Ads & privacy*). Sites cannot open the Windows Security
  ("insert your security key") dialog on their own, including through embedded frames or blank frames
  created by the page. A security key used as a second sign-in step still works after a click. When
  enabled, only requests the user did not initiate are refused.

### YouTube and Twitch

- **SponsorBlock**: skips sponsor segments, self-promotion and similar categories.
- **Clean YouTube**: hide Shorts, comments, recommendations, notifications, likes, views and more.
- **Ambient light**: the glow around the video that follows the picture.
- **Highest quality automatically**: every video starts at the best available quality instead of
  *Auto*; a quality selected manually is kept for that video.

### TikTok and Instagram

- **Highest quality playback** (on by default, *Settings → General*): both sites send several qualities of
  each video and let their player pick, usually a low one in a desktop window. The video data is adjusted
  before the player reads it so only the highest quality this computer can decode is offered (TikTok's
  stream list, Instagram's DASH manifest and file list). HEVC streams are only chosen when the system can
  decode them.
- **Dislike count** from the Return YouTube Dislike project.
- Twitch ad blocking.

### Download manager

- Native "Save as" dialog starting in the last folder used (optional), parallel connections, pause,
  resume (also across restarts), cancel and retry.
- Toolbar list for the current session and a downloads page (`3zt://downloads`, `Ctrl+J`) with history
  and search.
- Drag a finished file onto a website, the desktop or a folder.
- Non-Latin file names are preserved (`Content-Disposition`, `filename*=UTF-8''…`, `<a download>`).
- Tabs opened only to start a download close automatically. Incognito downloads are not listed in normal
  windows.

### Video, audio and photo downloader

A fox button appears in the address bar on pages with a video or a post (YouTube, TikTok, Instagram,
X, Facebook, Reddit, Vimeo, SoundCloud and other sites supported by yt-dlp, or any page playing a real
video). It opens the downloader window with the link filled in.

- A preview with title, channel, duration and site appears before anything is downloaded.
- Save **video** (best or a chosen resolution, MP4), **audio** (MP3) or the **photos** of a post, with a
  picker for which photos to keep.
- **Download only a part:** drag the two handles on the timeline under the preview; the preview plays
  only the selected range. Two cut modes:
  - *Fast cut*: no re-encoding; the cut starts at the nearest key frame, possibly a few seconds early.
  - *Exact cut*: the edges are re-encoded so the cut is frame-accurate.
- Every result is checked before it is reported as done (with FFmpeg): it must contain a video stream
  for video downloads, and a cut must match the selected range. If a site cannot deliver a range, the
  whole video is downloaded and cut locally. Cut files are named after the range, for example
  `Title [id] (1m57s-2m33s).mp4`.
- Videos that are only available in **HEVC** (common on TikTok, and not playable in Windows without a
  paid extension) are converted to H.264 so they play everywhere. YouTube's high-resolution VP9/AV1
  formats are kept as they are.
- On TikTok's *For You* feed, where the address does not change while scrolling, the button takes the
  video currently on screen.
- Content that requires signing in works with the site's own cookies, passed to the tools in a
  temporary file readable only by the current user and deleted after use.
- The preview volume starts at 25 % and remembers the last level.
- Closing the window stops every process it started, deletes its temporary files and clears its list.

The tools — [yt-dlp](https://github.com/yt-dlp/yt-dlp), [gallery-dl](https://github.com/mikf/gallery-dl)
and [FFmpeg](https://ffmpeg.org) — are bundled with the installer, verified against the SHA-256 sums
their releases publish, and run as separate processes only while a job is active. *Update download
tools* in the window updates yt-dlp and gallery-dl when a site changes.

### Passwords, permissions and settings

- Saved passwords are encrypted with Windows DPAPI (Electron `safeStorage`). Sites are matched with the
  Public Suffix List. Import from a Chrome CSV export.
- Sensitive permissions (camera, microphone, location, notifications, clipboard read, MIDI, USB / HID /
  serial, screen sharing) are requested through a small non-blocking bar and remembered per site.
- A single settings page (`3zt://settings`) with an Arabic (right-to-left) or English interface.
- Task manager (`Shift+Esc`) with memory and CPU per tab.

### Extensions

Manifest V3 extensions can be installed from the Chrome Web Store (**Add to 3zT**), copied from an
existing Chrome profile on first start, or loaded from a folder. Electron implements a subset of the
Chrome extension APIs; 3zT adds compatibility shims for common gaps (`storage.sync`, `commands`,
`windows`, `contextMenus`, `fontSettings`, badge text). Extensions that require `nativeMessaging` or
`offscreen` documents are not supported.

## Architecture

3zT is an Electron application without npm dependencies; third-party code is vendored or fetched at
build time with integrity checks.

```
src/
  main.js              main process: windows, tabs, toolbar state, settings, permissions, IPC,
                       reader view, tab previews and search, cookie-popup wiring
  pip.js               picture in picture: the tab's page moves into a small framed window showing only
                       the video (ui/pip.html draws the frame and controls, preload-pip.js its bridge)
  preload-newtab.js    preload for every tab: the internal pages' API, and in websites the isolated-world
                       features (YouTube, TikTok/Instagram quality, passkey policy, reader detection,
                       cookie-popup handling)
  preload-ui.js        allow-listed bridge for the toolbar
  features.js          SponsorBlock, Return YouTube Dislike, Clean YouTube, Ambient light, Twitch
  adblock.js           EasyList / EasyPrivacy host matcher with resource types
  downloads.js         download manager
  media/engine.js      video / audio / photo downloader: yt-dlp, gallery-dl and FFmpeg orchestration
  media/detect.js      which pages show the downloader button
  updater.js           signed silent updates
  permissions.js       site permissions
  passwords.js         encrypted password store
  ui/                  toolbar and tab strip
  newtab/              internal pages (new tab, settings, history, downloads, passwords, task manager,
                       downloader window, reader view)
  inject/              third-party scripts injected into YouTube / Twitch
  vendor/              Readability, tldts, Chrome Web Store support; Autoconsent (added at build time)
scripts/               build_win.py, fetch_tools.mjs, fetch_autoconsent.mjs, sign-update.mjs
tests/                 e2e.mjs, update-test.mjs, media-real.mjs, bench.ps1, speed.mjs, resources.mjs
installer/             Inno Setup script, wizard images, in-app release notes (Arabic)
```

**Process model.** Chromium's standard model: one browser process, one GPU process, one network service
and one renderer per site, plus a crashpad handler. This is what Windows Task Manager shows under 3zT.
Built-in features run in the browser process or inside the pages' own renderers, so they do not add
processes the way extensions do. The separation is what keeps a crashed or hung page from taking down
the browser and isolates sites from each other.

**Page features** run in the preload's isolated world, not in the page's JavaScript context. Where a
feature has to use the page's own objects (YouTube's player API, a consent manager's API, the
passkey policy), a minimal script is injected into the page and the replaced functions present their
original source to `Function.prototype.toString`.

**Reader view.** On page load the preload runs Mozilla's `isProbablyReaderable` heuristic. When the
button is pressed, the article is extracted from a clone of the document with Mozilla Readability and
handed to the browser process, which opens `reader.html` in the same tab. The reader page parses the
HTML with `DOMParser` (nothing executes) and rebuilds it from an allow-list of elements and attributes;
only `http(s)` links and images are kept. A strict Content-Security-Policy blocks scripts, frames, forms
and network access other than images.

**Downloader.** Each job tries, in order: the metadata already fetched for the preview
(`--load-info-json`) with only the selected range (`--download-sections`); a fresh extraction with the
range; the whole file followed by a local cut. Each result is probed with FFmpeg before the next step is
chosen. Site-specific preview headers (for example TikTok's Referer and cookies) are served to the
preview player through a session-scoped `ztpv://` protocol with random, window-bound tokens. There is no
local HTTP server and no listening port.

**Updates.** The release workflow signs `setup filename + version + SHA-256` with Ed25519. The browser
downloads the installer, checks the digest and signature, and installs it on exit.

## Performance

Measured automatically for every release on GitHub-hosted Windows runners (no GPU), each browser with a
fresh profile. See each release's notes for its own figures.

**Memory** ([`tests/bench.ps1`](tests/bench.ps1)) — three sites in three tabs (Wikipedia, GitHub,
Stack Overflow), total private memory of all processes averaged 30 and 60 s after the last tab opened,
two rounds in opposite order:

| Run | 3zT | Brave | Google Chrome |
|---|---|---|---|
| 0.8.0, run 1 | **399 MB** (7 processes) | 440 MB (12) | 738 MB (34) |
| 0.8.0, run 2 | **396 MB** (7) | 436 MB (12) | 908 MB (35) |
| 0.9.0 | 407 MB (7) | **392 MB** (10) | 870 MB (34) |
| 0.13.0 | **390 MB** (7) | 454 MB (10) | 906 MB (34) |
| 0.14.0 | 388 MB (7) | 450 MB (10) | **360 MB** (10) |

Results vary between runs; Chrome's process count in particular differs from run to run. In most runs
3zT used roughly half of Chrome's memory and slightly less than Brave. Without extensions installed in
the other browsers, these figures understate the difference for users who rely on the extensions listed
above.

**Page load** ([`tests/speed.mjs`](tests/speed.mjs)) — six sites, empty and warm cache, medians of two
passes. All three browsers share the Chromium engine and load pages in about the same time; the ranking
changes with the runner's network. 3zT's advantage is lower memory use and not downloading ads and
trackers.

**Everyday resource use** ([`tests/resources.mjs`](tests/resources.mjs)) — memory and CPU with 1, 5 and
10 sites, a playing video, a second window, a download, and after opening and closing 40 tabs.

## Privacy

- No account, sync, telemetry or crash reporting.
- Network connections made by 3zT itself, apart from the sites you visit:
  - Google, for search suggestions and translation when used;
  - `easylist.to`, for the filter lists;
  - `sponsor.ajay.app`, on YouTube with SponsorBlock enabled (a 4-character hash prefix of the video ID);
  - `returnyoutubedislikeapi.com`, on YouTube with the dislike count enabled (the video ID);
  - Google's extension servers, when installing or updating a Chrome Web Store extension;
  - `api.github.com`, every few hours, to check for updates (installed copies only);
  - for the video downloader, the site being downloaded from, and GitHub / Codeberg when the tools are
    updated manually.
- Cookie-popup rules and the reader view run locally; nothing is sent anywhere.
- Private windows keep no history, cookies or downloads list after they close.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl+T` / `Ctrl+W` | New tab / close tab |
| `Ctrl+Shift+T` | Reopen closed tab |
| `Ctrl+Shift+A` | Search tabs |
| `Ctrl+N` / `Ctrl+Shift+N` | New window / new private window |
| `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+PgDn`, `Ctrl+PgUp`, `Ctrl+1…8`, `Ctrl+9` | Switch tabs |
| `Ctrl+Shift+PgDn` / `Ctrl+Shift+PgUp` | Move tab right / left |
| `Ctrl+Shift+W` | Close window |
| `Ctrl+L`, `F6`, `Alt+D` | Address bar |
| `Ctrl+F`, `F3` / `Shift+F3` | Find in page, next / previous |
| `Ctrl+R` / `F5` (`Ctrl+Shift+R` bypasses cache) | Reload |
| `Alt+←` / `Alt+→` | Back / forward |
| `Alt+P` | Picture in picture |
| `Ctrl+H` / `Ctrl+J` | History / downloads |
| `Ctrl+D` | Bookmark page |
| `Ctrl+P` | Print |
| `Ctrl` `+` / `-` / `0` | Zoom in / out / reset |
| `F11` | Full screen |
| `F12` / `Ctrl+Shift+I` / `Ctrl+Shift+J` | Developer tools |
| `Alt+Home` | New tab page in the current tab |
| `Ctrl+Shift+Delete` | Clear browsing data |
| `Ctrl+U` | View page source |
| `Shift+Esc` | Task manager |
| `Esc` (reader view) | Back to the page |

## User data

Everything is stored locally in `%APPDATA%\3zT Browser`:

| Path | Contents |
|---|---|
| `settings.json` | Settings |
| `bookmarks.json`, `history.json`, `favicons.json` | Bookmarks, history, site icons |
| `session.json` | Open windows and tabs |
| `downloads.json` | Downloads list |
| `passwords.json` | Saved passwords (encrypted) |
| `extensions\`, `webstore\` | Installed extensions |
| `adblock\` | Downloaded filter lists and a parsed cache |
| `media\tools\` | The downloader's self-updating copies of yt-dlp and gallery-dl |
| `logs\3zt.log` | Error log (capped at 1 MB), useful for bug reports |
| other files | Chromium's cookies, cache and site storage |

Tab preview images are kept in memory only and are never written to disk.

## Building from source

Requirements: Node.js 20+ (development), Python 3 with Pillow (Windows app folder), Inno Setup 6.6+
(installer, Windows only).

Run from source:

```
npm install electron@45.1.0 --no-save
npx electron .
```

Build the Windows app and installer:

```
curl -LO https://github.com/electron/electron/releases/download/v45.1.0/electron-v45.1.0-win32-x64.zip
node scripts/fetch_tools.mjs tools-cache          # yt-dlp, gallery-dl, FFmpeg (checksums verified)
node scripts/fetch_autoconsent.mjs                # cookie-popup rules (pinned, sha512 verified)
python -m pip install pillow
python scripts/build_win.py electron-v45.1.0-win32-x64.zip
ISCC installer\3zT.iss /DAppVersion=<version in package.json>
```

Without `fetch_tools.mjs` the downloader fetches its tools on first use; without `fetch_autoconsent.mjs`
the cookie-popup setting is simply unavailable. The GitHub Actions workflow
([`.github/workflows/build.yml`](.github/workflows/build.yml)) runs all of the above, tests the result and
publishes a release when the version in `package.json` changes.

## Testing

[`tests/e2e.mjs`](tests/e2e.mjs) drives the installed browser through the Chrome DevTools Protocol. On
every push the Windows workflow:

1. builds the app and installer, installs silently and checks shortcuts and browser registration;
2. opens the toolbar and every internal page and checks for script errors;
3. tests site permissions (prompt bar, allow / block / ignore, persistence, site panel, screen picker);
4. installs Dark Reader and uBlock Origin Lite from the live Chrome Web Store, verifies them across a
   restart and removes them;
5. tests downloads started the way real sites start them (form POST in a new tab, `window.open`,
   signed redirects, `blob:` files, parallel downloads, interrupted connections with byte comparison,
   cancellation, non-Latin names, forged names);
6. tests the video downloader: bundled tools, range downloads (frame-exact length checked with
   ffprobe), a server without range support, HEVC to H.264 conversion, the window layout, the address-bar
   button, and process cleanup when the window closes;
7. tests the passkey policy, including blank frames and the `toString` check;
8. tests the reader view (content, images, captions, sanitizing), picture in picture (window, controls,
   restoring the page, remembered position and size), tab hover cards,
   tab search across windows and the cookie-popup handling;
9. tests silent updating end to end with a locally signed fake release;
10. uninstalls and verifies removal, then runs the memory, speed and resource benchmarks.

[`tests/media-real.mjs`](tests/media-real.mjs) runs the downloader engine against real YouTube and
TikTok videos (manually or on `diag/**` branches). [`tests/sites-real.mjs`](tests/sites-real.mjs) runs
the browser itself there: TikTok's playback resolution with and without the quality setting, and picture in
picture on a real YouTube page. YouTube frequently refuses GitHub's datacenter addresses, so those results
are informational.

## Known limitations

- Windows only; the code runs on Linux and macOS but no installers are produced.
- DRM-protected streaming (Netflix, Disney+, Shahid, Spotify Web) does not play: Electron does not include
  Google's Widevine CDM.
- Google sign-in occasionally rejects Electron-based browsers ("Couldn't sign you in"). 3zT presents a
  Firefox user agent on Google's sign-in pages only, which Google normally accepts; retrying usually works.
- The ad blocker applies host rules (with resource types) from EasyList / EasyPrivacy; path and cosmetic
  rules are not applied.
- Cookie-popup handling covers the consent managers supported by Autoconsent and runs in the top frame;
  dialogs rendered in third-party iframes may remain.
- Passkey autofill in sign-in fields is not available.
- Sites change frequently; *Update download tools* usually fixes a downloader site that stopped working.
- The installer is not code-signed.

## FAQ

**Why does Task Manager show several 3zT processes?**
That is Chromium's multi-process design (browser, GPU, network service, one renderer per site, crash
handler), the same as in Chrome, Edge and Brave. It keeps sites isolated and a crashing page from
affecting the rest. The built-in features do not add processes of their own.

**Why does the Windows Security dialog still appear when I sign in?**
With passkeys off (the default) a site cannot open it on its own. It still appears for a security key
used as a second step after you choose it, or if you enabled passkeys and chose one.

**A download site sends me to another page and back.**
3zT preserves the site's request when it opens a new tab (since 0.13.0). If it still fails, the file may be
behind a captcha or timer on the site; please open an issue with the address.

## Contributing

Bug reports and suggestions are welcome as [issues](https://github.com/abogzah559-wq/3zT-Browser/issues).
Please include the version (*Settings → About*), the steps, and if possible `%APPDATA%\3zT Browser\logs\3zt.log`.
Pull requests should keep the browser light: no new background services, and features loaded only when
used. See [CHANGELOG.md](CHANGELOG.md) for the history of changes.

## Credits and licenses

3zT's own code is released under the [MIT License](LICENSE). Third-party components keep their licenses;
full texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

| Component | Author | License | Use |
|---|---|---|---|
| [Electron](https://github.com/electron/electron), [Chromium](https://www.chromium.org) | Electron / Chromium authors | MIT / BSD-style | Runtime |
| [Ambient light for YouTube](https://github.com/WesselKroos/youtube-ambilight) 2.38.17 | Wessel Kroos | MIT | Bundled (`src/inject/ambient/`) |
| [TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions) `vaft` | pixeltris | MIT | Bundled |
| [Mozilla Readability](https://github.com/mozilla/readability) 0.6.0 | Mozilla | Apache-2.0 | Bundled, reader view |
| [Autoconsent](https://github.com/duckduckgo/autoconsent) 18.2.0 | DuckDuckGo | MPL-2.0 | Fetched at build time, cookie popups |
| [electron-chrome-web-store](https://github.com/samuelmaddock/electron-browser-shell), adm-zip, pbf | Samuel Maddock and others | MIT / BSD-3-Clause | Bundled |
| [tldts](https://github.com/remusao/tldts) with the [Public Suffix List](https://publicsuffix.org) | Rémi Berson / Mozilla | MIT / MPL-2.0 | Bundled |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp), [gallery-dl](https://github.com/mikf/gallery-dl), [FFmpeg](https://ffmpeg.org) | their authors | Unlicense / GPL-2.0 / GPL | Shipped unmodified, run as separate programs |
| [SponsorBlock](https://sponsor.ajay.app) data | SponsorBlock community | CC BY-NC-SA 4.0 | Public API |
| [Return YouTube Dislike](https://returnyoutubedislike.com) | RYD project | — | Public API |
| [EasyList / EasyPrivacy](https://easylist.to) | EasyList authors | GPL-3.0 / CC BY-SA 3.0 | Downloaded at runtime |
| Clean YouTube (Chrome Web Store) | its developer | — | Element list adapted |
| [Thmanyah](https://thmanyah.com) font | Thmanyah | Free to use | Not redistributed; used when installed |

YouTube is a trademark of Google LLC and Twitch is a trademark of Twitch Interactive, Inc. 3zT is not
affiliated with them or with the projects above. The new tab page's background video is a short anime clip
that belongs to its rights holders and will be removed on request.
