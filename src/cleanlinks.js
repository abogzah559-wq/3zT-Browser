'use strict';
/*
 * Link cleaning: the tracking parts sites add to addresses (utm_source, fbclid, gclid...) are taken off before a
 * page is opened, and tracking redirects (a site's "/url?q=<real address>") go straight to the real address.
 *
 * The rules are ClearURLs' (https://docs.clearurls.xyz, LGPL-3.0), maintained by its community and downloaded at
 * run time (checked against the SHA-256 the project publishes, refreshed every few days). Only its "remove these
 * fields", "raw rules" and "redirections" are used; referral / affiliate fields are left alone (as in ClearURLs'
 * defaults), and so are whole-site blocks (the ad blocker decides those). Until the rules are downloaded a short
 * built-in list of the best known tracking fields is used.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_URL = 'https://rules2.clearurls.xyz/data.minify.json';
const HASH_URL = 'https://rules2.clearurls.xyz/rules.minify.hash';
const REFRESH_MS = 3 * 24 * 3600 * 1000;

// used until ClearURLs' rules are here: tracking fields every site may carry
const BUILTIN = {
  providers: {
    builtin: {
      urlPattern: '.*',
      rules: ['utm_[a-z_]+', 'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'igshid', 'mc_eid',
        'mkt_tok', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'oly_enc_id', 'oly_anon_id', 'vero_id', 'wickedid', 'twclid', 'ttclid', 'srsltid'],
      exceptions: [], redirections: [], rawRules: []
    }
  }
};

class LinkCleaner {
  constructor(dir, log = () => {}) {
    this.dir = dir;
    this.log = log;
    this.providers = [];
    this.source = 'builtin';
    let data = null;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8')); this.source = 'clearurls'; } catch (e) {}
    this.compile(data || BUILTIN);
  }

  compile(data) {
    const out = [];
    const re = (s, f) => { try { return new RegExp(s, f); } catch (e) { return null; } };
    for (const [name, p] of Object.entries((data && data.providers) || {})) {
      if (!p || typeof p.urlPattern !== 'string') continue;
      const pat = re(p.urlPattern, 'i'); if (!pat) continue;
      const rules = (p.rules || []).filter(r => typeof r === 'string' && re(r));
      out.push({
        name, pat,
        exceptions: (p.exceptions || []).map(x => re(x, 'i')).filter(Boolean),
        redirections: (p.redirections || []).map(x => re(x, 'i')).filter(Boolean),
        rawRules: (p.rawRules || []).map(x => re(x, 'gi')).filter(Boolean),
        fields: rules.length ? re('^(?:' + rules.join('|') + ')$', 'i') : null
      });
    }
    // the catch-all provider last (ClearURLs' "globalRules" matches every address)
    out.sort((a, b) => (a.pat.source === '.*') - (b.pat.source === '.*'));
    if (out.length) this.providers = out;
  }

  /* the address without its tracking parts (the same string when there is nothing to take off) */
  clean(url, depth = 0) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || url.length > 8192) return url;
    let u = url;
    for (const p of this.providers) {
      if (!p.pat.test(u)) continue;
      if (p.exceptions.some(x => x.test(u))) continue;
      for (const r of p.redirections) {
        const m = r.exec(u);
        if (m && m[1]) {
          let t = m[1]; try { t = decodeURIComponent(t); } catch (e) {}
          if (/^https?:\/\//i.test(t) && depth < 3) return this.clean(t, depth + 1);
        }
      }
      for (const r of p.rawRules) { r.lastIndex = 0; u = u.replace(r, ''); }
      if (p.fields) u = this.dropFields(u, p.fields);
    }
    return u;
  }
  dropFields(u, fields) {
    let x; try { x = new URL(u); } catch (e) { return u; }
    let changed = false;
    if (x.search) {
      const keep = [];
      for (const part of x.search.slice(1).split('&')) {
        if (!part) continue;
        let k = part.split('=')[0]; try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (e) {}
        if (fields.test(k)) changed = true; else keep.push(part);
      }
      if (changed) x.search = keep.length ? '?' + keep.join('&') : '';
    }
    // fields in the part after "#" too, when it is written like a query (#utm_source=...&x=1)
    if (x.hash && /^#[^#/]*=/.test(x.hash)) {
      const parts = x.hash.slice(1).split('&');
      const keep = parts.filter(part => { let k = part.split('=')[0]; try { k = decodeURIComponent(k); } catch (e) {} return !fields.test(k); });
      if (keep.length !== parts.length) { changed = true; x.hash = keep.length ? '#' + keep.join('&') : ''; }
    }
    if (!changed) return u;
    let s = x.href;
    if (!x.search && !x.hash && /\?$/.test(s)) s = s.slice(0, -1);
    return s;
  }

  /* ClearURLs' rules: downloaded when the published checksum changes (fetchFn = Electron net.fetch) */
  async refresh(fetchFn, force) {
    let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(this.dir, 'meta.json'), 'utf8')); } catch (e) {}
    if (!force && this.source === 'clearurls' && Date.now() - (meta.t || 0) < REFRESH_MS) return false;
    const hr = await fetchFn(HASH_URL); if (!hr.ok) throw new Error('hash HTTP ' + hr.status);
    const want = ((await hr.text()).match(/[0-9a-f]{64}/i) || [''])[0].toLowerCase();
    if (!want) throw new Error('no checksum');
    if (want === meta.hash && this.source === 'clearurls') { meta.t = Date.now(); this.saveMeta(meta); return false; }
    const r = await fetchFn(DATA_URL); if (!r.ok) throw new Error('rules HTTP ' + r.status);
    const text = await r.text();
    const got = crypto.createHash('sha256').update(text).digest('hex');
    if (got !== want) throw new Error('checksum mismatch');
    const data = JSON.parse(text);
    if (!data || !data.providers || Object.keys(data.providers).length < 10) throw new Error('not ClearURLs rules');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, 'data.json.tmp'), text);
    fs.renameSync(path.join(this.dir, 'data.json.tmp'), path.join(this.dir, 'data.json'));
    this.saveMeta({ t: Date.now(), hash: want });
    this.compile(data); this.source = 'clearurls';
    this.log('link cleaning rules updated:', this.providers.length, 'providers');
    return true;
  }
  saveMeta(m) { try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(path.join(this.dir, 'meta.json'), JSON.stringify(m)); } catch (e) {} }
}

module.exports = { LinkCleaner, BUILTIN };
