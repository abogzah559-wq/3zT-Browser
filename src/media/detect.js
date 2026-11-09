'use strict';
/*
 * Is there something on this page the built-in downloader can save?
 *  - pages of sites yt-dlp / gallery-dl know well (a video, a post, a clip), by their address
 *  - any other page: only when the page itself reports a real video on it (preload, see 'media:seen')
 * Home pages, search pages and settings of those sites do not count.
 */
const RULES = [
  [/(^|\.)youtube\.com$/, /^\/(watch|shorts\/|live\/|clip\/)/],
  [/^youtu\.be$/, /^\/[\w-]{6,}/],
  [/(^|\.)tiktok\.com$/, /^\/@[^/]+\/(video|photo)\/\d+|^\/t\/\w+|^\/v\/\d+/],
  [/^vm\.tiktok\.com$|^vt\.tiktok\.com$/, /^\/\w+/],
  [/(^|\.)instagram\.com$/, /^\/(p|reel|reels|tv|stories)\/[^/]+/],
  [/(^|\.)(x|twitter)\.com$/, /^\/[^/]+\/status\/\d+/],
  [/(^|\.)facebook\.com$/, /\/videos\/|^\/watch\/?|^\/reel\/|^\/share\/(v|r)\//],
  [/^fb\.watch$/, /^\/\w+/],
  [/(^|\.)twitch\.tv$/, /^\/videos\/\d+|\/clip\/|^\/[^/]+\/v\/\d+/],
  [/^clips\.twitch\.tv$/, /^\/[\w-]+/],
  [/(^|\.)reddit\.com$/, /\/comments\/\w+/],
  [/(^|\.)vimeo\.com$/, /^\/\d+/],
  [/(^|\.)dailymotion\.com$/, /^\/video\//],
  [/(^|\.)soundcloud\.com$/, /^\/[^/]+\/[^/]+/],
  [/(^|\.)pinterest\.[a-z.]+$/, /^\/pin\/\d+/],
  [/(^|\.)snapchat\.com$/, /^\/(spotlight|t)\/|\/story\//],
  [/(^|\.)threads\.(net|com)$/, /^\/@[^/]+\/post\//],
  [/(^|\.)kick\.com$/, /\/videos\/|\/clips\/|\?clip=/],
  [/(^|\.)bilibili\.com$/, /^\/video\//],
  [/(^|\.)streamable\.com$/, /^\/\w+/],
  [/(^|\.)bsky\.app$/, /\/post\//],
  [/(^|\.)tumblr\.com$/, /\/post\/\d+/],
  [/(^|\.)linkedin\.com$/, /^\/posts\/|\/feed\/update\//],
  [/(^|\.)rumble\.com$/, /^\/v\w+/]
];

function knownMediaPage(url) {
  let u; try { u = new URL(url); } catch (e) { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.toLowerCase(), p = u.pathname + (u.search || '');
  return RULES.some(([h, pth]) => h.test(host) && pth.test(p));
}

module.exports = { knownMediaPage };
