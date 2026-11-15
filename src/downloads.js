'use strict';
/*
 * Built-in download manager (replaces Free Download Manager):
 *  - asks where to save every file (Windows "Save as" window, starts in the last folder used)
 *  - big files (5 MB and more) go to aria2 (src/aria2.js): up to 16 connections per file. Chromium starts every
 *    download and is only stopped once aria2 is really receiving the file, so a link aria2 can't fetch (a form
 *    sent with POST, a one-time link, a site that refuses it) simply carries on in Chromium, nothing lost.
 *    Smaller files, and the fallback: Chromium (parallel downloading, switched on in main.js)
 *  - pause / resume / cancel / retry, resume after a restart, speed and time left
 *  - a list that survives restarts (downloads.json)
 */
const fs = require('fs');
const path = require('path');

class DownloadManager {
  constructor({ app, store, settings, notify, aria = null, log = () => {} }) {
    this.app = app;
    this.aria = aria;                 // Aria2 (src/aria2.js), or null
    this.log = log;
    this.ariaLive = new Map();        // id -> { gid, rec } of a download aria2 is doing (rec kept: a private window's list may be gone)
    this.ariaTimer = null;
    this.store = store;               // makeStore('downloads.json', [])
    this.settings = settings;
    this.notify = notify;             // (rec, event) => void   event: 'start' | 'update' | 'done'
    this.live = new Map();            // id -> Electron DownloadItem
    this.speed = new Map();           // id -> { t, b, v }
    this.seq = Date.now();
    this.session = [];                // ids downloaded since the browser opened (the bar's download list)
    // anything that was running when the browser closed can be resumed
    this.store.data = this.store.data.filter(Boolean);   // (private downloads are saved as null)
    for (const r of this.store.data) { if (r.state === 'progressing' || r.state === 'paused') r.state = 'interrupted'; delete r.handing; }
  }

