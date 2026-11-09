'use strict';
/*
 * Built-in download manager (replaces Free Download Manager):
 *  - asks where to save every file (Windows "Save as" window, starts in the last folder used)
 *  - several connections per file (Chromium parallel downloading, switched on in main.js)
 *  - pause / resume / cancel / retry, resume after a restart, speed and time left
 *  - a list that survives restarts (downloads.json)
 */
const fs = require('fs');
const path = require('path');

class DownloadManager {
  constructor({ app, store, settings, notify }) {
    this.app = app;
    this.store = store;               // makeStore('downloads.json', [])
    this.settings = settings;
    this.notify = notify;             // (rec, event) => void   event: 'start' | 'update' | 'done'
    this.live = new Map();            // id -> Electron DownloadItem
    this.speed = new Map();           // id -> { t, b, v }
    this.seq = Date.now();
    this.session = [];                // ids downloaded since the browser opened (the bar's download list)
    // anything that was running when the browser closed can be resumed
    this.store.data = this.store.data.filter(Boolean);   // (private downloads are saved as null)
    for (const r of this.store.data) if (r.state === 'progressing' || r.state === 'paused') r.state = 'interrupted';
  }

  list() { return this.store.data; }
  sessionList() { return this.session.map(id => this.get(id)).filter(Boolean); }
  get(id) { return this.store.data.find(r => r.id === id) || null; }
  activeCount() { return [...this.live.values()].filter(i => i.getState() === 'progressing').length; }

  // called from session 'will-download'
  handle(item, opts = {}) {
    const resumed = opts.resumeId && this.get(opts.resumeId);
    const rec = resumed || { id: String(++this.seq), added: Date.now() };
    Object.assign(rec, {
      url: item.getURL(), urlChain: item.getURLChain(), name: (resumed && rec.name) || pickName(item, opts.nameHint),
      mime: item.getMimeType(), total: item.getTotalBytes(), received: item.getReceivedBytes(),
      state: 'progressing', paused: false, startTime: item.getStartTime ? item.getStartTime() : Date.now() / 1000
    });
    // private window: the file is saved, but the list entry is never written to disk and goes with the window
    if (opts.partition && !resumed) Object.defineProperties(rec, { partition: { value: opts.partition }, toJSON: { value: () => null } });
    if (resumed && resumed.path) item.setSavePath(resumed.path);
    else {
      const dir = this.folder();
      if (this.settings.data.dlAsk !== false && !opts.silent) {
        // the normal Windows save window, opened by Chromium itself (doesn't block the browser)
        item.setSaveDialogOptions({ title: this.T('وين تبي تحفظ الملف؟', 'Where do you want to save the file?'), defaultPath: path.join(dir, rec.name) });
      } else {
        item.setSavePath(uniquePath(path.join(dir, rec.name)));
      }
    }
    if (!resumed) this.store.data.unshift(rec);
    this.session = [rec.id, ...this.session.filter(x => x !== rec.id)];
    if (this.store.data.length > 300) this.store.data.length = 300;
    this.live.set(rec.id, item);
    this.speed.set(rec.id, { t: Date.now(), b: rec.received, v: 0 });

    let announced = false, lastSave = 0;
    item.on('updated', (e, state) => {
      const sp = item.getSavePath();
      if (sp && sp !== rec.path) {
        rec.path = sp; rec.name = path.basename(sp);
        // remember the folder chosen in the save window for next time
        if (this.settings.data.dlAsk !== false) { this.settings.data.dlDir = path.dirname(sp); this.settings.save(); }
      }
      if (!rec.path) return;             // still waiting in the save window
      rec.received = item.getReceivedBytes(); rec.total = item.getTotalBytes();
      rec.paused = item.isPaused(); rec.state = state === 'interrupted' ? 'interrupted' : 'progressing';
      rec.canResume = item.canResume();
      rec.etag = item.getETag(); rec.lastModified = item.getLastModifiedTime();
      const s = this.speed.get(rec.id), now = Date.now();
      if (s && now - s.t >= 700) { const v = (rec.received - s.b) / ((now - s.t) / 1000); s.v = s.v ? s.v * 0.6 + v * 0.4 : v; s.t = now; s.b = rec.received; }
      rec.speed = rec.paused ? 0 : Math.max(0, Math.round((s && s.v) || 0));
      if (!announced) { announced = true; this.notify(rec, 'start'); }
      this.notify(rec, 'update');
      if (now - lastSave > 3000) { lastSave = now; this.store.save(); }
    });
    item.once('done', (e, state) => {
      this.live.delete(rec.id); this.speed.delete(rec.id);
      rec.received = item.getReceivedBytes(); rec.total = item.getTotalBytes() || rec.received;
      rec.speed = 0; rec.paused = false; rec.end = Date.now();
      rec.state = state;                                  // completed | cancelled | interrupted
      if (!rec.path) { this.remove(rec.id); return; }      // closed the save window: nothing was downloaded
      if (state === 'interrupted') { rec.canResume = item.canResume(); rec.etag = item.getETag(); rec.lastModified = item.getLastModifiedTime(); }
      this.store.save();
      this.notify(rec, 'done');
    });
    return rec;
  }

  folder() {
    const d = this.settings.data.dlDir;
    try { if (d && fs.statSync(d).isDirectory()) return d; } catch (e) {}
    return this.app.getPath('downloads');
  }

