'use strict';
/*
 * Features that used to be extensions, now part of the browser (no extension process, no background page):
 *  - SponsorBlock: skip sponsor segments in YouTube videos (segments from the public SponsorBlock API)
 *  - Clean YouTube: hide parts of YouTube (shorts, comments...) with CSS switches
 *  - Ambient light for YouTube: the original scripts, run directly in YouTube pages
 *  - Twitch ads: the open-source "vaft" script (TwitchAdSolutions, MIT)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { net } = require('electron');

const INJECT = path.join(__dirname, 'inject');
const AMBIENT = path.join(INJECT, 'ambient');

/* ---------- scripts injected into pages (read once, kept in memory) ---------- */
const CODE = { twitch: 'twitch-vaft.js', ambientContent: 'ambient/scripts/content.js', ambientMain: 'ambient/scripts/content-main.js' };
const codeCache = new Map();
function code(name) {
  if (!CODE[name]) return '';
  if (!codeCache.has(name)) { try { codeCache.set(name, fs.readFileSync(path.join(INJECT, CODE[name]), 'utf8')); } catch (e) { return ''; } }
  return codeCache.get(name);
}

/* ---------- zeus-res://ambient/... : files a YouTube page loads for ambient light ---------- */
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve(req) {
  try {
    const u = new URL(req.url);
    if (u.host !== 'ambient') return new Response('', { status: 404 });
    const p = path.normalize(path.join(AMBIENT, decodeURIComponent(u.pathname)));
    if (!p.startsWith(AMBIENT + path.sep)) return new Response('', { status: 404 });
    return new Response(fs.readFileSync(p), { headers: {
      'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
      'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000'
    } });
  } catch (e) { return new Response('', { status: 404 }); }
}

/* ---------- SponsorBlock ---------- */
const SB_CATS = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler', 'music_offtopic'];
const sbCache = new Map();
async function sbSegments(id, cats) {
  if (!/^[\w-]{11}$/.test(id || '')) return [];
  if (process.env.ZEUS_SB_TEST) { try { return JSON.parse(process.env.ZEUS_SB_TEST); } catch (e) { return []; } }   // offline testing
  cats = (cats || []).filter(c => SB_CATS.includes(c));
  if (!cats.length) return [];
  const key = id + '|' + cats.join(',');
  const hit = sbCache.get(key); if (hit && Date.now() - hit.t < 30 * 60000) return hit.v;
  let v = [];
  try {
    // privacy: only the first 4 characters of the video's hash leave the computer
    const pre = crypto.createHash('sha256').update(id).digest('hex').slice(0, 4);
    const r = await net.fetch(`https://sponsor.ajay.app/api/skipSegments/${pre}?categories=${encodeURIComponent(JSON.stringify(cats))}&actionTypes=${encodeURIComponent('["skip","mute"]')}`);
    if (r.ok) {
      const all = await r.json();
      const mine = Array.isArray(all) ? all.find(x => x.videoID === id) : null;
      v = mine ? mine.segments.filter(s => Array.isArray(s.segment)).map(s => ({ s: +s.segment[0], e: +s.segment[1], c: s.category, a: s.actionType })) : [];
    }
  } catch (e) { return []; }
  sbCache.set(key, { t: Date.now(), v });
  if (sbCache.size > 200) sbCache.delete(sbCache.keys().next().value);
  return v;
}

