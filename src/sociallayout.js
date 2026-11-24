'use strict';
/*
 * Where TikTok's parts are (the TikTok / Instagram layout, src/inject/social-view.js).
 *
 * The layout finds TikTok's buttons, caption and arrows by the names listed in src/social-layout.json. TikTok
 * renames them from time to time, so the same file is also downloaded from this project's GitHub repository
 * (main branch) every few hours: when TikTok changes something, updating that one file there fixes every
 * installed copy without a new version of the browser.
 *
 * The file holds nothing but CSS selectors (and one pattern for Instagram's arrow labels). They are only ever
 * used to look elements up; they cannot add styles or run code. A downloaded file is checked before use (size,
 * shape, lengths, characters), and its names are tried before the built-in ones, which stay as a fallback.
 */
const fs = require('fs');
const path = require('path');

const URL_RAW = 'https://raw.githubusercontent.com/abogzah559-wq/3zT-Browser/main/src/social-layout.json';
const EVERY = 6 * 3600 * 1000;
const BUILTIN = require('./social-layout.json');
const TT_KEYS = ['actions', 'caption', 'nav', 'controls', 'actionIcons', 'captionInside', 'navButtons', 'sidebarToggle'];
const MAX_BYTES = 32 * 1024, MAX_ITEMS = 16, MAX_LEN = 200;

// a downloaded file -> the same shape, cleaned; throws when it is not a usable rules file
function validate(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
  if (!Number.isInteger(j.version) || j.version < 1) throw new Error('no version');
  const tt = j.tiktok;
  if (!tt || typeof tt !== 'object' || Array.isArray(tt)) throw new Error('no tiktok rules');
  const out = { version: j.version, tiktok: {}, instagram: {} };
  for (const k of TT_KEYS) {
    if (tt[k] === undefined) continue;
    if (!Array.isArray(tt[k]) || tt[k].length > MAX_ITEMS) throw new Error(k + ': not a list');
    out.tiktok[k] = tt[k].map(s => {
      if (typeof s !== 'string' || !s.trim() || s.length > MAX_LEN || /[{};<]/.test(s)) throw new Error(k + ': bad selector');
      return s.trim();
    });
  }
  if (!out.tiktok.actions || !out.tiktok.actions.length) throw new Error('no actions selectors');
  const ig = j.instagram;
  if (ig && typeof ig === 'object' && typeof ig.navLabel === 'string') {
    if (ig.navLabel.length > 100) throw new Error('navLabel too long');
    try { new RegExp(ig.navLabel, 'i'); } catch (e) { throw new Error('navLabel: bad pattern'); }
    out.instagram.navLabel = ig.navLabel;
  }
  return out;
}

// the downloaded names first, then the built-in ones it does not have (they stay as a fallback)
function merge(remote, builtin = BUILTIN) {
  const out = { version: Math.max(remote ? remote.version : 0, builtin.version), tiktok: {}, instagram: {} };
  for (const k of TT_KEYS) {
    const a = (remote && remote.tiktok[k]) || [], b = builtin.tiktok[k] || [];
    out.tiktok[k] = [...a, ...b.filter(x => !a.includes(x))];
  }
  out.instagram.navLabel = (remote && remote.instagram.navLabel) || builtin.instagram.navLabel;
  return out;
}

class SocialLayout {
  constructor(dir, log = () => {}) {
    this.dir = dir; this.log = log; this.busy = null;
    this.remote = null;
    try { this.remote = validate(JSON.parse(fs.readFileSync(path.join(dir, 'rules.json'), 'utf8'))); } catch (e) {}
    this.rules = merge(this.remote);
  }
  meta() { try { return JSON.parse(fs.readFileSync(path.join(this.dir, 'meta.json'), 'utf8')); } catch (e) { return {}; } }
  // `get(url, headers)` returns a fetch Response
  refresh(get, force) {
    if (this.busy) return this.busy;
    this.busy = (async () => {
      const meta = this.meta();
      if (!force && Date.now() - (meta.t || 0) < EVERY) return false;
      const r = await get(URL_RAW, this.remote && meta.etag ? { 'If-None-Match': meta.etag } : {});
      const save = m => { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(path.join(this.dir, 'meta.json'), JSON.stringify(m)); };
      if (r.status === 304) { save(Object.assign({}, meta, { t: Date.now() })); return false; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      if (text.length > MAX_BYTES) throw new Error('too large');
      const j = validate(JSON.parse(text));
      fs.mkdirSync(this.dir, { recursive: true });
      const f = path.join(this.dir, 'rules.json');
      fs.writeFileSync(f + '.tmp', JSON.stringify(j)); fs.renameSync(f + '.tmp', f);
      save({ t: Date.now(), etag: r.headers.get('etag') || '', version: j.version });
      const changed = JSON.stringify(j) !== JSON.stringify(this.remote);
      this.remote = j; this.rules = merge(j);
      if (changed) this.log('TikTok layout names updated (version ' + j.version + ')');
      return changed;
    })().finally(() => { this.busy = null; });
    return this.busy;
  }
}

module.exports = { SocialLayout, validate, merge, BUILTIN, URL_RAW, TT_KEYS };