  action(id, cmd, ses) {
    const rec = this.get(id); if (!rec) return false;
    const item = this.live.get(id);
    switch (cmd) {
      case 'pause': if (item && !item.isPaused()) item.pause(); break;
      case 'resume':
        if (item) { if (item.canResume()) item.resume(); }
        else if (rec.state === 'interrupted') this.resumeLater(rec, ses);
        break;
      case 'cancel': if (item) item.cancel(); else if (rec.state === 'interrupted') rec.state = 'cancelled'; break;
      case 'retry': if (!item) { this.remove(id); ses.downloadURL(rec.url); } break;
      case 'remove': if (item) item.cancel(); this.remove(id); break;
      case 'delete':
        if (item) item.cancel();
        if (rec.path && rec.state === 'completed') { try { require('electron').shell.trashItem(rec.path); } catch (e) {} }
        this.remove(id); break;
    }
    this.store.save();
    return true;
  }
  // continue a download that stopped (also after restarting the browser)
  resumeLater(rec, ses) {
    let offset = 0; try { offset = fs.statSync(rec.path).size; } catch (e) {}
    if (!rec.path || !offset || !rec.urlChain || !rec.urlChain.length) { ses.downloadURL(rec.url); this.remove(rec.id); return; }
    this.pendingResume = rec.id;
    ses.createInterruptedDownload({
      path: rec.path, urlChain: rec.urlChain, mimeType: rec.mime || '', offset, length: rec.total || 0,
      lastModified: rec.lastModified || '', eTag: rec.etag || '', startTime: rec.startTime || 0
    });
  }
  takeResume() { const id = this.pendingResume; this.pendingResume = null; return id; }

  /* a file made by the built-in media downloader: listed like any finished download */
  addFile({ name, path: p, url, partition }) {
    let size = 0; try { size = fs.statSync(p).size; } catch (e) {}
    const rec = { id: String(++this.seq), added: Date.now(), url: url || '', urlChain: [], name, path: p, mime: '', total: size, received: size, state: 'completed', paused: false, media: true, end: Date.now() };
    if (partition) Object.defineProperties(rec, { partition: { value: partition }, toJSON: { value: () => null } });
    this.store.data.unshift(rec);
    this.session = [rec.id, ...this.session];
    if (this.store.data.length > 300) this.store.data.length = 300;
    this.store.save();
    return rec;
  }
  forgetPartition(part) {
    const gone = new Set(this.store.data.filter(r => r.partition === part).map(r => r.id));
    if (!gone.size) return;
    this.store.data = this.store.data.filter(r => !gone.has(r.id));
    this.session = this.session.filter(id => !gone.has(id));
  }
  remove(id) { const i = this.store.data.findIndex(r => r.id === id); if (i >= 0) this.store.data.splice(i, 1); this.store.save(); }
  clear() { this.store.data = this.store.data.filter(r => this.live.has(r.id)); this.store.save(); }
  T(ar, en) { return this.settings.data.lang === 'en' ? en : ar; }
}

/* the file's name the way Chrome picks it. Electron's item.getFilename() gives up ("download") as soon as the
   name is not plain English (filename*=UTF-8''... or Arabic letters), so the header is read here. */
const MIME_EXT = { 'application/pdf': '.pdf', 'application/zip': '.zip', 'application/x-rar-compressed': '.rar', 'application/vnd.rar': '.rar',
  'application/x-7z-compressed': '.7z', 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'text/plain': '.txt', 'application/json': '.json',
  'application/vnd.android.package-archive': '.apk', 'application/x-msdownload': '.exe', 'application/x-msi': '.msi' };
function nameFromDisposition(cd) {
  if (!cd) return '';
  // filename*=charset'lang'percent-encoded (RFC 5987) wins over filename=
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(cd);
  if (star) {
    const raw = star[2].trim().replace(/^"|"$/g, '');
    try {
      if (/^utf-?8$/i.test(star[1]) || !star[1]) return decodeURIComponent(raw);
      return Buffer.from(unescape(raw), 'latin1').toString('latin1');
    } catch (e) {}
  }
  const m = /(?:^|;)\s*filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]+)/i.exec(cd);
  if (!m) return '';
  let n = (m[2] != null ? m[2].replace(/\\(.)/g, '$1') : m[1]).trim();
  if (/%[0-9a-f]{2}/i.test(n)) { try { n = decodeURIComponent(n); } catch (e) {} }   // some servers percent-encode it
  // UTF-8 bytes that arrived as Latin-1 letters
  if (/[\u00c0-\u00ff][\u0080-\u00bf]/.test(n)) { const u = Buffer.from(n, 'latin1').toString('utf8'); if (!u.includes('\ufffd')) n = u; }
  return n;
}
function nameFromUrl(u) {
  try { const seg = new URL(u).pathname.split('/').filter(Boolean).pop() || ''; return decodeURIComponent(seg); } catch (e) { return ''; }
}
function safeName(n) {
  n = String(n || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 200);
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(n)) n = '_' + n;   // names Windows reserves
  return n;
}
function pickName(item, hint) {
  let n = '';
  try { n = nameFromDisposition(item.getContentDisposition()); } catch (e) {}
  const given = item.getFilename();
  if (!n && hint) n = hint;                 // the page's <a download="name">
  if (!n && given && given !== 'download') n = given;
  if (!n) n = nameFromUrl(item.getURL()) || nameFromUrl((item.getURLChain() || []).slice(-1)[0]) || 'download';
  n = safeName(n) || 'download';
  const ext = MIME_EXT[String(item.getMimeType() || '').split(';')[0].toLowerCase()];
  if (ext && !path.extname(n)) n += ext;
  return n;
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p), ext = path.extname(p), base = path.basename(p, ext);
  let n = 1, q; do q = path.join(dir, `${base} (${n++})${ext}`); while (fs.existsSync(q));
  return q;
}

module.exports = { DownloadManager, nameFromDisposition, pickName, safeName };
