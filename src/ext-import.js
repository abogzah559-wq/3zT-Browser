'use strict';
/*
 * Brings the user's Chrome extensions into 3zT Browser.
 *  - copies each compatible extension from Chrome's profile into our own folder
 *  - patches the copy so it runs in Electron (API shim for missing Chrome APIs)
 *  - carries over the extension's saved settings (its LevelDB "Local Extension Settings")
 *  - skips ones that can't work here, ones replaced by a built-in feature, and ones the user declined
 */
const fs = require('fs');
const path = require('path');

/* known extensions: what to do with each */
const KNOWN = {
  hpdpcjakhclhljfdkpjolonjlopbdhfk: { skip: 'declined', why: 'Framegen' },
  kjhigpfcihnpjchpfnboofeecckigbmb: { skip: 'declined', why: 'Video Quality Enhancer' },
  nmmhkkegccagdldgiimedpiccmgmieda: { skip: 'internal', why: 'Chrome Web Store Payments' },
  ghbmnnjooekpmoecnnnilnnbdlolhkhi: { skip: 'internal', why: 'Google Docs Offline' },
  ahmpjcflkgiildlgicmcieglgoilbfdp: { skip: 'builtin', why: 'Free Download Manager (built-in hand-off)' },
  bgnkhhnnamicmpeenaelnjfhikgbkllg: { skip: 'builtin', why: 'AdGuard (built-in ad blocker)' },
  gighmmpiobklfepjocnamgkkbiglidom: { skip: 'builtin', why: 'AdBlock (built-in ad blocker)' },
  jpkfgepcmmchgfbjblnodjhldacghenp: { skip: 'builtin', why: 'Pie Adblock (built-in ad blocker)' },
  cjpalhdlnbpafiamejdnhcphjbkeiagm: { skip: 'builtin', why: 'uBlock Origin (built-in ad blocker)' },
  mpbjkejclgfgadiemmefgebjfooflfhl: { skip: 'unsupported', why: 'Buster (needs offscreen documents)' }
};

/* generic rule for anything else: these Chrome-only APIs are missing in Electron */
function unsupported(m) {
  const p = [].concat(m.permissions || [], m.optional_permissions || []);
  if (p.includes('nativeMessaging')) return 'nativeMessaging';
  if (p.includes('offscreen')) return 'offscreen';
  if (m.manifest_version === 2 && m.app) return 'app';
  if (m.app || m.theme) return 'app';
  return '';
}

function chromeExtDirs(profileDir) {
  const base = path.join(profileDir, 'Extensions');
  const out = [];
  let ids = [];
  try { ids = fs.readdirSync(base); } catch (e) { return out; }
  for (const id of ids) {
    if (!/^[a-p]{32}$/.test(id)) continue;
    let vers = [];
    try { vers = fs.readdirSync(path.join(base, id)).filter(v => fs.existsSync(path.join(base, id, v, 'manifest.json'))); } catch (e) {}
    if (!vers.length) continue;
    vers.sort((a, b) => cmpVer(b, a));
    out.push({ id, dir: path.join(base, id, vers[0]), version: vers[0] });
  }
  return out;
}
function cmpVer(a, b) {
  const pa = a.split(/[._]/).map(Number), pb = b.split(/[._]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}
function readManifest(dir) { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^﻿/, '')); }
function localizedName(dir, m) {
  const mm = /^__MSG_(\w+)__$/.exec(m.name || '');
  if (!mm) return m.name;
  for (const loc of ['ar', m.default_locale || 'en', 'en', 'en_US']) {
    try {
      const msgs = JSON.parse(fs.readFileSync(path.join(dir, '_locales', loc, 'messages.json'), 'utf8').replace(/^﻿/, ''));
      const k = Object.keys(msgs).find(x => x.toLowerCase() === mm[1].toLowerCase());
      if (k) return msgs[k].message;
    } catch (e) {}
  }
  return m.name;
}

function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip && skip(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip);
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}
function rmDir(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }

/* make a copied extension run in Electron */
function patch(dir, shimSource) {
  fs.writeFileSync(path.join(dir, 'zeus_shim.js'), shimSource);
  const m = readManifest(dir);
  // background: load the shim first
  if (m.background && m.background.service_worker) {
    const orig = m.background.service_worker.replace(/^\//, '');
    const isModule = m.background.type === 'module';
    fs.writeFileSync(path.join(dir, 'zeus_bg.js'), isModule
      ? `import './zeus_shim.js';\nimport './${orig}';\n`
      : `importScripts('zeus_shim.js', '${orig}');\n`);
    m.background = Object.assign({}, m.background, { service_worker: 'zeus_bg.js' });
    delete m.background.scripts;              // MV3 + leftover MV2 "scripts" confuses Electron
  }
  // extension pages (popup, options...): shim before their own scripts
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (!/\.html?$/i.test(e.name)) continue;
      let s = fs.readFileSync(f, 'utf8');
      if (s.includes('zeus_shim.js')) continue;
      if (/<head[^>]*>/i.test(s)) s = s.replace(/(<head[^>]*>)/i, '$1<script src="/zeus_shim.js"></script>');
      else s = '<script src="/zeus_shim.js"></script>' + s;
      fs.writeFileSync(f, s);
    }
  })(dir);
  delete m.update_url;                          // never try to self-update from the Chrome store
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 1));
  return m;
}

/* copy the extension's saved settings (LevelDB) so it keeps the user's choices */
function copySettings(profileDir, userData, id) {
  const dst = path.join(userData, 'Local Extension Settings', id);
  if (fs.existsSync(dst)) return false;          // already has its own settings here
  for (const kind of ['Local Extension Settings', 'Sync Extension Settings']) {
    const src = path.join(profileDir, kind, id);
    if (!fs.existsSync(src)) continue;
    try { copyDir(src, dst, n => n === 'LOCK'); return true; } catch (e) { rmDir(dst); }
  }
  return false;
}

/*
 * Import from the given Chrome profiles into <userData>/extensions.
 * Returns { imported:[{id,name,path}], skipped:[{id,name,reason}] }
 */
function importFromChrome(profileDirs, userData, shimSource, opts = {}) {
  const root = path.join(userData, 'extensions');
  fs.mkdirSync(root, { recursive: true });
  const imported = [], skipped = [], seen = new Set();
  for (const prof of profileDirs) {
    for (const ex of chromeExtDirs(prof)) {
      if (seen.has(ex.id)) continue; seen.add(ex.id);
      let m; try { m = readManifest(ex.dir); } catch (e) { continue; }
      const name = localizedName(ex.dir, m);
      const known = KNOWN[ex.id];
      if (known) { skipped.push({ id: ex.id, name, reason: known.skip }); continue; }
      const u = unsupported(m);
      if (u) { skipped.push({ id: ex.id, name, reason: 'unsupported:' + u }); continue; }
      const dst = path.join(root, ex.id);
      try {
        rmDir(dst);
        copyDir(ex.dir, dst, n => n === '_metadata');
        patch(dst, shimSource);
        if (opts.settings !== false) copySettings(prof, userData, ex.id);
        imported.push({ id: ex.id, name, path: dst, version: m.version });
      } catch (e) {
        rmDir(dst);
        skipped.push({ id: ex.id, name, reason: 'error:' + e.message });
      }
    }
  }
  return { imported, skipped };
}

module.exports = { importFromChrome, patch, KNOWN };
