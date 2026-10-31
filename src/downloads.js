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
      url: item.getURL(), urlChain: item.getURLChain(), name: item.getFilename() || rec.name || 'download',
      mime: item.getMimeType(), total: item.getTotalBytes(), received: item.getReceivedBytes(),
      state: 'progressing', paused: false, startTime: item.getStartTime ? item.getStartTime() : Date.now() / 1000
    });
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

  remove(id) { const i = this.store.data.findIndex(r => r.id === id); if (i >= 0) this.store.data.splice(i, 1); this.store.save(); }
  clear() { this.store.data = this.store.data.filter(r => this.live.has(r.id)); this.store.save(); }
  T(ar, en) { return this.settings.data.lang === 'en' ? en : ar; }
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const dir = path.dirname(p), ext = path.extname(p), base = path.basename(p, ext);
  let n = 1, q; do q = path.join(dir, `${base} (${n++})${ext}`); while (fs.existsSync(q));
  return q;
}

module.exports = { DownloadManager };
