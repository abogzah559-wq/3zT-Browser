# Changelog

All notable changes to 3zT, newest first. Release notes are generated from this file.

## 0.16.1

### Browsing
- Page and frame loads now carry the browser's User-Agent Client Hints (`Sec-CH-UA`, `Sec-CH-UA-Mobile`,
  `Sec-CH-UA-Platform`). Electron sends them only with subresources, so to a server every page load came from a
  "Chrome" without hints, which bot checks treat as automated traffic. Fixed as a result: Cloudflare's "verify you
  are human" box appearing on sites that pass silently in Chrome, and video sites refusing their player ("the
  session has expired") or sending their ad tab to google.com. The values are the engine's own, copied from its
  first request that has them; nothing is spoofed.

### Downloader
- Fast (no re-encode) ranges no longer keep hidden seconds before their start. They began at the key frame before
  the chosen start, with an MP4 edit list telling players to skip the extra part; Windows Media Player ignores it, so
  clips appeared to start in the middle with picture and sound out of step. Such a range is now re-encoded from its
  exact start and checked with ffprobe.

## 0.16.0

### Browsing
- Picture in picture now uses a dedicated window instead of Chromium's built-in one: rounded corners, a thin
  frame, always on top, movable and resizable from its edges. Its position and size are stored and reused for
  every video, so the window no longer jumps or resizes between tracks.
- Picture-in-picture controls: back to tab, close, play/pause and a seek bar. The 10-second skip buttons are
  gone; on YouTube and YouTube Music previous/next track buttons are shown, always laid out left to right
  (they were mirrored in the Arabic interface).
- The picture-in-picture button over videos was removed. `Alt+P` and the video's context menu remain; `Alt+P`
  also closes the window from the browser or from the window itself.
- While a tab is in picture in picture, its place in the browser window shows a note with a button to bring
  the video back. Closing, moving or detaching the tab returns the video first; leaving the page closes the
  window.
- TikTok and Instagram play at the highest quality the site provides and the computer can decode (new
  setting, on by default).
- Sponsored posts are removed from the TikTok and Instagram feeds when the ad blocker is on (and not
  turned off for that site).
- Tab hover cards show only the page preview image; the title/address tooltip on tabs was removed.

### Downloader
- Fixed: on YouTube the selected range was ignored and the whole video was downloaded when the link contained
  extra parameters (`&list=`, `&pp=`, `&t=` …). The preview stored the site's normalised address, so the
  download no longer matched the preview and was started without the range.

## 0.15.1

### Downloader
- Range downloads are verified: a result that is not the selected range is cut locally instead of being saved as the whole video, and a site that cannot deliver a range falls back to a full download followed by a local cut.
- Videos available only in HEVC (common on TikTok) are converted to H.264 so they play in Windows' built-in players; previously Windows played the sound with no picture.
- Every download is checked with FFmpeg before it is reported as done; a "video" without a picture is retried another way instead of being saved.
- Preview metadata reuse now keeps the site's cookies (in a temporary, user-only file), which TikTok requires.
- The time fields were removed; the range is set with the timeline handles only, and the preview follows the handle being dragged.
- The preview has a volume control that starts at 25 % and remembers the last level.
- The window fits its height without scrolling; cut modes are compact buttons with tooltips and the job list shows the three latest jobs.
- Previews of sites that require their own headers (TikTok) now play inside the window.
- Cut files are named after the range, for example `Title [id] (1m57s-2m33s).mp4`.

### Browsing
- Reader view: a book button in the address bar on article pages shows the article alone, with images and captions, in a layout tuned for long Arabic and English text.
- Picture in picture: a button over videos on hover, `Alt+P`, or the video's context menu.
- Tab hover cards with a preview image, and tab search across all windows (`Ctrl+Shift+A`).
- Cookie consent popups are answered with "reject" using DuckDuckGo's Autoconsent rules (setting in Ads & privacy).
- YouTube: videos start at the highest available quality, and the dislike count is shown (Return YouTube Dislike). Both can be turned off.
- Short interface animations (tabs, menus, internal pages), disabled when Windows requests reduced motion.
- Fixed: the downloader and reader buttons could remain visible in the address bar on pages where they do not apply.