  list() { return this.store.data; }
  sessionList() { return this.session.map(id => this.get(id)).filter(Boolean); }
  get(id) { return this.store.data.find(r => r.id === id) || null; }
  activeCount() {
    return [...this.live.values()].filter(i => i.getState() === 'progressing').length
      + [...this.ariaLive.values()].filter(x => !x.rec.paused).length;
  }

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
      if ((this.settings.data.dlAsk !== false || opts.ask) && !opts.silent) {
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
      if (rec.engine === 'aria2') return;     // aria2 took it over
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
      if (!rec.handing && this.wantsAria(item, rec, opts)) this.handOff(item, rec, opts);
    });
    item.once('done', (e, state) => {
      if (rec.engine === 'aria2') return;     // the Chromium copy that was stopped after the hand-over
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

  /* ---------- aria2 ---------- */
  wantsAria(item, rec, opts) {
    if (!this.aria || rec.noAria || opts.posted || !opts.ses || this.settings.data.dlEngine === 'chromium') return false;
    if (item.getState() !== 'progressing' || item.isPaused()) return false;
    const chain = item.getURLChain() || [];
    if (!chain.length || !chain.every(u => /^https?:\/\//i.test(u))) return false;
    const total = item.getTotalBytes();
    if (!total || total < 5 * 1024 * 1024) return false;      // small or unknown size (a stream): Chromium
    if (total - item.getReceivedBytes() < 2 * 1024 * 1024) return false;   // almost done anyway
    return this.aria.available();
  }
  ariaOptions(rec, cookie) {
    const header = [];
    if (cookie) header.push('Cookie: ' + cookie);
    if (rec.referrer) header.push('Referer: ' + rec.referrer);
    return {
      dir: path.dirname(rec.part), out: path.basename(rec.part), header, 'user-agent': rec.ua || '',
      split: '16', 'max-connection-per-server': '16', 'min-split-size': '1M',
      'allow-overwrite': 'true', 'auto-file-renaming': 'false', 'max-tries': '5', 'retry-wait': '2',
      'connect-timeout': '15', timeout: '30', 'max-file-not-found': '2'
    };
  }
  async cookieFor(ses, url) {
    try { const l = await ses.cookies.get({ url }); return l.map(c => c.name + '=' + c.value).join('; '); } catch (e) { return ''; }
  }
  // Chromium keeps the download (paused) until aria2 proves it gets the same file
  async handOff(item, rec, opts) {
    rec.handing = true;
    const chain = item.getURLChain(), uri = chain[chain.length - 1] || item.getURL(), total = item.getTotalBytes();
    const back = why => {   // aria2 can't: Chromium carries on
      this.log('download stays in Chromium:', why);
      rec.noAria = true; rec.handing = false;
      try { if (item.getState() === 'progressing' && item.isPaused()) item.resume(); } catch (e) {}
    };
    let gid = null;
    try {
      item.pause();
      await this.aria.start();
      Object.assign(rec, { part: rec.path + '.part', ariaUrl: uri, referrer: /^https?:/i.test(opts.referrer || '') ? opts.referrer : '', ua: opts.ses.getUserAgent() });
      for (const f of [rec.part, rec.part + '.aria2']) { try { fs.unlinkSync(f); } catch (e) {} }   // leftovers of an earlier try
      gid = await this.aria.call('addUri', [uri], this.ariaOptions(rec, await this.cookieFor(opts.ses, uri)));
      for (let i = 0; i < 60; i++) {   // up to 15 s for the first bytes
        await new Promise(r => setTimeout(r, 250));
        if (item.getState() !== 'progressing') { await this.ariaDrop(gid, rec); return back('the Chromium download ended meanwhile'); }
        const s = await this.aria.call('tellStatus', gid, ['status', 'totalLength', 'completedLength', 'errorMessage']);
        if (s.status === 'error' || s.status === 'removed') { await this.ariaDrop(gid, rec); return back('aria2: ' + (s.errorMessage || s.status)); }
        if (+s.totalLength && +s.totalLength !== total) { await this.ariaDrop(gid, rec); return back(`a different file (${s.totalLength} != ${total})`); }
        if (+s.completedLength > 0 || s.status === 'complete') {
          // it works: Chromium's copy goes, aria2 goes on
          rec.engine = 'aria2'; rec.handing = false; rec.canResume = true;
          this.live.delete(rec.id); this.speed.delete(rec.id);
          this.ariaLive.set(rec.id, { gid, rec });
          try { item.cancel(); } catch (e) {}
          this.store.save();
          this.ariaWatch();
          return;
        }
      }
      await this.ariaDrop(gid, rec); back('no data from aria2 in 15 s');
    } catch (e) {
      if (gid) await this.ariaDrop(gid, rec);
      back(e.message);
    }
  }
  async ariaDrop(gid, rec) {
    try { await this.aria.call('forceRemove', gid); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
    try { await this.aria.call('removeDownloadResult', gid); } catch (e) {}
    if (rec && rec.part) for (const f of [rec.part, rec.part + '.aria2']) { try { fs.unlinkSync(f); } catch (e) {} }
  }
  // continue an aria2 download (paused by a restart or a broken connection): its .aria2 file says what is left
  async ariaRestart(rec, ses) {
    try {
      await this.aria.start();
      const gid = await this.aria.call('addUri', [rec.ariaUrl || rec.url], { ...this.ariaOptions(rec, await this.cookieFor(ses, rec.ariaUrl || rec.url)), 'allow-overwrite': 'false', continue: 'true' });
      Object.assign(rec, { state: 'progressing', paused: false, error: '' });
      this.ariaLive.set(rec.id, { gid, rec });
      this.notify(rec, 'update');
      this.ariaWatch();
    } catch (e) { rec.state = 'interrupted'; rec.error = e.message; this.notify(rec, 'done'); }
  }
  ariaWatch() {
    if (this.ariaTimer) return;
    let lastSave = 0;
    this.ariaTimer = setInterval(async () => {
      if (this.ariaBusy) return;
      if (!this.ariaLive.size) { clearInterval(this.ariaTimer); this.ariaTimer = null; return; }
      this.ariaBusy = true;
      try {
        for (const [id, { gid, rec }] of [...this.ariaLive]) {
          let s;
          try { s = await this.aria.call('tellStatus', gid, ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'errorMessage']); }
          catch (e) {   // aria2 is gone (crashed or killed): what it had stays on disk and can be continued
            if (!this.aria.running()) { this.ariaLive.delete(id); Object.assign(rec, { state: 'interrupted', speed: 0, paused: false, end: Date.now() }); this.notify(rec, 'done'); }
            continue;
          }
          rec.total = +s.totalLength || rec.total; rec.received = +s.completedLength;
          rec.paused = s.status === 'paused'; rec.speed = rec.paused ? 0 : +s.downloadSpeed;
          if (s.status === 'complete') {
            this.ariaLive.delete(id);
            try { await this.aria.call('removeDownloadResult', gid); } catch (e) {}
            try { fs.renameSync(rec.part, rec.path); rec.state = 'completed'; }
            catch (e) { rec.state = 'interrupted'; rec.error = e.message; }
            try { fs.unlinkSync(rec.part + '.aria2'); } catch (e) {}
            Object.assign(rec, { speed: 0, paused: false, end: Date.now() });
            this.store.save(); this.notify(rec, 'done');
          } else if (s.status === 'error' || s.status === 'removed') {
            this.ariaLive.delete(id);
            try { await this.aria.call('removeDownloadResult', gid); } catch (e) {}
            if (s.status === 'error') { Object.assign(rec, { state: 'interrupted', canResume: true, error: s.errorMessage || '', speed: 0, paused: false, end: Date.now() }); this.store.save(); this.notify(rec, 'done'); }
          } else this.notify(rec, 'update');
        }
        if (Date.now() - lastSave > 3000) { lastSave = Date.now(); this.store.save(); }
      } finally { this.ariaBusy = false; }
      if (!this.ariaLive.size && this.aria) { clearInterval(this.ariaTimer); this.ariaTimer = null; }
    }, 700);
  }
  async ariaAction(rec, cmd, ses) {
    const gid = (this.ariaLive.get(rec.id) || {}).gid;
    const dropFiles = () => { for (const f of [rec.part, rec.part + '.aria2']) { try { fs.unlinkSync(f); } catch (e) {} } };
    switch (cmd) {
      case 'pause': if (gid) { try { await this.aria.call('forcePause', gid); rec.paused = true; rec.speed = 0; } catch (e) {} } break;
      case 'resume':
        if (gid) { try { await this.aria.call('unpause', gid); rec.paused = false; } catch (e) {} }
        else if (rec.state === 'interrupted') await this.ariaRestart(rec, ses);
        break;
      case 'cancel': case 'remove': case 'delete':
        if (gid) { this.ariaLive.delete(rec.id); await this.ariaDrop(gid, rec); }
        if (rec.state !== 'completed') dropFiles();
        if (cmd === 'cancel') { if (rec.state !== 'completed') Object.assign(rec, { state: 'cancelled', speed: 0, paused: false, end: Date.now() }); }
        else {
          if (cmd === 'delete' && rec.path && rec.state === 'completed') { try { require('electron').shell.trashItem(rec.path); } catch (e) {} }
          this.remove(rec.id);
        }
        break;
      case 'retry': if (!gid) { dropFiles(); this.remove(rec.id); ses.downloadURL(rec.url); } break;
    }
    this.store.save();
    this.notify(rec, 'refresh');
    return true;
  }
  ariaRunning() { return !!(this.aria && this.aria.running()); }
  stopAll() { return this.aria ? this.aria.shutdown() : Promise.resolve(); }

  folder() {
    const d = this.settings.data.dlDir;
    try { if (d && fs.statSync(d).isDirectory()) return d; } catch (e) {}
    return this.app.getPath('downloads');
  }

  action(id, cmd, ses) {
    const rec = this.get(id); if (!rec) return false;
    if (rec.engine === 'aria2' && this.aria) { this.ariaAction(rec, cmd, ses); return true; }
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
  // no path characters, and no invisible direction marks (they can disguise "invoice‮fdp.exe" as a PDF)
  n = String(n || '').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\u061c\ufeff]/g, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 200);
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
