'use strict';
/*
 * Reads things from the user's installed Google Chrome (read-only, never writes there):
 *  - bookmarks bar
 *  - favicons (Chrome's own "Favicons" SQLite database) -> crisp icons like Chrome's new tab
 *  - the Black Chrome / Zeus new-tab settings (extension localStorage, a LevelDB)
 *  - the font / background the user uploaded in that extension (IndexedDB blob files)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function chromeBase(app) {
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
  if (process.platform === 'darwin') return path.join(app.getPath('home'), 'Library/Application Support/Google/Chrome');
  return path.join(app.getPath('home'), '.config/google-chrome');
}
/* profiles, most likely first: the one Chrome used last, then Default, then the rest */
function profiles(app) {
  const base = chromeBase(app);
  const out = [];
  try {
    const ls = JSON.parse(fs.readFileSync(path.join(base, 'Local State'), 'utf8'));
    const last = ls.profile && ls.profile.last_used; if (last) out.push(last);
  } catch (e) {}
  try {
    for (const d of ['Default', ...fs.readdirSync(base).filter(n => /^Profile \d+$/.test(n))]) if (!out.includes(d)) out.push(d);
  } catch (e) {}
  return out.map(d => path.join(base, d)).filter(p => fs.existsSync(p));
}

/* ---------------- bookmarks ---------------- */
function readBookmarksBar(app) {
  const conv = n => n.type === 'folder' ? { title: n.name, children: (n.children || []).map(conv).filter(Boolean) }
    : n.type === 'url' ? { title: n.name, url: n.url } : null;
  for (const p of profiles(app)) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(p, 'Bookmarks'), 'utf8'));
      const bar = (j.roots && j.roots.bookmark_bar && j.roots.bookmark_bar.children) || [];
      if (bar.length) return bar.map(conv).filter(Boolean);
    } catch (e) {}
  }
  return [];
}

