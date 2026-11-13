'use strict';
/*
 * Built-in ad & tracker blocker (network level).
 * Uses the same public lists as uBlock / AdBlock (EasyList + EasyPrivacy): the domain rules
 * ("||ads.example.com^") are downloaded on the user's machine, cached, and refreshed every few days.
 * A small built-in list works from the first second, before any download.
 */
const fs = require('fs');
const path = require('path');
const { site } = require('./domains');

const LISTS = [
  { name: 'easylist', url: 'https://easylist.to/easylist/easylist.txt' },
  { name: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' }
];
const REFRESH_MS = 4 * 24 * 3600 * 1000;

/* well-known ad / tracking hosts, used until the full lists are downloaded */
const SEED = `doubleclick.net googlesyndication.com googleadservices.com adservice.google.com pagead2.googlesyndication.com
google-analytics.com googletagmanager.com googletagservices.com analytics.google.com
adnxs.com adsrvr.org rubiconproject.com pubmatic.com openx.net criteo.com criteo.net casalemedia.com
taboola.com outbrain.com revcontent.com mgid.com zemanta.com teads.tv smartadserver.com
amazon-adsystem.com media.net adform.net yieldmo.com sharethrough.com triplelift.com indexww.com 3lift.com
scorecardresearch.com quantserve.com quantcount.com hotjar.com mouseflow.com fullstory.com
facebook.net connect.facebook.net ads-twitter.com static.ads-twitter.com ads.linkedin.com px.ads.linkedin.com
analytics.tiktok.com ads.tiktok.com analytics.yahoo.com ads.yahoo.com advertising.com
moatads.com doubleverify.com adsafeprotected.com serving-sys.com flashtalking.com
popads.net popcash.net propellerads.com exoclick.com juicyads.com trafficjunky.net adcash.com
onclickads.net hilltopads.net clickadu.com adsterra.com a-ads.com
bat.bing.com clarity.ms adroll.com bidswitch.net contextweb.com sovrn.com lijit.com
yandex.ru/ads mc.yandex.ru an.yandex.ru adfox.ru`.split(/\s+/).filter(x => x && !x.includes('/'));

/* EasyList resource-type options -> Electron's webRequest resourceType */
const TYPES = {
  script: ['script'], image: ['image'], stylesheet: ['stylesheet'], object: ['object'],
  xmlhttprequest: ['xhr'], xhr: ['xhr'], subdocument: ['subFrame'], frame: ['subFrame'], ping: ['ping'], beacon: ['ping'],
  media: ['media'], font: ['font'], websocket: ['webSocket'], other: ['other', 'cspReport']
};
const ALL_TYPES = [...new Set(Object.values(TYPES).flat())];
// options that make a rule something other than "block this host": skipped
const SKIP = /^(popup|csp|redirect|redirect-rule|removeparam|badfilter|~third-party|first-party|1p|document|doc|elemhide|generichide|genericblock|specifichide|header|permissions|urltransform|replace|to|method|denyallow|strict1p|strict3p|all)$/;

class AdBlocker {
  constructor(dir) {
    this.dir = dir;
    this.block = new Set(SEED);       // block everywhere, every type
    this.block3p = new Set();         // block only when loaded by another site, every type
    this.typed = new Map();           // host -> [{ types: Set|null, tp: bool }] rules limited to some resource types
    this.allow = new Set();           // exceptions from the lists (every type)
    this.allowTyped = new Map();      // host -> [Set of types]
    this.popup = new Set();           // hosts whose pages are ads when they open as a new tab ("||host^$popup")
    this.ruleCount = SEED.length;
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    this.loadCached();
  }

  /* "||host^" rules, with their resource types and third-party option. Site-specific and path rules are skipped. */
  parse(text) {
    const out = { block: new Set(), block3p: new Set(), typed: new Map(), allow: new Set(), allowTyped: new Map(), popup: new Set() };
    const re = /^(@@)?\|\|([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\^(?:\$(.*))?$/i;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line[0] === '!' || line[0] === '[' || line.includes('#')) continue;
      const m = re.exec(line); if (!m) continue;
      const host = m[2].toLowerCase();
      const opts = (m[3] || '').toLowerCase().split(',').map(o => o.trim()).filter(Boolean);
      // "||host^$popup" (maybe with third-party): that host opening as a new tab is an ad. Site-specific ones: skipped.
      if (!m[1] && opts.includes('popup')) {
        if (opts.every(o => o === 'popup' || o === 'third-party' || o === '3p' || o === 'important')) out.popup.add(host);
        continue;
      }
      let tp = false, skip = false;
      const yes = new Set(), no = new Set();
      for (const o of opts) {
        const name = o.split('=')[0];
        if (name === 'domain' || name === 'from') { skip = true; break; }   // site-specific
        if (o === 'third-party' || o === '3p') { tp = true; continue; }
        if (o === 'important' || o === 'match-case') continue;
        if (TYPES[o]) { TYPES[o].forEach(t => yes.add(t)); continue; }
        if (o[0] === '~' && TYPES[o.slice(1)]) { TYPES[o.slice(1)].forEach(t => no.add(t)); continue; }
        if (SKIP.test(name)) { skip = true; break; }
        skip = true; break;                                                  // an option we don't understand: leave the rule out
      }
      if (skip) continue;
      let types = null;                                                        // null = every type
      if (yes.size) types = yes;
      else if (no.size) types = new Set(ALL_TYPES.filter(t => !no.has(t)));
      if (m[1]) {
        if (tp) continue;                                                      // a third-party-only exception: not applied (never allow too much)
        if (!types) out.allow.add(host);
        else { const l = out.allowTyped.get(host) || []; l.push(types); out.allowTyped.set(host, l); }
        continue;
      }
      if (!types) (tp ? out.block3p : out.block).add(host);
      else { const l = out.typed.get(host) || []; l.push({ types, tp }); out.typed.set(host, l); }
    }
    return out;
  }
  apply(texts) {
    const block = new Set(SEED), block3p = new Set(), allow = new Set(), typed = new Map(), allowTyped = new Map(), popup = new Set();
    const merge = (dst, src) => src.forEach((v, k) => dst.set(k, (dst.get(k) || []).concat(v)));
    for (const t of texts) {
      const r = this.parse(t);
      r.block.forEach(h => block.add(h)); r.block3p.forEach(h => block3p.add(h)); r.allow.forEach(h => allow.add(h)); r.popup.forEach(h => popup.add(h));
      merge(typed, r.typed); merge(allowTyped, r.allowTyped);
    }
    Object.assign(this, { block, block3p, allow, typed, allowTyped, popup });
    this.ruleCount = block.size + block3p.size + typed.size;
  }
  /* the lists, already parsed (compiled.json): ~10x faster at start than parsing the text lists again */
  stamp() {
    return LISTS.map(l => { try { const st = fs.statSync(path.join(this.dir, l.name + '.txt')); return `${l.name}:${st.size}:${Math.round(st.mtimeMs)}`; } catch (e) { return l.name + ':-'; } }).join('|') + '|v4|' + SEED.length + ':' + SEED.join(',').length;   // a new SEED or parser = parse again
  }
  saveCompiled() {
    try {
      const data = { stamp: this.stamp(), block: [...this.block], block3p: [...this.block3p], allow: [...this.allow], popup: [...this.popup],
        typed: [...this.typed].map(([h, l]) => [h, l.map(r => [[...r.types], r.tp ? 1 : 0])]),
        allowTyped: [...this.allowTyped].map(([h, l]) => [h, l.map(t => [...t])]) };
      fs.writeFileSync(path.join(this.dir, 'compiled.json.tmp'), JSON.stringify(data));
      fs.renameSync(path.join(this.dir, 'compiled.json.tmp'), path.join(this.dir, 'compiled.json'));
    } catch (e) {}
  }
  loadCompiled() {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(this.dir, 'compiled.json'), 'utf8'));
      if (d.stamp !== this.stamp()) return false;
      this.block = new Set(SEED.concat(d.block)); this.block3p = new Set(d.block3p); this.allow = new Set(d.allow); this.popup = new Set(d.popup || []);
      this.typed = new Map(d.typed.map(([h, l]) => [h, l.map(([t, tp]) => ({ types: new Set(t), tp: !!tp }))]));
      this.allowTyped = new Map(d.allowTyped.map(([h, l]) => [h, l.map(t => new Set(t))]));
      this.ruleCount = this.block.size + this.block3p.size + this.typed.size;
      return true;
    } catch (e) { return false; }
  }
  loadCached() {
    if (this.loadCompiled()) return;
    const texts = [];
    for (const l of LISTS) { try { texts.push(fs.readFileSync(path.join(this.dir, l.name + '.txt'), 'utf8')); } catch (e) {} }
    if (texts.length) { this.apply(texts); this.saveCompiled(); }
  }
  /* download fresh lists in the background (fetchFn = Electron net.fetch) */
  async refresh(fetchFn, force) {
    const stamp = path.join(this.dir, 'updated.json');
    let last = 0; try { last = JSON.parse(fs.readFileSync(stamp, 'utf8')).t || 0; } catch (e) {}
    if (!force && Date.now() - last < REFRESH_MS && this.ruleCount > SEED.length) return false;
    const texts = [];
    for (const l of LISTS) {
      try {
        const r = await fetchFn(l.url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const t = await r.text();
        if (t.length < 10000 || !t.includes('||')) throw new Error('bad list');
        fs.writeFileSync(path.join(this.dir, l.name + '.txt'), t);
        texts.push(t);
      } catch (e) {
        try { texts.push(fs.readFileSync(path.join(this.dir, l.name + '.txt'), 'utf8')); } catch (x) {}
      }
    }
    if (texts.length) { this.apply(texts); this.saveCompiled(); fs.writeFileSync(stamp, JSON.stringify({ t: Date.now() })); }
    return true;
  }

  static hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } }
  // registrable domain from the Public Suffix List (decides "third-party" and the per-site switch)
  static site(host) { return site(host); }
  /* the host or one of its parent domains is in the set/map: returns that key */
  find(set, host) {
    let h = host;
    for (;;) {
      if (set.has(h)) return h;
      const i = h.indexOf('.'); if (i < 0) return null;
      h = h.slice(i + 1);
    }
  }
  inSet(set, host) { return this.find(set, host) !== null; }
  /* a page that opens as a new tab: is it an ad? (a pop-up host, or an ad server of the lists, from another site) */
  isAdPage(url, openerUrl) {
    const host = AdBlocker.hostOf(url); if (!host || !/^https?:/i.test(url)) return false;
    if (this.inSet(this.allow, host)) return false;
    const op = AdBlocker.hostOf(openerUrl);
    if (op && AdBlocker.site(op) === AdBlocker.site(host)) return false;
    return this.inSet(this.popup, host) || this.inSet(this.block, host) || this.inSet(this.block3p, host);
  }
  /* should this request be blocked? pageUrl = the page that is loading it, type = Electron resourceType */
  shouldBlock(url, pageUrl, type) {
    const host = AdBlocker.hostOf(url); if (!host) return false;
    if (this.inSet(this.allow, host)) return false;
    if (type && this.allowTyped.size) {
      for (let h = host; h;) {
        const l = this.allowTyped.get(h); if (l && l.some(s => s.has(type))) return false;
        const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1);
      }
    }
    const page = AdBlocker.hostOf(pageUrl);
    const thirdParty = !!page && AdBlocker.site(page) !== AdBlocker.site(host);
    // never block a site's own resources (e.g. visiting doubleclick.net itself)
    if (this.inSet(this.block, host)) return !page || thirdParty;
    if (this.block3p.size && this.inSet(this.block3p, host)) return thirdParty;
    if (type && this.typed.size) {
      for (let h = host; h;) {
        const l = this.typed.get(h);
        if (l && l.some(r => r.types.has(type) && (!r.tp || thirdParty) && (!page || thirdParty))) return true;
        const i = h.indexOf('.'); h = i < 0 ? '' : h.slice(i + 1);
      }
    }
    return false;
  }
}

module.exports = { AdBlocker };