## 0.15.0

- Downloader: pick the part you want right away. A timeline appears with the video's preview, before anything downloads; only that part is downloaded (fast, or frame-exact). The preview player plays just your part. A site that can't send a part gets the whole video, cut on your computer.
- Downloads start right away: the details read for the preview are reused instead of reading the site again, and one bar shows the whole job.
- A new look for the downloader: big preview with length and site, the timeline, mode buttons with icons, a clear "Download 1080p · 0:23" button, cards with thumbnails, plain-language errors (the technical text is under "Details").
- TikTok For You: pressing the fox button while scrolling the feed now downloads the video on screen (the feed's address never changes, so 3zT builds the video's own link).
- Closing the downloader window stops everything it started, deletes its temporary files and clears its list (it asks first if something is still downloading). It opens empty next time.
- New setting: Settings → Ads & privacy → "Sign in with passkeys", off by default. While it is off, no site can open the Windows Security "insert your security key" window by itself; you continue with your password (a security key as your account's second step still works after you click).
- The passkey fix and Google's sign-in disguise now also reach the blank frames and windows a sign-in page makes, which is how the security-key window still appeared about one time in three. Fewer "Couldn't sign you in" pages from Google (it can still happen now and then: Try again).

## 0.14.0

- The video downloader has its own small window, separate from the browser's downloads. Before downloading it shows the video's picture, title, channel, length and link so you can confirm, and only offers the qualities the video really has.
- Its tools (yt-dlp, gallery-dl, FFmpeg) now come with the setup: no waiting the first time. They only run while something is downloading.
- Settings → About → Check for updates: looks for an update right away and downloads it; "Restart to update" installs it in seconds and brings your tabs back.
- A tidier bar: the fox button is smaller, and the ad-blocker shield sits next to the extensions button.
- The download button: a thin light-blue ring while downloading; when it is done the arrow turns blue until you open the list.
- Trimming: playing the video in the trim window plays only the part you picked.
- The new tab and the browser's own pages show the fox without the dark circle.
- The address bar no longer keeps the previous tab's address when you open or switch to another tab.
- Sign-in pages (Google...) no longer open the Windows Security "insert your security key" window by themselves: background passkey requests are answered "no passkey", also from embedded sign-in boxes. A passkey you choose yourself still works.

## 0.13.0

- New logo: the fox, everywhere (program, taskbar, setup, tabs). This update installs the full setup once so the program's own icon changes too.
- Video, audio and photo downloader built in (the former 3zT Download app): a fox button in the address bar on pages with a video or a post opens the downloads page with the link. Save the video (up to 4K), MP3 audio, or pick the photos of a post. The tools it needs are fetched and checked the first time you use it; nothing runs in the background.
- Trim a video before saving it, or trim any finished video in the downloads list: pick the start and end on a timeline with a preview. "Fast" keeps the quality (cuts at the nearest key frame), "Frame-exact" re-encodes to cut exactly.
- Drag a finished download from the list onto a website, the desktop or a folder.
- Downloads that failed on many sites now work: tabs opened by a site carry its exact request (form data, the page it came from, the opener), like Chrome. The empty tab that only started a download closes by itself.
- Arabic file names are kept (they used to be saved as "download").
- Sign-in pages no longer pop up the Windows Security window by themselves; a passkey you choose still works.
- Pin tabs (right-click a tab). More Chrome shortcuts: Ctrl+PgUp/PgDn, Ctrl+Shift+PgUp/PgDn, Ctrl+Shift+W, F3, Alt+Home. Save link, copy image address, save video in the right-click menu.
- Faster start (the ad lists are kept ready), the ad blocker follows each rule's resource types, private-window downloads are not kept in the list, errors are written to a small log file.

## 0.12.8

- Translate page now works in place, like Chrome: the page stays where it is and keeps working, its text is swapped for the translation, new text is translated as it appears, and other pages of the same site are translated too until you press the button again. No more trip through Google Translate's site.
- Ctrl+Shift+T after closing and reopening the browser: closed tabs are kept across restarts, and if tabs are not restored on start, the first Ctrl+Shift+T brings back all the tabs that were open.
- The browser's own pages show as 3zt://settings, 3zt://downloads... instead of zeus:// (the old addresses still work).
- Past searches under the address bar all line up on the right in the Arabic interface, English ones too.

## 0.12.7

- YouTube's suggested videos on the right of a video show again. One of the signals added in 0.12.5 against the "ad blockers are not allowed" popup stopped YouTube from drawing that list; it is removed, the rest stays (no popup, no ads).

## 0.12.6

- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab...) work again while the keyboard is on the Arabic layout: 3zT now reads which key is pressed, not the letter it types, like Chrome.

