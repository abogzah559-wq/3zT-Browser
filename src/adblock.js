'use strict';
/*
 * Built-in ad & tracker blocker (network level).
 * Uses the same public lists as uBlock / AdBlock (EasyList + EasyPrivacy): the domain rules
 * ("||ads.example.com^") are downloaded on the user's machine, cached, and refreshed every few days.
 * A small built-in list works from the first second, before any download.
 */
const fs = require('fs');
const path = require('path');

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

class AdBlocker {
  constructor(dir) {
    this.dir = dir;
    this.block = new Set(SEED);       // block everywhere
    this.block3p = new Set();         // block only when loaded by another site
    this.allow = new Set();           // exceptions from the lists
    this.ruleCount = SEED.length;
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    this.loadCached();
  }

  /* "||host^" rules only (the bulk of the lists, cheap and safe). Site-specific and path rules are skipped. */
  parse(text) {
    const block = new Set(), block3p = new Set(), allow = new Set();
    const re = /^(@@)?\|\|([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\^(?:\$(.*))?$/i;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line[0] === '!' || line.includes('#')) continue;
      const m = re.exec(line); if (!m) continue;
      const host = m[2].toLowerCase(), opts = (m[3] || '').toLowerCase();
      if (opts) {
        if (/(^|,)domain=/.test(opts)) continue;                                   // site-specific
        if (!m[1] && /(^|,)(popup|csp|redirect|redirect-rule|removeparam|badfilter|~third-party|first-party|1p)(,|=|$)/.test(opts)) continue;
      }
      if (m[1]) { allow.add(host); continue; }
      if (/(^|,)(third-party|3p)(,|$)/.test(opts)) block3p.add(host); else block.add(host);
    }
    return { block, block3p, allow };
  }
  apply(texts) {
    const block = new Set(SEED), block3p = new Set(), allow = new Set();
    for (const t of texts) {
      const r = this.parse(t);
      r.block.forEach(h => block.add(h)); r.block3p.forEach(h => block3p.add(h)); r.allow.forEach(h => allow.add(h));
    }
    this.block = block; this.block3p = block3p; this.allow = allow;
    this.ruleCount = block.size + block3p.size;
  }
  loadCached() {
    const texts = [];
    for (const l of LISTS) { try { texts.push(fs.readFileSync(path.join(this.dir, l.name + '.txt'), 'utf8')); } catch (e) {} }
    if (texts.length) this.apply(texts);
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
    if (texts.length) { this.apply(texts); fs.writeFileSync(stamp, JSON.stringify({ t: Date.now() })); }
    return true;
  }

  static hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } }
  /* rough "same site" check: compare the last two labels (three for things like co.uk / com.sa) */
  static site(host) {
    const p = host.split('.');
    const n = p.length > 2 && /^(co|com|net|org|gov|edu|ac)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
    return p.slice(-n).join('.');
  }
  inSet(set, host) {
    let h = host;
    for (;;) {
      if (set.has(h)) return true;
      const i = h.indexOf('.'); if (i < 0) return false;
      h = h.slice(i + 1);
    }
  }
  /* should this request be blocked? pageUrl = the page that is loading it */
  shouldBlock(url, pageUrl) {
    const host = AdBlocker.hostOf(url); if (!host) return false;
    if (this.inSet(this.allow, host)) return false;
    if (this.inSet(this.block, host)) {
      // never block a site's own resources (e.g. visiting doubleclick.net itself)
      const page = AdBlocker.hostOf(pageUrl);
      return !page || AdBlocker.site(page) !== AdBlocker.site(host);
    }
    if (this.block3p.size && this.inSet(this.block3p, host)) {
      const page = AdBlocker.hostOf(pageUrl);
      return !!page && AdBlocker.site(page) !== AdBlocker.site(host);
    }
    return false;
  }
}

module.exports = { AdBlocker };