/* ---------------- favicons ---------------- */
const normUrl = u => { try { const x = new URL(u); return x.origin + x.pathname.replace(/\/$/, '') + x.search; } catch (e) { return u; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
/* returns {"u:<normalized url>": dataURL, "h:<host>": dataURL} for the given page urls */
function readFavicons(app, urls) {
  let DatabaseSync;
  try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) { return {}; }
  const want = new Set(urls.map(normUrl)), wantHost = new Set(urls.map(hostOf).filter(Boolean));
  const best = {}; // key -> {w, img}
  for (const p of profiles(app)) {
    const src = path.join(p, 'Favicons');
    if (!fs.existsSync(src)) continue;
    const tmp = path.join(os.tmpdir(), `3zt-fav-${process.pid}-${Date.now()}.db`);
    let db;
    try {
      fs.copyFileSync(src, tmp);
      db = new DatabaseSync(tmp, { readOnly: true });
      const rows = db.prepare(`SELECT m.page_url AS page, b.image_data AS img, b.width AS w
        FROM icon_mapping m JOIN favicon_bitmaps b ON b.icon_id = m.icon_id WHERE b.image_data IS NOT NULL`).all();
      for (const r of rows) {
        if (!r.img || !r.page) continue;
        const keys = [];
        const n = normUrl(r.page); if (want.has(n)) keys.push('u:' + n);
        const h = hostOf(r.page); if (wantHost.has(h)) keys.push('h:' + h);
        for (const k of keys) {
          const w = r.w || 16;
          // prefer the biggest icon up to 64px (crisp at our size, small to store)
          const score = w <= 64 ? w : 64 - (w - 64) / 100;
          if (!best[k] || score > best[k].score) best[k] = { score, img: Buffer.from(r.img) };
        }
      }
    } catch (e) { /* locked or unknown schema: skip this profile */ }
    finally { try { db && db.close(); } catch (e) {} try { fs.unlinkSync(tmp); } catch (e) {} }
  }
  const out = {};
  for (const k in best) out[k] = 'data:image/png;base64,' + best[k].img.toString('base64');
  return out;
}

/* ---------------- LevelDB (read-only, enough to find one key) ---------------- */
function varint(b, p) { let r = 0, s = 0, x; do { x = b[p++]; r += (x & 0x7f) * 2 ** s; s += 7; } while (x & 0x80 && p < b.length); return [r, p]; }
function snappy(buf) {
  let [len, pos] = varint(buf, 0);
  const out = Buffer.alloc(len); let op = 0;
  while (pos < buf.length && op < len) {
    const tag = buf[pos++], t = tag & 3;
    if (t === 0) {
      let l = tag >> 2;
      if (l >= 60) { const n = l - 59; l = 0; for (let i = 0; i < n; i++) l += buf[pos++] * 2 ** (8 * i); }
      l += 1; buf.copy(out, op, pos, pos + l); pos += l; op += l;
    } else {
      let l, off;
      if (t === 1) { l = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | buf[pos++]; }
      else if (t === 2) { l = (tag >> 2) + 1; off = buf[pos] | (buf[pos + 1] << 8); pos += 2; }
      else { l = (tag >> 2) + 1; off = buf.readUInt32LE(pos); pos += 4; }
      for (let i = 0; i < l; i++, op++) out[op] = out[op - off];
    }
  }
  return out;
}
function sstBlock(file, off, size) { const raw = file.subarray(off, off + size); return file[off + size] === 1 ? snappy(raw) : raw; }
function blockEntries(block, cb) {
  const n = block.readUInt32LE(block.length - 4), end = block.length - 4 - 4 * n;
  let p = 0, key = Buffer.alloc(0);
  while (p < end) {
    let sh, ns, vl;
    [sh, p] = varint(block, p); [ns, p] = varint(block, p); [vl, p] = varint(block, p);
    key = Buffer.concat([key.subarray(0, sh), block.subarray(p, p + ns)]); p += ns;
    cb(key, block.subarray(p, p + vl)); p += vl;
  }
}
function sstEntries(file, cb) {
  const f = file.subarray(file.length - 48);
  let p = 0, mo, ms, io, is;
  [mo, p] = varint(f, p); [ms, p] = varint(f, p); [io, p] = varint(f, p); [is, p] = varint(f, p);
  blockEntries(sstBlock(file, io, is), (k, v) => {
    let q, o, s; [o, q] = varint(v, 0); [s, q] = varint(v, q);
    try { blockEntries(sstBlock(file, o, s), (key, val) => {
      if (key.length < 8) return;
      const trailer = key.readBigUInt64LE(key.length - 8);
      if ((trailer & 0xffn) !== 1n) return;               // 1 = value, 0 = deletion
      cb(key.subarray(0, key.length - 8), val, Number(trailer >> 8n));
    }); } catch (e) {}
  });
}
function logEntries(file, cb) {
  const B = 32768; let pending = null;
  for (let off = 0; off + 7 <= file.length;) {
    const blockLeft = B - (off % B);
    if (blockLeft < 7) { off += blockLeft; continue; }
    const len = file.readUInt16LE(off + 4), type = file[off + 6];
    const data = file.subarray(off + 7, off + 7 + len); off += 7 + len;
    if (type === 0 && len === 0) continue;
    if (type === 1) pending = [data];
    else if (type === 2) { pending = [data]; continue; }
    else if (type === 3) { if (pending) pending.push(data); continue; }
    else if (type === 4) { if (!pending) continue; pending.push(data); }
    else continue;
    const batch = Buffer.concat(pending); pending = null;
    if (batch.length < 12) continue;
    let seq = Number(batch.readBigUInt64LE(0)), p = 12;
    try {
      while (p < batch.length) {
        const tag = batch[p++]; let kl, vl;
        [kl, p] = varint(batch, p); const key = batch.subarray(p, p + kl); p += kl;
        if (tag === 1) { [vl, p] = varint(batch, p); const val = batch.subarray(p, p + vl); p += vl; cb(key, val, seq); }
        seq++;
      }
    } catch (e) {}
  }
}
/* Chromium localStorage value: first byte 0 = UTF-16LE, 1 = 8-bit (UTF-8 in current Chrome, Latin-1 in old ones) */
const lsValue = v => {
  if (v[0] === 0) return v.subarray(1).toString('utf16le');
  try { return new TextDecoder('utf-8', { fatal: true }).decode(v.subarray(1)); } catch (e) { return v.subarray(1).toString('latin1'); }
};

/* Find the Black Chrome / Zeus new tab settings: key "_chrome-extension://<id>\0\1ntp" */
function readNewtabSettings(app) {
  let best = null;
  for (const p of profiles(app)) {
    const dir = path.join(p, 'Local Storage', 'leveldb');
    let files = [];
    try { files = fs.readdirSync(dir).filter(n => /\.(log|ldb)$/.test(n)); } catch (e) { continue; }
    const take = (key, val, seq) => {
      const ks = key.toString('latin1');
      const m = /^_chrome-extension:\/\/([a-p]{32})\u0000\u0001ntp$/.exec(ks);
      if (!m) return;
      try {
        const s = JSON.parse(lsValue(val));
        if (!s || typeof s !== 'object' || !('clockFont' in s || 'theme' in s)) return;
        if (!best || seq > best.seq) best = { seq, settings: s, extId: m[1], profile: p };
      } catch (e) {}
    };
    for (const n of files) {
      try {
        const buf = fs.readFileSync(path.join(dir, n));
        if (n.endsWith('.log')) logEntries(buf, take); else sstEntries(buf, take);
      } catch (e) {}
    }
  }
  return best;
}

/* The uploaded font / background live as plain files in IndexedDB's blob folder */
function sniff(b) {
  if (b.length < 12) return null;
  const s4 = b.subarray(0, 4).toString('latin1');
  if (s4 === 'wOFF') return { kind: 'font', type: 'font/woff' };
  if (s4 === 'wOF2') return { kind: 'font', type: 'font/woff2' };
  if (s4 === 'OTTO') return { kind: 'font', type: 'font/otf' };
  if (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) return { kind: 'font', type: 'font/ttf' };
  if (b.subarray(4, 8).toString('latin1') === 'ftyp') return { kind: 'bg', type: 'video/mp4' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'bg', type: 'video/webm' };
  if (b[0] === 0x89 && s4.slice(1) === 'PNG') return { kind: 'bg', type: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8) return { kind: 'bg', type: 'image/jpeg' };
  if (s4 === 'GIF8') return { kind: 'bg', type: 'image/gif' };
  if (s4 === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { kind: 'bg', type: 'image/webp' };
  return null;
}
function readNewtabBlobs(profileDir, extId) {
  const dir = path.join(profileDir, 'IndexedDB', `chrome-extension_${extId}_0.indexeddb.blob`);
  const found = {};
  (function walk(d, depth) {
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of list) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (depth < 4) walk(f, depth + 1); continue; }
      try {
        const st = fs.statSync(f); if (st.size > 300 * 1024 * 1024) continue;
        const fd = fs.openSync(f, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
        const t = sniff(head); if (!t) continue;
        if (!found[t.kind] || st.mtimeMs > found[t.kind].mtime) found[t.kind] = { file: f, type: t.type, mtime: st.mtimeMs, size: st.size };
      } catch (e) {}
    }
  })(dir, 0);
  return found;
}

module.exports = { readBookmarksBar, readFavicons, readNewtabSettings, readNewtabBlobs, normUrl, hostOf };