## 0.12.5

- YouTube's "Ad blockers are not allowed" popup no longer shows up: 3zT tells YouTube what uBlock Origin tells it, its changes look built in, and if the popup still opens it is closed and the video keeps playing.
- Much faster updates: when only 3zT's own code changed, the update is a few MB and is swapped in within a second when you close the browser, instead of reinstalling all of Chromium. The full setup is still used when Chromium itself changes.

## 0.12.4

- New switch in Settings → General: "Thmanyah font on every site". It puts the Thmanyah font on the text of websites (YouTube, Google, X...), while icons and code keep their own font. Off by default; needs the Thmanyah font installed on Windows.

## 0.12.3

- The search box and the AI button on the new tab (also when it is set to Gemini) now use the Thmanyah font too.

## 0.12.2

- The browser's own pages (top bar, new tab, settings, history, downloads, passwords, tasks) now use the Thmanyah font. It is also a new choice for the clock and date on the new tab. Install the free Thmanyah font from thmanyah.com to see it; without it, the previous font is used.

## 0.12.1

- Past searches in the address bar no longer include your Google AI Mode chats, and a search counts once even when Google opens it a few times, so the list really shows what you search most, then the latest.

## 0.12.0

- Sites that are already dark (like YouTube) now keep their own colours: white controls such as YouTube's volume bar stay white instead of turning black. Light sites are still darkened, and a site switching between light and dark is followed.
- Your past searches show only when you click the empty address bar (not by themselves on a new tab), with the ones you search most often first, then the latest.

## 0.11.0

- No more white: pages no longer flash white while loading, and every site is dark. Sites with a dark design use it; the rest are darkened automatically (photos and video stay as they are). Can be turned off in Settings → General.
- Address bar: Arabic is written right to left, and your past searches show up (all of them when the bar is empty, matching ones while you type). Arabic Google suggestions work again.
- Faster: a ready page process makes opening sites quicker, the browser connects to a link's site while your mouse is on it (before you click), and extensions load at the same time at start.

## 0.10.0

- Site permissions: a small bar under the address bar asks when a site wants your camera, microphone, location, notifications and more. It never blocks the browser and closes by itself after a few seconds (the site is refused that time). Allow and Block are remembered per site.
- The shield panel now shows this site's permissions and lets you change them; Settings lists every site.
- Screen sharing works (Meet, Discord and others): pick a screen or a window. USB, HID and serial devices can be picked too.
- Camera and microphone are asked separately, and sites can no longer read your screen layout without asking.
- Passwords are matched with the official list of web addresses, so different sites on shared hosts (like github.io) never see each other's passwords, and passwords are only ever saved encrypted.
- Updates are now signed: the browser only installs an update carrying the project's signature.
- Lighter: the address bar no longer runs a hidden animation all the time (it used a little CPU even when idle), and the ad counter no longer writes to disk on every blocked ad.

## 0.9.0

- Silent updates: 3zT downloads new versions in the background and installs them when you close it. Next time you open it, a short green note says it was updated, with a Details button.
- Download list: press the download button in the bar to see this session's downloads. Click a file to open it, or the folder button to show it in File Explorer. You can pause, resume, cancel and retry from the list.
- Ctrl+J opens the downloads page.

## 0.8.0

- Chrome Web Store: press "Add to 3zT" on any extension to install it; extensions update by themselves.
- New dark installer with a desktop shortcut option; the app is now called 3zT.
- New logo (the monkey only) and a new background video.