/* ---------- Clean YouTube: switches -> attributes on <html>, CSS does the hiding ---------- */
// id: [html attributes it turns on]
const YT_CLEAN = {
  shorts: ['hide-yt-shorts-tab', 'hide-yt-shorts-videos', 'hide-yt-shorts-in-recomended'],
  comments: ['hide-yt-comments'], related: ['hide-yt-recomended-video'], cards: ['hide-yt-cards'],
  autoplay: ['hide-yt-autoplay'], home: ['hide-yt-home-page'], liveChat: ['hide-yt-live-chat'],
  notifications: ['hide-yt-notifications'], subscribe: ['hide-yt-subscribe-button'], likes: ['hide-yt-likes'],
  views: ['hide-yt-views'], trends: ['hide-yt-trends'], playables: ['hide-yt-playables'],
  subscriptions: ['hide-yt-subscriptions'], blur: ['blur-thumbnails'], thumbs: ['hide-thumbnails'],
  gray: ['black-white-mode'], clean: ['clean-mode']
};
// the hiding rules (from Clean YouTube 1.9.8)
const YT_CLEAN_CSS = `html[hide-yt-autoplay=true] .autonav-endscreen,html[hide-yt-autoplay=true] .ytp-autonav-endscreen-countdown-overlay,html[hide-yt-autoplay=true] button[data-tooltip-target-id=ytp-autonav-toggle-button],html[hide-yt-autoplay=true] ytd-watch-flexy:not([playlist]) .ytp-chrome-controls .ytp-next-button,html[hide-yt-notifications=true] ytd-notification-topbar-button-renderer,html[hide-yt-cards=true] .ytp-ce-element,html[hide-yt-cards=true] .ytp-fullscreen-grid-stills-container,html[hide-yt-cards=true] .html5-endscreen:not(.mweb-endscreen),html[hide-yt-comments=true] #comment-teaser,html[hide-yt-comments=true] #comments,html[hide-yt-comments=true] #comments-button,html[hide-yt-recomended-video=true] #items.ytd-watch-next-secondary-results-renderer,html[hide-yt-recomended-video=true] ytb-rich-grid-renderer.ytb-watch-grid,html[hide-yt-shorts-tab=true] .yt-simple-endpoint[title=Shorts],html[hide-yt-shorts-tab=true] ytd-guide-entry-renderer:has(a[title=Shorts]),html[hide-yt-shorts-tab=true] ytd-mini-guide-entry-renderer[aria-label=Shorts],html[hide-yt-shorts-in-recomended=true] #contents ytd-reel-shelf-renderer,html[hide-yt-shorts-videos=true] grid-shelf-view-model,html[hide-yt-shorts-videos=true] ytd-rich-shelf-renderer[is-shorts],html[hide-yt-shorts-videos=true] ytd-reel-shelf-renderer,html[hide-yt-shorts-videos=true] #shorts-container,html[hide-yt-subscriptions=true] .yt-simple-endpoint[href^="/feed/subscriptions"],html[hide-yt-subscribe-button=true] #subscribe-button,html[hide-yt-trends=true] a[data-e2e=nav-explore],html[hide-yt-likes=true] segmented-like-dislike-button-view-model,html[hide-yt-live-chat=true] #chat-container,html[hide-yt-playables=true] #dismissible.style-scope.ytd-rich-shelf-renderer:has(a[href="/playables"]),html[hide-yt-views=true] .ytContentMetadataViewModelMetadataRow:last-child span[role=text]:first-child,html[clean-mode=true] #items.ytd-watch-next-secondary-results-renderer,html[clean-mode=true] #below,html[hide-thumbnails=true] yt-thumbnail-view-model,html[clean-mode=true] #secondary #secondary-inner,html[hide-yt-home-page=true] ytd-browse[page-subtype=home] #primary{display:none!important}html[black-white-mode=true]{filter:grayscale(100%)!important}html[clean-mode=true] #secondary{min-width:0!important;width:0!important}html[blur-thumbnails=true] yt-thumbnail-view-model{filter:blur(10px)}`;

/* bring the user's old extension settings over (once) */
const CY_KEYS = {
  'hide-yt-home-page': 'home', 'hide-yt-comments': 'comments', 'hide-yt-shorts': 'shorts', 'hide-yt-shorts-tab': 'shorts',
  'hide-yt-shorts-videos': 'shorts', 'hide-yt-cards': 'cards', 'hide-yt-recomended-video': 'related', 'hide-yt-auto-play': 'autoplay',
  'hide-yt-subscriptions': 'subscriptions', 'hide-subscribe-button': 'subscribe', 'hide-likes': 'likes', 'hide-views': 'views',
  'hide-live-chat': 'liveChat', 'black-white-mode': 'gray', 'hide-trends': 'trends', 'hide-playables': 'playables',
  'clean-mode': 'clean', 'hide-thumbnails': 'thumbs', 'blur-thumbnails': 'blur', 'hide-yt-notifications': 'notifications'
};
function cleanFromExtension(store) {
  const out = {};
  if (!store || store['youtube-blocker-enable'] === false) return out;
  for (const [k, id] of Object.entries(CY_KEYS)) if (store[k] === true) out[id] = true;
  return out;
}

module.exports = { code, serve, sbSegments, SB_CATS, YT_CLEAN, YT_CLEAN_CSS, cleanFromExtension, AMBIENT };
