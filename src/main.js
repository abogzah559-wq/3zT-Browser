'use strict';
/*
 * 3zT - main process
 * Every window is a frameless BaseWindow. Each tab is a WebContentsView; the floating
 * toolbar (tabs + address bar) is a transparent WebContentsView laid on top of the active tab.
 * Tabs can be dragged out into a new window and dropped back onto another window.
 */
const {
  app, BaseWindow, BrowserWindow, WebContentsView, ipcMain, Menu, session, dialog,
  screen, net, shell, clipboard, nativeImage, safeStorage, protocol, webContents, desktopCapturer, nativeTheme
} = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const CI = require('./chrome-import');
const { AdBlocker } = require('./adblock');
const EXT = require('./ext-import');
const PW = require('./passwords');
const FEAT = require('./features');
const { DownloadManager } = require('./downloads');
const UPD = require('./updater');
const PERM = require('./permissions');
const { knownMediaPage } = require('./media/detect');
const { site: siteOf } = require('./domains');

// the app is called "3zT"; its profile folder keeps the older name so nothing is lost after updating
app.setPath('userData', path.join(app.getPath('appData'), '3zT Browser'));
app.setName('3zT');
// an update is being installed right now: open again by itself as soon as it is done
if (UPD.waitIfInstalling()) process.exit(0);
if (process.platform === 'win32') app.setAppUserModelId('com.3zo.3ztbrowser');

/* settings that must be known before the app is ready */
const early = (() => { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')); } catch (e) { return {}; } })();
if (early.hwAccel === false) app.disableHardwareAcceleration();

/* ---------- lighter Chromium ---------- */
app.commandLine.appendSwitch('disable-features', ['MediaRouter', 'OptimizationHints', 'FedCm', 'WebIdentityDigitalCredentials'].join(','));
app.commandLine.appendSwitch('disable-background-networking');   // no hidden Chromium background downloads/pings
// no white anywhere: sites that have a dark design use it, the rest are darkened by Chromium itself
// (smart inversion: text and backgrounds are flipped, photos are kept as they are)
const DARK_PAGES = early.darkPages !== false;
app.commandLine.appendSwitch('enable-features', [
  'ParallelDownloading',                       // every download over several connections (like a download manager)
].join(','));
if (DARK_PAGES) app.commandLine.appendSwitch('blink-settings', 'forceDarkModeEnabled=true');   // Chromium's own "dark mode for web contents"
const PAGE_BG = DARK_PAGES ? '#18181c' : '#ffffff';   // what shows while a page is still loading
const FAST = early.perfMode === 'fast';   // "very fast browsing": speed first, more RAM/CPU is fine
if (FAST) {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');          // background tabs keep full speed
  app.commandLine.appendSwitch('ignore-gpu-blocklist');                    // use the graphics card even if Chromium is unsure about it
  app.commandLine.appendSwitch('num-raster-threads', '4');
}
if (early.hwAccel !== false) {
  // GPU work like Chrome: rasterize pages and decode video on the graphics card
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
}

/* a plain Chrome user agent (no "Electron/x" token) so sites treat us like Chrome */
(() => {
  const major = (process.versions.chrome || '140').split('.')[0];
  const plat = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : 'X11; Linux x86_64';
  app.userAgentFallback = `Mozilla/5.0 (${plat}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
})();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

/* never block the browser with an error box: log it (console + logs/3zt.log, kept small) and keep going */
const LOG_FILE = path.join(app.getPath('userData'), 'logs', '3zt.log');
function logError(kind, err) {
  const text = `${new Date().toISOString()} ${kind} ${(err && err.stack) || err}\n`;
  console.error('[3zT]', kind, (err && err.stack) || err);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    try { if (fs.statSync(LOG_FILE).size > 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old'); } catch (e) {}
    fs.appendFileSync(LOG_FILE, text);
  } catch (e) {}
}
process.on('uncaughtException', err => logError('uncaught', err));
process.on('unhandledRejection', err => logError('unhandled', err));

// files that built-in YouTube features load into the page (must be allowed past the site's CSP, like an extension's files)
protocol.registerSchemesAsPrivileged([{ scheme: 'zeus-res', privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true, corsEnabled: true } }]);

/* ---------- paths ---------- */
const SRC = __dirname;
const NEWTAB_FILE = path.join(SRC, 'newtab', 'newtab.html');
const HISTORY_FILE = path.join(SRC, 'newtab', 'history.html');
const TASKS_FILE = path.join(SRC, 'newtab', 'tasks.html');
const PASSWORDS_FILE = path.join(SRC, 'newtab', 'passwords.html');
const SETTINGS_FILE = path.join(SRC, 'newtab', 'settings.html');
const DOWNLOADS_FILE = path.join(SRC, 'newtab', 'downloads.html');
const MEDIA_FILE = path.join(SRC, 'newtab', 'media.html');
const NEWTAB_URL = pathToFileURL(NEWTAB_FILE).href;
const HISTORY_URL = pathToFileURL(HISTORY_FILE).href;
const TASKS_URL = pathToFileURL(TASKS_FILE).href;
const PASSWORDS_URL = pathToFileURL(PASSWORDS_FILE).href;
const SETTINGS_URL = pathToFileURL(SETTINGS_FILE).href;
const DOWNLOADS_URL = pathToFileURL(DOWNLOADS_FILE).href;
const UI_FILE = path.join(SRC, 'ui', 'toolbar.html');
const PRELOAD_UI = path.join(SRC, 'preload-ui.js');
const PRELOAD_TAB = path.join(SRC, 'preload-newtab.js');
const ICON = path.join(SRC, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const ICON_OPT = fs.existsSync(ICON) ? { icon: ICON } : {};

const STRIP = 56;
const same = (u, base) => !!u && (u === base || u.startsWith(base + '#') || u.startsWith(base + '?'));
const isNewtab = u => !u || same(u, NEWTAB_URL);
const isHistory = u => same(u, HISTORY_URL);
const isTasks = u => same(u, TASKS_URL);
const isPasswords = u => same(u, PASSWORDS_URL);
const isSettings = u => same(u, SETTINGS_URL);
const isDownloads = u => same(u, DOWNLOADS_URL);
const isInternal = u => isNewtab(u) || isHistory(u) || isTasks(u) || isPasswords(u) || isSettings(u) || isDownloads(u);
const shownUrl = u => (isNewtab(u) ? '' : isHistory(u) ? '3zt://history' : isTasks(u) ? '3zt://tasks' : isPasswords(u) ? '3zt://passwords' : isSettings(u) ? '3zt://settings' : isDownloads(u) ? '3zt://downloads' : u);

/* ---------- tiny JSON stores (debounced, atomic save) ---------- */
function makeStore(name, def) {
  const f = () => path.join(app.getPath('userData'), name);
  let data;
  try { data = JSON.parse(fs.readFileSync(f(), 'utf8')); } catch (e) { data = null; }
  if (Array.isArray(def)) { if (!Array.isArray(data)) data = []; }
  else data = Object.assign(JSON.parse(JSON.stringify(def)), data && typeof data === 'object' ? data : {});
  let t = null;
  const flush = () => {
    clearTimeout(t); t = null;
    try { fs.writeFileSync(f() + '.tmp', JSON.stringify(data)); fs.renameSync(f() + '.tmp', f()); }
    catch (e) { console.error('save failed', name, e.message); }
  };
  return { get data() { return data; }, set data(v) { data = v; this.save(); }, save() { if (!t) t = setTimeout(flush, 800); }, flush };
}
let settings, bookmarks, history, sessionStore, favStore, dl;
let adblock = null;
let passwords = null;
const stores = () => [settings, bookmarks, history, sessionStore, favStore].filter(Boolean);

const T = (ar, en) => (settings && settings.data.lang === 'en' ? en : ar);

/* ---------- windows + tabs ---------- */
const wins = [];
let lastFocused = null;
let nextTabId = 1, nextWinId = 1;
let quitting = false;
const closedStack = [];
const allTabs = () => wins.flatMap(w => w.tabs);
const winOfUi = wc => wins.find(w => w.ui.webContents === wc);
const tabOfWc = wc => allTabs().find(t => t.view && t.view.webContents === wc);
const focusedWin = () => wins.find(w => !w.win.isDestroyed() && w.win.isFocused()) || lastFocused || wins[0];

/* the strip behind the bar wears the colour of the site's top edge, sampled once per site and then kept */
const tintCache = new Map();   // host -> [r,g,b]

class Win {
  constructor(opts = {}) {
    this.id = nextWinId++;
    this.private = !!opts.private;
    this.partition = this.private ? `incog-${this.id}` : undefined;
    this.tabs = [];
    this.activeId = null;
    this.uiExpanded = false;
    this.stripH = 56;
    this.htmlFs = false;
    this.stateTimer = null;
    this.tint = null;          // colour last sent to the bar

    const b = opts.bounds && onScreen(opts.bounds) ? opts.bounds : null;
    this.win = new BaseWindow(Object.assign({
      width: 1280, height: 800, minWidth: 560, minHeight: 320,
      frame: false, backgroundColor: '#000000', show: false, title: '3zT'
    }, b || {}, ICON_OPT));

    this.ui = new WebContentsView({
      webPreferences: { preload: PRELOAD_UI, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, partition: 'zeus-ui' }
    });
    this.ui.setBackgroundColor('#00000000');
    this.win.contentView.addChildView(this.ui);
    this.ui.webContents.loadFile(UI_FILE);
    this.ui.webContents.on('before-input-event', (e, input) => { if (handleKey(this, input)) e.preventDefault(); });
    this.ui.webContents.once('did-finish-load', () => {
      if (opts.maximized) this.win.maximize();
      if (opts.show !== false) this.win.show();
      if (process.env.ZEUS_TIMING) console.log('[timing] window shown', Math.round(performance.now()), 'ms');
      this.pushState();
      const t = this.active(); if (t && isNewtab(t.url)) this.focusAddress();
    });

    const w = this.win;
    w.on('focus', () => { lastFocused = this; });
    w.on('blur', () => { setTimeout(() => { if (!BrowserWindow.getFocusedWindow() && !wins.some(x => !x.win.isDestroyed() && x.win.isFocused())) closeExtPopup(); }, 150); });
    for (const ev of ['move', 'minimize']) w.on(ev, () => closeExtPopup());
    w.on('resize', () => this.layout());
    // moved by its bar (Windows' own move): a one-tab window dropped on another window's tabs joins it
    w.on('will-move', () => {
      if (tabDrag || this.tabs.length !== 1) return;
      const p = screen.getCursorScreenPoint();
      const hit = snapZone(p) ? null : stripHit(p, this);
      if (hit !== this.nativeHover) { if (this.nativeHover && !this.nativeHover.ui.webContents.isDestroyed()) this.nativeHover.ui.webContents.send('drop-hint', null); this.nativeHover = hit; }
      if (hit) hit.ui.webContents.send('drop-hint', p.x - hit.win.getContentBounds().x);
    });
    w.on('moved', async () => {
      const target = this.nativeHover; this.nativeHover = null;
      if (!target || target.win.isDestroyed()) return;
      target.ui.webContents.send('drop-hint', null);
      const p = screen.getCursorScreenPoint();
      if (stripHit(p, this) !== target || this.tabs.length !== 1) return;
      const t = this.tabs[0];
      let index = target.tabs.length;
      try { index = await target.ui.webContents.executeJavaScript(`tabIndexAt(${p.x - target.win.getContentBounds().x})`); } catch (err) {}
      this.releaseTab(t); target.adoptTab(t, index); this.win.close(); target.win.focus(); saveSessionSoon();
    });
    for (const ev of ['maximize', 'unmaximize', 'enter-full-screen']) w.on(ev, () => { this.layout(); this.pushState(); });
    w.on('leave-full-screen', () => { this.htmlFs = false; this.layout(); this.pushState(); });
    w.on('close', () => {
      if (!quitting && wins.length === 1) { quitting = true; saveSession(); }
    });
    w.on('closed', () => {
      clearTimeout(this.stateTimer); this.stateTimer = null;
      for (const q of (this.permQueue || []).slice()) { clearTimeout(q.timer); q.resolve({ choice: 'ignore', pick: null }); }
      this.permQueue = [];
      // private session: its permission answers, downloads list and media jobs go with its last window
      if (this.private && !wins.some(x => x !== this && x.partition === this.partition)) {
        if (perms) perms.forgetPartition(this.partition);
        if (dl) dl.forgetPartition(this.partition);
        if (media) media.forgetPartition(this.partition);
        const mw = mediaWins.get(this.partition); if (mw && !mw.isDestroyed()) mw.close();   // its downloader window ends with the session
      }
      for (const t of this.tabs) if (t.view) destroyView(t.view);
      this.tabs = [];
      destroyView(this.ui);   // a closed BaseWindow does not free its views by itself
      const i = wins.indexOf(this); if (i >= 0) wins.splice(i, 1);
      for (const x of wins) x.pushState();   // window count changed
      if (lastFocused === this) lastFocused = wins[0] || null;
      if (!quitting) saveSessionSoon();
      if (!wins.length && ![...mediaWins.values()].some(m => !m.isDestroyed())) app.quit();
      // the normal downloader window still open keeps the app (and its downloads) going; the next browser window
      // opened from the shortcut must save its session again
      else if (!wins.length) quitting = false;
    });
    wins.push(this);
    for (const x of wins) if (x !== this) x.pushState();
    lastFocused = this;
  }

  active() { return this.tabs.find(t => t.id === this.activeId) || null; }
  tab(id) { return this.tabs.find(t => t.id === id) || null; }

  layout() {
    const w = this.win; if (w.isDestroyed() || this.ui.webContents.isDestroyed()) return;
    const { width, height } = w.getContentBounds();
    const t = this.active();
    if (t && t.view) {
      const flush = this.htmlFs || isNewtab(t.url);
      const top = this.stripH;
      t.view.setBounds(flush ? { x: 0, y: 0, width, height } : { x: 0, y: top, width, height: Math.max(0, height - top) });
    }
    this.ui.setVisible(!this.htmlFs);
    const uh = this.uiExpanded === true ? height : typeof this.uiExpanded === 'number' ? Math.min(height, this.uiExpanded)
      : this.stripH;
    this.ui.setBounds({ x: 0, y: 0, width, height: uh });
  }

  /* colour behind the bar: from the cache, or read once from the page's top edge after it loads */
  applyTint() {
    if (this.ui.webContents.isDestroyed()) return;
    const t = this.active();
    const host = t && !isNewtab(t.url) && /^https?:/i.test(t.url) ? hostOf(t.url) : '';
    const col = host ? tintCache.get(host) : null;
    if (host && !col && !t.loading && !t.tintBusy && t.view) this.sampleTint(t, host);
    const key = col ? col.join(',') : '';
    if (key === (this.tint || '')) return;
    this.tint = key;
    this.ui.webContents.send('tint', col || null);
  }
  async sampleTint(t, host) {
    t.tintBusy = true;
    try {
      await new Promise(r => setTimeout(r, 300));          // let the first paint land
      if (!t.view || t.view.webContents.isDestroyed() || hostOf(t.url) !== host) return;
      const { width } = t.view.getBounds(); if (width < 20) return;
      const img = await t.view.webContents.capturePage({ x: 0, y: 0, width, height: 3 });
      const sz = img.getSize(), bmp = img.toBitmap();      // BGRA
      if (!sz.width || bmp.length < sz.width * 4) return;
      // most common colour along the top row (ignores logos and buttons)
      const cnt = new Map(), row = Math.min(1, sz.height - 1) * sz.width * 4;
      for (let x = 0; x < sz.width; x += 2) {
        const i = row + x * 4, k = ((bmp[i + 2] >> 3) << 10) | ((bmp[i + 1] >> 3) << 5) | (bmp[i] >> 3);
        const c = cnt.get(k); if (c) { c.n++; c.r += bmp[i + 2]; c.g += bmp[i + 1]; c.b += bmp[i]; } else cnt.set(k, { n: 1, r: bmp[i + 2], g: bmp[i + 1], b: bmp[i] });
      }
      let best = null; for (const c of cnt.values()) if (!best || c.n > best.n) best = c;
      if (best && !tintCache.has(host)) tintCache.set(host, [best.r, best.g, best.b].map(v => Math.round(v / best.n)));
    } catch (e) {} finally { t.tintBusy = false; }
    if (!this.win.isDestroyed()) this.applyTint();
  }

  pushState() {
    if (this.stateTimer || this.win.isDestroyed()) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      if (this.win.isDestroyed() || this.ui.webContents.isDestroyed()) return;
      this.applyTint();
      const t = this.active();
      const wc = t && t.view ? t.view.webContents : null;
      const url = t ? t.url : '';
      this.ui.webContents.send('state', {
        winId: this.id, winCount: wins.filter(x => !x.win.isDestroyed() && x.private === this.private).length,
        private: this.private,
        tabs: this.tabs.map(x => ({
          id: x.id,
          title: x.title || (isNewtab(x.url) ? T('تبويب جديد', 'New tab') : isHistory(x.url) ? T('السجل', 'History') : isTasks(x.url) ? T('مدير المهام', 'Task manager') : isPasswords(x.url) ? T('كلمات السر', 'Passwords') : isSettings(x.url) ? T('الإعدادات', 'Settings') : isDownloads(x.url) ? T('التنزيلات', 'Downloads') : shownUrl(x.url)),
          url: shownUrl(x.url), favicon: isInternal(x.url) ? 'app' : (x.favicon || ''),
          loading: !!x.loading, discarded: !!x.discarded, muted: !!x.muted, pinned: !!x.pinned,
          audible: !!(x.view && !x.view.webContents.isDestroyed() && x.view.webContents.isCurrentlyAudible())
        })),
        activeId: this.activeId,
        url: shownUrl(url),
        isNewtab: isNewtab(url),
        isWeb: /^https?:/i.test(url),
        translated: /\.translate\.goog$/i.test(hostOf(url)) || !!(t && t.translateSite && t.translateSite === AdBlocker.site(hostOf(url) || '')),
        loading: !!(t && t.loading),
        canGoBack: !!(wc && wc.navigationHistory.canGoBack()),
        canGoForward: !!(wc && wc.navigationHistory.canGoForward()),
        bookmarked: !!(url && /^https?:/i.test(url) && findBookmark(url)),
        maximized: this.win.isMaximized(),
        fullscreen: this.win.isFullScreen(),
        lang: settings.data.lang,
        memorySaverMin: settings.data.memorySaverMin,
        restoreTabs: settings.data.restoreTabs,
        hwAccel: settings.data.hwAccel !== false,
        hwAccelActive: early.hwAccel !== false,
        zoom: wc ? Math.round(wc.getZoomFactor() * 100) : 100,
        closedCount: closedStack.length,
        adblock: settings.data.adblock !== false,
        adSiteOff: !!(url && /^https?:/i.test(url) && settings.data.adAllow.includes(AdBlocker.site(hostOf(url) || ''))),
        blocked: (t && t.blocked) || 0,
        blockedTotal: settings.data.adBlockedTotal || 0,
        adRules: adblock ? adblock.ruleCount : 0,
        perm: (() => {
          const o = PERM.originOf(url); if (!o || !perms) return null;
          const site = perms.site(o, partOf(t));
          const asked = t && t.permAskedOrigin === o && t.permAsked ? [...t.permAsked] : [];
          return { origin: o, site, asked, denied: t && t.permOrigin === o && t.permDenied ? [...t.permDenied] : [] };
        })(),
        ytAds: settings.data.ytAds !== false,
        media: !!(t && (t.media || t.mediaSeen) && /^https?:/i.test(url)),
        dl: dlSummary(),
        isDefault: isDefaultCache, canDefault: process.platform === 'win32',
        pinned: pinnedExtensions(),
        versions: { app: app.getVersion(), chrome: process.versions.chrome }
      });
    }, 16);
  }

  createTab(url, opts = {}) {
    const tab = {
      id: nextTabId++, view: null, url: url || NEWTAB_URL, title: '', favicon: '', loading: false,
      discarded: false, muted: false, lastActive: Date.now(), win: this
    };
    if (opts.pinned) tab.pinned = true;
    if (opts.discarded) { tab.discarded = true; tab.title = opts.title || ''; tab.favicon = cachedFavicon(tab.url); }
    else if (opts.fromOpener) { tab.openedByPage = true; makeView(tab, opts.fromOpener); }   // Chromium loads it itself (POST, Referer, opener)
    else { makeView(tab); loadInto(tab, tab.url); }
    this.insertTab(tab, opts);
    if (opts.activate !== false) this.activate(tab.id); else this.pushState();
    saveSessionSoon();
    return tab;
  }
  insertTab(tab, opts = {}) {
    let at = this.tabs.length;
    if (typeof opts.index === 'number') at = Math.max(0, Math.min(this.tabs.length, opts.index));
    else if (opts.after) { const i = this.tabs.findIndex(t => t.id === opts.after); if (i >= 0) at = i + 1; }
    // pinned tabs stay together at the start, like Chrome
    const pins = this.tabs.filter(t => t.pinned).length;
    at = tab.pinned ? Math.min(at, pins) : Math.max(at, pins);
    this.tabs.splice(at, 0, tab);
    tab.win = this;
  }

  activate(id) {
    const t = this.tab(id); if (!t) return;
    const prev = this.active();
    if (prev && prev.view && prev !== t) { try { this.win.contentView.removeChildView(prev.view); } catch (e) {} prev.lastActive = Date.now(); }
    this.activeId = id;
    closeExtPopup();
    if (t.discarded || !t.view) { makeView(t); loadInto(t, t.url); }
    this.win.contentView.addChildView(t.view, 0);   // below the toolbar
    t.lastActive = Date.now();
    this.layout();
    if (isNewtab(t.url)) this.focusAddress(); else t.view.webContents.focus();
    this.pushState(); saveSessionSoon();
  }

  /* take a tab out of this window without destroying it (it is moving to another window) */
  releaseTab(tab) {
    const i = this.tabs.indexOf(tab); if (i < 0) return;
    this.tabs.splice(i, 1);
    if (tab.view) { try { this.win.contentView.removeChildView(tab.view); } catch (e) {} }
    if (this.activeId === tab.id) {
      this.activeId = null;
      const next = this.tabs[i] || this.tabs[i - 1];
      if (next) this.activate(next.id);
    }
    this.pushState();
  }
  adoptTab(tab, index) {
    this.insertTab(tab, typeof index === 'number' ? { index } : {});
    this.activate(tab.id);
  }

  closeTab(id, opts = {}) {
    const t = this.tab(id); if (!t) return;
    if (!isInternal(t.url) && !this.private && !opts.forget) { closedStack.push({ url: t.url, title: t.title }); if (closedStack.length > 25) closedStack.shift(); }
    cancelPermissionsOf(t);
    this.releaseTab(t);
    if (t.view) destroyView(t.view);
    if (!this.tabs.length) { this.win.close(); return; }
    saveSessionSoon();
  }

  focusAddress() { if (!this.ui.webContents.isDestroyed()) { this.ui.webContents.focus(); this.ui.webContents.send('focus-address'); } }
}

function onScreen(b) {
  return screen.getAllDisplays().some(d => {
    const a = d.workArea; return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y < a.y + a.height - 40 && b.y + 30 > a.y;
  });
}
function newWindow(opts = {}) {
  const w = new Win(opts);
  if (opts.url !== null) w.createTab(opts.url || NEWTAB_URL);
  return w;
}

/* ---------- links that belong to another program ---------- */
const WEB_SCHEMES = new Set(['http', 'https', 'file', 'about', 'data', 'blob', 'chrome-extension', 'devtools', 'chrome', 'zeus-res', 'ws', 'wss', 'filesystem']);
function isExternalUrl(u) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(u || ''); if (!m) return false;
  const s = m[1].toLowerCase();
  return !WEB_SCHEMES.has(s) && s !== 'javascript' && s !== 'vbscript';
}
const askingExternal = new Set();
async function openExternalAsk(tab, url) {
  const scheme = url.slice(0, url.indexOf(':')).toLowerCase();
  const site = (hostOf(tab.url || '') || '').replace(/^www\./, '') || T('هذي الصفحة', 'This page');
  const key = site + '|' + scheme;
  const allowed = settings.data.extProto || (settings.data.extProto = []);
  if (allowed.includes(key) || scheme === 'mailto') { shell.openExternal(url).catch(() => {}); return; }
  if (askingExternal.has(key)) return; askingExternal.add(key);
  try {
    let name = ''; try { name = (app.getApplicationNameForProtocol(url) || '').replace(/\.exe$/i, ''); } catch (e) {}
    const shown = name || scheme;
    const w = tab.win && !tab.win.win.isDestroyed() ? tab.win.win : undefined;
    const r = await dialog.showMessageBox(w, {
      type: 'question', title: '3zT', buttons: [T(`فتح ${shown}`, `Open ${shown}`), T('إلغاء', 'Cancel')], defaultId: 0, cancelId: 1, noLink: true,
      message: T(`تبي تفتح ${shown}؟`, `Open ${shown}?`),
      detail: T(`${site} يبي يفتح هذا البرنامج.`, `${site} wants to open this application.`),
      checkboxLabel: T(`اسمح لـ ${site} يفتح روابط ${shown} دايماً`, `Always allow ${site} to open ${shown} links`)
    });
    if (r.response !== 0) return;
    if (r.checkboxChecked) { allowed.push(key); settings.save(); }
    await shell.openExternal(url);
  } catch (e) {
    console.warn('[3zT] external link', e && e.message);
  } finally { askingExternal.delete(key); }
}

/* ---------- tab views ---------- */
function destroyView(view) { try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch (e) {} }

/* fromOpener: the options Chromium hands over for a window.open / target=_blank page (keeps its opener and request) */
function makeView(tab, fromOpener) {
  // Chromium already made the page's WebContents (same settings as the opener): the tab adopts it
  const view = fromOpener && fromOpener.webContents ? new WebContentsView({ webContents: fromOpener.webContents }) : new WebContentsView({
    webPreferences: {
      preload: PRELOAD_TAB,            // gives an API only to our own internal pages (checked inside)
      nodeIntegrationInSubFrames: true,   // only so the preload also reaches iframes (passkey fix); Node stays off, sandbox on
      partition: tab.win.partition,
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      plugins: true,                   // built-in PDF viewer
      spellcheck: false, backgroundThrottling: !FAST
    }
  });
  if (tab.win.private) setupSession(view.webContents.session);
  view.setBackgroundColor(isNewtab(tab.url) ? '#000000' : PAGE_BG);
  const wc = view.webContents;
  if (tab.muted) wc.setAudioMuted(true);

  // links for other programs (claude://, mailto:, discord://, steam://...) go to Windows, like in Chrome
  wc.on('will-frame-navigate', d => { if (isExternalUrl(d.url)) { d.preventDefault(); openExternalAsk(tab, d.url); } });
  wc.setWindowOpenHandler(d => {
    if (isExternalUrl(d.url)) { openExternalAsk(tab, d.url); return { action: 'deny' }; }
    // real popups (sign-in windows...) keep their opener; normal "_blank" links become tabs
    if (d.disposition === 'new-window' && d.features) {
      return { action: 'allow', overrideBrowserWindowOptions: Object.assign({ autoHideMenuBar: true, backgroundColor: '#111' }, ICON_OPT) };
    }
    // a new tab made by Chromium itself, like Chrome: the site's exact request (form POST data, Referer)
    // and window.opener are kept. Download sites depend on this; a plain loadURL of the address loses them.
    return {
      action: 'allow', outlivesOpener: true,
      createWindow: options => tab.win.createTab(d.url, { activate: d.disposition !== 'background-tab', after: tab.id, fromOpener: options }).view.webContents
    };
  });

  const upd = () => tab.win.pushState();
  wc.on('did-start-loading', () => { tab.loading = true; upd(); });
  wc.on('did-stop-loading', () => { tab.loading = false; upd(); });
  wc.on('page-title-updated', (e, title) => {
    tab.title = title; upd();
    if (tab.win.private) return;
    const h = history.data; if (h.length && h[h.length - 1].url === tab.url) { h[h.length - 1].title = title; history.save(); }
  });
  wc.on('page-favicon-updated', (e, favs) => {
    const u = favs && favs[0]; if (!u) return;
    if (!tab.favicon) tab.favicon = u;
    upd();
    storeFavicon(tab, u);
  });
  const nav = (e, url, inPage) => {
    if (url && url !== 'about:blank') tab.committed = true;
    if (!inPage) tab.mediaSeen = false;   // a new document: it reports its own videos again
    tab.media = knownMediaPage(url);
    const wasFlush = isNewtab(tab.url);
    tab.url = url;
    view.setBackgroundColor(isNewtab(url) ? '#000000' : PAGE_BG);
    if (isInternal(url)) { tab.favicon = ''; tab.title = ''; }
    else tab.favicon = cachedFavicon(url) || '';
    if (!tab.win.private) addHistory(url, wc.getTitle());
    if (wasFlush !== isNewtab(url) && tab.id === tab.win.activeId) tab.win.layout();
    upd(); saveSessionSoon();
  };
  wc.on('did-navigate', nav);
  wc.on('did-start-navigation', (e, ...rest) => {
    const isMain = e && e.isMainFrame !== undefined ? e.isMainFrame : rest[2];
    const same = e && e.isSameDocument !== undefined ? e.isSameDocument : rest[1];
    if (isMain && !same) { tab.blocked = 0; tab.permDenied = null; cancelPermissionsOf(tab); tab.win.pushState(); }
  });
  wc.on('dom-ready', () => { if (isNewtab(tab.url)) wc.send('strip', tab.win.stripH); tab.siteFontKey = null; applySiteFont(tab); translateOnLoad(tab); });
  wc.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) nav(e, url, true); });
  wc.on('audio-state-changed', upd);
  wc.on('context-menu', (e, p) => contextMenu(tab, p));
  wc.on('input-event', (e, i) => { if (extPopup && (i.type === 'mouseDown' || i.type === 'keyDown')) closeExtPopup(); });
  wc.on('before-input-event', (e, input) => { if (handleKey(tab.win, input)) e.preventDefault(); });
  wc.on('found-in-page', (e, r) => { const w = tab.win; if (w.ui && !w.ui.webContents.isDestroyed()) w.ui.webContents.send('found', { active: r.activeMatchOrdinal, matches: r.matches }); });
  wc.on('enter-html-full-screen', () => { const w = tab.win; w.htmlFs = true; w.win.setFullScreen(true); w.layout(); });
  wc.on('leave-html-full-screen', () => { const w = tab.win; w.htmlFs = false; w.win.setFullScreen(false); w.layout(); });
  wc.on('render-process-gone', (e, d) => { if (d.reason !== 'clean-exit') { tab.title = T('تعطلت الصفحة، حدّثها', 'Page crashed, reload it'); upd(); } });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    tab.title = T('تعذّر فتح الصفحة', 'Could not open page'); upd();
  });
  tab.view = view;
  tab.discarded = false;
  return view;
}

function loadInto(tab, url) {
  const wc = tab.view.webContents;
  tab.view.setBackgroundColor(isNewtab(url) ? '#000000' : PAGE_BG);
  if (isNewtab(url)) wc.loadFile(NEWTAB_FILE).catch(() => {});
  else if (isHistory(url)) wc.loadFile(HISTORY_FILE).catch(() => {});
  else if (isTasks(url)) wc.loadFile(TASKS_FILE).catch(() => {});
  else if (isPasswords(url)) wc.loadFile(PASSWORDS_FILE).catch(() => {});
  else if (isSettings(url)) wc.loadFile(SETTINGS_FILE).catch(() => {});
  else if (isDownloads(url)) wc.loadFile(DOWNLOADS_FILE).catch(() => {});
  else wc.loadURL(url).catch(() => {});
}

/* memory saver: tabs you haven't looked at for a while go to sleep (their RAM is freed) */
function discard(t) {
  if (!t.view || t.id === t.win.activeId) return;
  const wc = t.view.webContents;
  if (wc.isCurrentlyAudible() || wc.isDevToolsOpened()) return;
  destroyView(t.view);
  t.view = null; t.discarded = true; t.loading = false;
  t.win.pushState();
}
setInterval(() => {
  const min = settings && settings.data.memorySaverMin;
  if (!min || FAST) return;   // very fast mode: tabs never sleep, switching is instant
  const limit = Date.now() - min * 60000;
  for (const t of allTabs()) if (t.id !== t.win.activeId && t.view && t.lastActive < limit) discard(t);
}, 30000);

/* ---------- session restore (all normal windows) ---------- */
let sessTimer = null;
function saveSessionSoon() { if (quitting) return; clearTimeout(sessTimer); sessTimer = setTimeout(saveSession, 1000); }
function saveSession() {
  if (!sessionStore) return;
  sessionStore.data = {
    windows: wins.filter(w => !w.private && !w.win.isDestroyed()).map(w => ({
      bounds: w.win.isMaximized() || w.win.isFullScreen() ? (w.win.getNormalBounds ? w.win.getNormalBounds() : w.win.getBounds()) : w.win.getBounds(),
      maximized: w.win.isMaximized(),
      tabs: w.tabs.map(t => ({ url: isNewtab(t.url) ? '' : t.url, title: t.title, pinned: !!t.pinned || undefined })),
      active: Math.max(0, w.tabs.findIndex(t => t.id === w.activeId))
    })),
    // closed tabs survive a restart, so Ctrl+Shift+T still brings them back
    closed: closedStack.slice(-25)
  };
  sessionStore.flush();
}

/* ---------- history ---------- */
function addHistory(url, title) {
  if (!/^https?:/i.test(url)) return;
  const h = history.data;
  if (h.length && h[h.length - 1].url === url) { h[h.length - 1].t = Date.now(); }
  else h.push({ url, title: title || '', t: Date.now() });
  if (h.length > 8000) h.splice(0, h.length - 8000);
  history.save();
}

/* ---------- favicons: Chrome's own icons + icons of pages you visit ---------- */
const normUrl = CI.normUrl;
const hostOf = CI.hostOf;
function cachedFavicon(url) {
  if (!favStore || !/^https?:/i.test(url || '')) return '';
  return favStore.data['u:' + normUrl(url)] || favStore.data['h:' + hostOf(url)] || '';
}
async function storeFavicon(tab, iconUrl) {
  if (tab.win.private || !/^https?:|^data:/i.test(iconUrl) || !/^https?:/i.test(tab.url)) return;
  try {
    let data = iconUrl;
    if (!/^data:/i.test(iconUrl)) {
      const r = await tab.view.webContents.session.fetch(iconUrl);
      if (!r.ok) return;
      const type = (r.headers.get('content-type') || '').split(';')[0].trim() || 'image/x-icon';
      if (!/^image\//i.test(type)) return;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length || buf.length > 150000) return;
      data = `data:${type};base64,${buf.toString('base64')}`;
    }
    favStore.data['u:' + normUrl(tab.url)] = data;
    favStore.data['h:' + hostOf(tab.url)] = data;
    const keys = Object.keys(favStore.data);
    if (keys.length > 1500) for (const k of keys.slice(0, keys.length - 1500)) delete favStore.data[k];
    favStore.save();
    tab.favicon = data; tab.win && tab.win.pushState();
  } catch (e) {}
}
function bookmarkUrls(node = bookmarks.data, out = []) {
  for (const c of node.children || []) { if (c.url) out.push(c.url); if (c.children) bookmarkUrls(c, out); }
  return out;
}
function importChromeFavicons() {
  const got = CI.readFavicons(app, bookmarkUrls());
  Object.assign(favStore.data, got); favStore.save();
  return Object.keys(got).length;
}

/* ---------- bookmarks (one "bar" folder like Chrome's bookmarks bar) ---------- */
function findBookmark(url, node = bookmarks.data) {
  const n = normUrl(url);
  for (const c of node.children || []) {
    if (c.url && normUrl(c.url) === n) return { parent: node, item: c };
    if (c.children) { const r = findBookmark(url, c); if (r) return r; }
  }
  return null;
}
function importChromeBookmarks() {
  const items = CI.readBookmarksBar(app);
  const have = new Set(bookmarkUrls().map(normUrl));
  let added = 0;
  for (const it of items) { if (it.url && have.has(normUrl(it.url))) continue; bookmarks.data.children.push(it); added++; }
  bookmarks.save();
  try { importChromeFavicons(); } catch (e) {}
  return added;
}

/* ---------- Black Chrome look (new tab settings + uploaded font/background) ---------- */
let pendingImport = null;
function prepareNewtabImport() {
  try {
    const r = CI.readNewtabSettings(app);
    if (!r) return false;
    const s = Object.assign({}, r.settings);
    s.shiftX = 0;   // our bar is exactly centered, Chrome's needed an offset
    const blobs = CI.readNewtabBlobs(r.profile, r.extId);
    pendingImport = { settings: s, blobs: {} };
    for (const k of ['font', 'bg']) {
      const b = blobs[k]; if (!b) continue;
      try { pendingImport.blobs[k] = { type: b.type, data: fs.readFileSync(b.file) }; } catch (e) {}
    }
    for (const w of wins) for (const t of w.tabs) if (t.view && isNewtab(t.url)) t.view.webContents.send('import-ready');
    return true;
  } catch (e) { return false; }
}

/* ---------- extensions ---------- */
const extApi = () => session.defaultSession.extensions || session.defaultSession;
async function loadExtensionDir(dir) {
  let d = dir;
  if (!fs.existsSync(path.join(d, 'manifest.json'))) {
    const sub = fs.readdirSync(d).map(n => path.join(d, n)).find(p => fs.existsSync(path.join(p, 'manifest.json')));
    if (!sub) throw new Error('no manifest.json');
    d = sub;
  }
  // websites only: never our new tab / toolbar (file:// pages)
  return extApi().loadExtension(d, { allowFileAccess: false });
}
function extIcon(ext) {
  try {
    const m = ext.manifest || {};
    const icons = m.icons || (m.action && m.action.default_icon) || (m.browser_action && m.browser_action.default_icon) || {};
    const pick = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
    if (!pick) return '';
    const img = nativeImage.createFromPath(path.join(ext.path, pick));
    return img.isEmpty() ? '' : img.resize({ width: 32 }).toDataURL();
  } catch (e) { return ''; }
}
function extInfo(e) {
  const m = e.manifest || {};
  const opt = (m.options_ui && m.options_ui.page) || m.options_page || '';
  const act = m.action || m.browser_action || {};
  return {
    id: e.id, name: e.name, version: e.version, icon: extIcon(e),
    options: opt ? `chrome-extension://${e.id}/${opt.replace(/^\//, '')}` : '',
    popup: act.default_popup ? act.default_popup.replace(/^\//, '') : '',
    pinned: (settings.data.pinnedExt || []).includes(e.id)
  };
}
function listExtensions() { return extApi().getAllExtensions().map(extInfo); }
function pinnedExtensions() {
  const ids = settings.data.pinnedExt || [];
  return ids.map(id => extApi().getExtension(id)).filter(Boolean).map(extInfo);
}
const SHIM = (() => { try { return fs.readFileSync(path.join(SRC, 'ext-shim.js'), 'utf8'); } catch (e) { return ''; } })();
const extRoot = () => path.join(app.getPath('userData'), 'extensions');
function manifestName(dir) {
  try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')); return (m.name || '').toLowerCase(); } catch (e) { return ''; }
}
/* bring the user's Chrome extensions in (compatible ones, patched for Electron, with their settings) */
function importChromeExtensions() {
  const own = settings.data.extensions.filter(p => !p.startsWith(extRoot()));   // folders the user added himself
  const r = EXT.importFromChrome(CI.profiles(app), app.getPath('userData'), SHIM);
  // a folder the user added himself (e.g. his own modified version) wins over the store copy
  const ownNames = new Set(own.map(manifestName).filter(Boolean));
  const keep = r.imported.filter(x => !ownNames.has(manifestName(x.path)));
  settings.data.extensions = [...own, ...keep.map(x => x.path)];
  settings.save();
  return { imported: keep, skipped: r.skipped };
}
/* the user picked a folder: copy it into our extensions folder and patch the copy (his folder stays untouched) */
async function addExtensionFolder(dir) {
  let d = dir;
  if (!fs.existsSync(path.join(d, 'manifest.json'))) {
    const sub = fs.readdirSync(d).map(n => path.join(d, n)).find(p => fs.existsSync(path.join(p, 'manifest.json')));
    if (!sub) throw new Error('no manifest.json');
    d = sub;
  }
  const slug = (path.basename(d === dir ? dir : path.dirname(d)) + '-' + Date.now().toString(36)).replace(/[^\w.-]+/g, '_');
  const dst = path.join(extRoot(), 'manual', slug);
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(d, dst, { recursive: true, filter: s => !/[\\/]_metadata$/.test(s) });
  EXT.patch(dst, SHIM);
  return dst;
}

/* Chrome Web Store: the "Add to Chrome" button works on chromewebstore.google.com */
const storeRoot = () => path.join(app.getPath('userData'), 'webstore');
const STORE_URL = 'https://chromewebstore.google.com/';
async function setupWebStore() {
  const CWS = require('./vendor/chrome-web-store');
  // patch every store download for Electron before it is loaded (keeps its update address so it can update)
  globalThis.__zeusCwsUnpacked = dir => { try { return EXT.patch(dir, SHIM, { keepUpdateUrl: true }); } catch (e) { console.warn('patch failed', e.message); } };
  await CWS.installChromeWebStore({
    session: session.defaultSession, extensionsPath: storeRoot(), loadExtensions: true, autoUpdate: true,
    beforeInstall: async d => {
      if (process.env.ZEUS_E2E === '1') return { action: 'allow' };   // automated tests only
      let parent;
      try { const wc = webContents.fromFrame(d.frame); const t = wc && tabOfWc(wc); parent = t && t.win && !t.win.win.isDestroyed() ? t.win.win : undefined; } catch (e) {}
      const perms = [...new Set([...(d.manifest.permissions || []), ...(d.manifest.host_permissions || [])])].filter(x => typeof x === 'string');
      const r = await dialog.showMessageBox(parent, {
        type: 'question', title: '3zT', icon: d.icon && !d.icon.isEmpty() ? d.icon.resize({ width: 48 }) : undefined,
        buttons: [T('إضافة الإضافة', 'Add extension'), T('إلغاء', 'Cancel')], defaultId: 0, cancelId: 1, noLink: true,
        message: T(`إضافة "${d.localizedName}"؟`, `Add "${d.localizedName}"?`),
        detail: perms.length ? T('تقدر الإضافة: ', 'It can: ') + perms.slice(0, 8).join('، ') + (perms.length > 8 ? ' …' : '') : ''
      });
      return { action: r.response === 0 ? 'allow' : 'deny' };
    }
  });
  webStore = CWS;
}
let webStore = null;
function isStoreExt(ext) { return !!ext && typeof ext.path === 'string' && ext.path.startsWith(storeRoot() + path.sep); }

/* extension popup: small window under the button that does not take focus away from the page,
   so the extension sees the page as the active tab (Electron decides "active" by focus) */
let extPopup = null;
function closeExtPopup() { if (extPopup && !extPopup.isDestroyed()) extPopup.destroy(); extPopup = null; }
function openExtPopup(w, id, rect) {
  closeExtPopup();
  const e = extApi().getExtension(id); if (!e) return;
  const info = extInfo(e);
  if (!info.popup) { if (info.options) w.createTab(info.options); return; }
  const t = w.active(); if (t && t.view) t.view.webContents.focus();
  const pop = new BrowserWindow({
    parent: w.win, frame: false, focusable: false, skipTaskbar: true, resizable: false, show: false,
    width: 360, height: 500, backgroundColor: '#202124', roundedCorners: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  extPopup = pop;
  const place = (pw, ph) => {
    const cb = w.win.getContentBounds();
    const rtl = settings.data.lang !== 'en';
    let x = cb.x + (rtl ? rect.x : rect.x + rect.w - pw), y = cb.y + rect.y + rect.h + 6;
    const wa = screen.getDisplayMatching(cb).workArea;
    x = Math.max(wa.x + 4, Math.min(wa.x + wa.width - pw - 4, x));
    y = Math.max(wa.y + 4, Math.min(wa.y + wa.height - ph - 4, y));
    pop.setBounds({ x: Math.round(x), y: Math.round(y), width: pw, height: ph });
  };
  const fit = async () => {
    if (pop.isDestroyed()) return;
    try {
      const [cw, ch] = await pop.webContents.executeJavaScript('[Math.ceil(document.documentElement.scrollWidth), Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))]');
      place(Math.max(160, Math.min(800, cw || 360)), Math.max(60, Math.min(600, ch || 300)));
    } catch (err) {}
  };
  pop.webContents.on('did-finish-load', async () => {
    await fit(); if (pop.isDestroyed()) return;
    pop.showInactive();
    let n = 0; const iv = setInterval(() => { if (pop.isDestroyed() || ++n > 12) return clearInterval(iv); fit(); }, 250);
  });
  pop.webContents.on('before-input-event', (ev, i) => { if (i.type === 'keyDown' && i.key === 'Escape') closeExtPopup(); });
  pop.webContents.setWindowOpenHandler(d => { w.createTab(d.url); closeExtPopup(); return { action: 'deny' }; });
  pop.on('closed', () => { if (extPopup === pop) extPopup = null; });
  pop.loadURL(`chrome-extension://${id}/${info.popup}`).catch(() => {});
  place(360, 500);
}

/* ---------- keyboard ---------- */
/* the key's place on the keyboard, not the letter it types: Ctrl+T must work on the Arabic layout too (where it types ف) */
function shortcutKey(i) {
  const code = i.code || '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const map = { Equal: '=', Minus: '-', NumpadAdd: '+', NumpadSubtract: '-', Numpad0: '0' };
  return map[code] || (i.key || '').toLowerCase();
}
function handleKey(w, i) {
  if (i.type !== 'keyDown' || !w) return false;
  const c = i.control || i.meta, k = (c || i.alt) ? shortcutKey(i) : (i.key || '').toLowerCase();
  const t = w.active(); const wc = t && t.view && t.view.webContents;
  if (c && !i.shift && k === 't') { w.createTab(); return true; }
  if (c && i.shift && k === 't') { reopenClosed(w); return true; }
  if (c && !i.shift && k === 'n') { newWindow(); return true; }
  if (c && i.shift && k === 'n') { newWindow({ private: true }); return true; }
  if (c && !i.shift && k === 'w') { if (t) w.closeTab(t.id); return true; }
  if (c && k === 'tab') { cycle(w, i.shift ? -1 : 1); return true; }
  if (c && !i.shift && (k === 'pagedown' || k === 'pageup')) { cycle(w, k === 'pagedown' ? 1 : -1); return true; }
  if (c && i.shift && (k === 'pagedown' || k === 'pageup') && t) {   // move the tab left / right
    const at = w.tabs.indexOf(t), to = at + (k === 'pagedown' ? 1 : -1);
    if (to >= 0 && to < w.tabs.length && !!w.tabs[to].pinned === !!t.pinned) { w.tabs.splice(at, 1); w.tabs.splice(to, 0, t); w.pushState(); saveSessionSoon(); }
    return true;
  }
  if (c && i.shift && k === 'w') { w.win.close(); return true; }
  if (k === 'f3' && w.findText) { if (wc) wc.findInPage(w.findText, { forward: !i.shift, findNext: true }); return true; }
  if (i.alt && k === 'home') { if (t) { t.url = NEWTAB_URL; loadInto(t, NEWTAB_URL); w.layout(); w.focusAddress(); } return true; }
  if (c && i.shift && k === 'j') { if (wc) wc.openDevTools({ mode: 'right' }); return true; }
  if (c && i.shift && k === 'delete') { const ex = allTabs().find(x => isSettings(x.url)); if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(SETTINGS_URL); return true; }
  if (c && /^[1-8]$/.test(k)) { const x = w.tabs[+k - 1]; if (x) w.activate(x.id); return true; }
  if (c && k === '9') { const x = w.tabs[w.tabs.length - 1]; if (x) w.activate(x.id); return true; }
  if ((c && k === 'l') || k === 'f6' || (i.alt && k === 'd')) { w.focusAddress(); return true; }
  if (k === 'f5' || (c && k === 'r')) {
    const hard = (k === 'f5' && (i.shift || c)) || (c && i.shift && k === 'r');
    if (wc) hard ? wc.reloadIgnoringCache() : wc.reload();
    return true;
  }
  if ((i.alt && k === 'arrowleft') || k === 'browserback') { if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); return true; }
  if ((i.alt && k === 'arrowright') || k === 'browserforward') { if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); return true; }
  if (k === 'f11') { w.win.setFullScreen(!w.win.isFullScreen()); return true; }
  if (k === 'f12' || (c && i.shift && k === 'i')) { if (wc) wc.toggleDevTools(); return true; }
  if (c && (k === '=' || k === '+')) { zoom(w, 0.1); return true; }
  if (c && k === '-') { zoom(w, -0.1); return true; }
  if (c && k === '0') { if (wc) { wc.setZoomFactor(1); w.pushState(); } return true; }
  if (c && k === 'd') { toggleBookmark(w); return true; }
  if (c && k === 'f') { w.ui.webContents.focus(); w.ui.webContents.send('find-open'); return true; }
  if (c && k === 'p') { if (wc) wc.print({}, () => {}); return true; }
  if (c && k === 'h') { w.createTab(HISTORY_URL); return true; }
  if (c && !i.shift && k === 'j') { openDownloads(w); return true; }
  if (i.shift && !c && k === 'escape') { openTasks(w); return true; }
  if (c && k === 'u') { if (t && /^https?:/.test(t.url)) w.createTab('view-source:' + t.url, { after: t.id }); return true; }
  if (k === 'escape' && w.uiExpanded === true) { w.ui.webContents.send('close-menus'); return false; }
  return false;
}
function zoom(w, d) {
  const t = w.active(), wc = t && t.view && t.view.webContents; if (!wc) return;
  wc.setZoomFactor(Math.min(3, Math.max(0.3, Math.round((wc.getZoomFactor() + d) * 10) / 10))); w.pushState();
}
function cycle(w, dir) { if (w.tabs.length < 2) return; const i = w.tabs.findIndex(t => t.id === w.activeId); w.activate(w.tabs[(i + dir + w.tabs.length) % w.tabs.length].id); }
function reopenClosed(w) {
  const c = closedStack.pop(); if (!c) return;
  // the tabs of the last session (browser closed with "restore my tabs" off): all of them, like Chrome
  if (Array.isArray(c.group)) { for (const x of c.group) if (x && x.url) w.createTab(x.url); saveSessionSoon(); return; }
  if (c.url) w.createTab(c.url);
  saveSessionSoon();
}
function toggleBookmark(w) {
  const t = w.active(); if (!t || !/^https?:/.test(t.url)) return;
  const f = findBookmark(t.url);
  if (f) f.parent.children.splice(f.parent.children.indexOf(f.item), 1);
  else bookmarks.data.children.push({ title: t.title || t.url, url: t.url });
  bookmarks.save(); w.pushState();
}

/* ---------- address bar ---------- */
const safeDecode = u => { try { return decodeURIComponent(u); } catch (e) { return u; } };
function toUrl(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (/^(3zt|zeus):\/\/history/i.test(t)) return HISTORY_URL;
  if (/^(3zt|zeus):\/\/tasks/i.test(t)) return TASKS_URL;
  if (/^(3zt|zeus):\/\/passwords/i.test(t)) return PASSWORDS_URL;
  if (/^(3zt|zeus):\/\/settings/i.test(t)) return SETTINGS_URL;
  if (/^(3zt|zeus):\/\/downloads/i.test(t)) return DOWNLOADS_URL;
  if (/^(https?|file|chrome-extension|about|view-source):/i.test(t)) return t;
  if (/^localhost(:\d+)?(\/|$)/i.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return 'https://' + t;
  return 'https://www.google.com/search?q=' + encodeURIComponent(t);   // always Google
}
function navigate(w, text, newTab) {
  const url = toUrl(text); if (!url) return;
  const t = w.active();
  if (newTab || !t) { w.createTab(url); return; }
  if (!t.view) makeView(t);
  t.url = url; loadInto(t, url); t.view.webContents.focus(); w.layout(); w.pushState();
}

/* ---------- page translation (Google Translate) ---------- */
function translateUrl(url) {
  const tl = settings.data.lang === 'en' ? 'en' : 'ar';
  return `https://translate.google.com/translate?sl=auto&tl=${tl}&hl=${tl}&u=${encodeURIComponent(url)}`;
}
function untranslateUrl(url) {
  try {
    const x = new URL(url);
    const host = x.hostname.replace(/\.translate\.goog$/i, '').replace(/--/g, '\u0000').replace(/-/g, '.').replace(/\u0000/g, '-');
    for (const k of [...x.searchParams.keys()]) if (k.startsWith('_x_tr_')) x.searchParams.delete(k);
    return `https://${host}${x.pathname}${x.search}${x.hash}`;
  } catch (e) { return url; }
}
/* translated in place, like Chrome: the page stays where it is and keeps working; its text is swapped
   for the translation (new text too, as the site adds it), and every page of the same site is translated
   until the button is pressed again */
const trLang = () => (settings.data.lang === 'en' ? 'en' : 'ar');
function translate(w) {
  const t = w.active(); if (!t || !/^https?:/i.test(t.url)) return;
  if (/\.translate\.goog$/i.test(hostOf(t.url))) { navigate(w, untranslateUrl(t.url)); return; }   // an old proxied page
  const site = AdBlocker.site(hostOf(t.url) || '');
  t.translateSite = t.translateSite === site ? null : site;
  if (t.view && !t.view.webContents.isDestroyed()) t.view.webContents.send(t.translateSite ? 'tr:start' : 'tr:stop', trLang());
  w.pushState();
}
function translateOnLoad(tab) {
  if (!tab.translateSite || !tab.view || tab.view.webContents.isDestroyed()) return;
  if (AdBlocker.site(hostOf(tab.url) || '') !== tab.translateSite) { tab.translateSite = null; return; }   // left the site
  tab.view.webContents.send('tr:start', trLang());
}
const trCache = new Map();
async function trFetch(texts, tl) {
  const body = new URLSearchParams(); for (const q of texts) body.append('q', q);
  const r = await net.fetch(`https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=${tl}&format=text`, { method: 'POST', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } });
  if (!r.ok) throw new Error('translate ' + r.status);
  const j = await r.json();
  // [[translation, lang], ...] for several texts; older shapes: [translation, lang] or "translation"
  const list = texts.length === 1 && !Array.isArray(j[0]) ? [j] : j;
  return list.map(x => (Array.isArray(x) ? x[0] : x));
}
async function trBatch(texts, tl) {
  const out = new Array(texts.length).fill(null), todo = [];
  texts.forEach((q, i) => { const c = trCache.get(tl + '\u0000' + q); if (c !== undefined) out[i] = c; else todo.push(i); });
  for (let i = 0; i < todo.length;) {   // ~4000 characters per request
    const part = []; let len = 0;
    while (i < todo.length && part.length < 80 && (len + texts[todo[i]].length < 4000 || !part.length)) { part.push(todo[i]); len += texts[todo[i]].length; i++; }
    try {
      const res = await trFetch(part.map(k => texts[k]), tl);
      part.forEach((k, j) => { const v = typeof res[j] === 'string' ? res[j] : null; out[k] = v; if (v !== null) trCache.set(tl + '\u0000' + texts[k], v); });
    } catch (e) { console.warn('[3zT] translate', e.message); }
  }
  if (trCache.size > 20000) trCache.clear();
  return out;
}

/* ---------- right-click menus ---------- */
function contextMenu(tab, p) {
  const wc = tab.view.webContents, w = tab.win;
  const items = [];
  if (p.misspelledWord) {
    for (const s of (p.dictionarySuggestions || []).slice(0, 5)) items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    if (items.length) items.push({ type: 'separator' });
  }
  if (p.linkURL) {
    items.push({ label: T('فتح الرابط في تبويب جديد', 'Open link in new tab'), click: () => w.createTab(p.linkURL, { activate: false, after: tab.id }) });
    items.push({ label: T('فتح الرابط في نافذة جديدة', 'Open link in new window'), click: () => newWindow({ url: p.linkURL }) });
    if (!w.private) items.push({ label: T('فتح الرابط في نافذة متخفية', 'Open link in incognito window'), click: () => newWindow({ url: p.linkURL, private: true }) });
    if (/^https?:/i.test(p.linkURL)) items.push({ label: T('حفظ الرابط باسم…', 'Save link as…'), click: () => { dlAskFor.add(p.linkURL); wc.downloadURL(p.linkURL); } });
    items.push({ label: T('نسخ الرابط', 'Copy link'), click: () => clipboard.writeText(p.linkURL) });
    items.push({ type: 'separator' });
  }
  if (p.mediaType === 'image' && p.srcURL) {
    items.push({ label: T('فتح الصورة في تبويب جديد', 'Open image in new tab'), click: () => w.createTab(p.srcURL, { activate: false, after: tab.id }) });
    items.push({ label: T('نسخ الصورة', 'Copy image'), click: () => wc.copyImageAt(p.x, p.y) });
    items.push({ label: T('حفظ الصورة', 'Save image'), click: () => wc.downloadURL(p.srcURL) });
    items.push({ label: T('نسخ عنوان الصورة', 'Copy image address'), click: () => clipboard.writeText(p.srcURL) });
    items.push({ type: 'separator' });
  }
  if ((p.mediaType === 'video' || p.mediaType === 'audio') && p.srcURL && /^https?:/i.test(p.srcURL)) {
    items.push({ label: p.mediaType === 'video' ? T('حفظ الفيديو باسم…', 'Save video as…') : T('حفظ الصوت باسم…', 'Save audio as…'), click: () => wc.downloadURL(p.srcURL) });
    items.push({ label: T('نسخ عنوان الملف', 'Copy media address'), click: () => clipboard.writeText(p.srcURL) });
    items.push({ type: 'separator' });
  }
  if (p.isEditable) {
    items.push({ label: T('قص', 'Cut'), role: 'cut', enabled: p.editFlags.canCut });
    items.push({ label: T('نسخ', 'Copy'), role: 'copy', enabled: p.editFlags.canCopy });
    items.push({ label: T('لصق', 'Paste'), role: 'paste', enabled: p.editFlags.canPaste });
    items.push({ label: T('تحديد الكل', 'Select all'), role: 'selectAll' });
    items.push({ type: 'separator' });
  } else if (p.selectionText && p.selectionText.trim()) {
    const s = p.selectionText.trim();
    items.push({ label: T('نسخ', 'Copy'), role: 'copy' });
    items.push({ label: T('ابحث في Google عن "', 'Search Google for "') + (s.length > 24 ? s.slice(0, 24) + '…' : s) + '"', click: () => w.createTab(toUrl(s), { after: tab.id }) });
    items.push({ type: 'separator' });
  }
  items.push({ label: T('رجوع', 'Back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() });
  items.push({ label: T('للأمام', 'Forward'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() });
  items.push({ label: T('تحديث', 'Reload'), click: () => wc.reload() });
  items.push({ type: 'separator' });
  if (/^https?:/i.test(tab.url)) {
    items.push({ label: T('ترجمة الصفحة', 'Translate page'), click: () => translate(w) });
    items.push({ label: T('طباعة…', 'Print…'), click: () => wc.print({}, () => {}) });
    items.push({ label: T('عرض مصدر الصفحة', 'View page source'), click: () => w.createTab('view-source:' + tab.url, { after: tab.id }) });
  }
  items.push({ label: T('فحص العنصر', 'Inspect'), click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: w.win });
}
/* pin / unpin: pinned tabs are small, stay at the start and come back after a restart */
function togglePin(w, t) {
  const i = w.tabs.indexOf(t); if (i < 0) return;
  w.tabs.splice(i, 1);
  t.pinned = !t.pinned;
  const pins = w.tabs.filter(x => x.pinned).length;
  w.tabs.splice(t.pinned ? pins : pins, 0, t);
  w.pushState(); saveSessionSoon();
}
function tabMenu(w, id) {
  const t = w.tab(id); if (!t) return;
  const i = w.tabs.indexOf(t);
  const wc = t.view && t.view.webContents;
  const right = T('على اليسار', 'to the right'); // RTL: "after" is to the left
  Menu.buildFromTemplate([
    { label: T('تبويب جديد بجانبه', 'New tab next to it'), click: () => w.createTab(NEWTAB_URL, { after: t.id }) },
    { type: 'separator' },
    { label: T('تحديث', 'Reload'), enabled: !!wc, click: () => wc && wc.reload() },
    { label: T('تكرار', 'Duplicate'), click: () => w.createTab(t.url, { after: t.id }) },
    { label: t.pinned ? T('إلغاء تثبيت التبويب', 'Unpin tab') : T('تثبيت التبويب', 'Pin tab'), click: () => togglePin(w, t) },
    { label: t.muted ? T('تشغيل صوت الموقع', 'Unmute site') : T('كتم صوت الموقع', 'Mute site'), click: () => toggleMute(t) },
    { label: T('نقل إلى نافذة جديدة', 'Move to new window'), enabled: w.tabs.length > 1, click: () => detachToNewWindow(t) },
    { type: 'separator' },
    { label: T('إغلاق', 'Close'), click: () => w.closeTab(t.id) },
    { label: T('إغلاق التبويبات الأخرى', 'Close other tabs'), enabled: w.tabs.length > 1, click: () => { for (const x of w.tabs.slice()) if (x !== t) w.closeTab(x.id); } },
    { label: T('إغلاق التبويبات ', 'Close tabs ') + right, enabled: i < w.tabs.length - 1, click: () => { for (const x of w.tabs.slice(i + 1)) w.closeTab(x.id); } }
  ]).popup({ window: w.win });
}
function toggleMute(t) {
  t.muted = !t.muted;
  if (t.view) t.view.webContents.setAudioMuted(t.muted);
  t.win.pushState();
}
function detachToNewWindow(t, at) {
  const from = t.win;
  const nb = from.win.isMaximized() || from.win.isFullScreen() ? (from.win.getNormalBounds ? from.win.getNormalBounds() : from.win.getBounds()) : from.win.getBounds();
  const bounds = { width: nb.width, height: nb.height, x: at ? at.x : nb.x + 40, y: at ? at.y : nb.y + 40 };
  const nw = new Win({ bounds, private: from.private });
  if (from.private) nw.partition = from.partition;   // keep the same incognito session
  from.releaseTab(t);
  nw.adoptTab(t);
  if (!from.tabs.length) from.win.close();
  return nw;
}

/* ---------- dragging a tab out of the strip / onto another window ---------- */
let tabDrag = null;
function stripHit(p, except) {
  for (const w of [lastFocused, ...wins]) {
    if (!w || w === except || w.win.isDestroyed() || !w.win.isVisible() || w.win.isMinimized()) continue;
    if (w.private !== (except && except.private)) continue;   // never mix incognito and normal tabs
    const b = w.win.getContentBounds();
    if (p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + Math.max(w.stripH, 56)) return w;
  }
  return null;
}
/* Windows-style snapping for a window we move ourselves: screen edges = halves, corners = quarters, top = maximize */
function snapZone(p) {
  const d = screen.getDisplayNearestPoint(p), b = d.bounds, wa = d.workArea, E = 6;
  const L = p.x <= b.x + E, R = p.x >= b.x + b.width - 1 - E, T = p.y <= b.y + E, B = p.y >= b.y + b.height - 1 - E;
  const hw = Math.round(wa.width / 2), hh = Math.round(wa.height / 2);
  if (T && L) return { x: wa.x, y: wa.y, width: hw, height: hh };
  if (T && R) return { x: wa.x + wa.width - hw, y: wa.y, width: hw, height: hh };
  if (B && L) return { x: wa.x, y: wa.y + wa.height - hh, width: hw, height: hh };
  if (B && R) return { x: wa.x + wa.width - hw, y: wa.y + wa.height - hh, width: hw, height: hh };
  if (L) return { x: wa.x, y: wa.y, width: hw, height: wa.height };
  if (R) return { x: wa.x + wa.width - hw, y: wa.y, width: hw, height: wa.height };
  if (T) return Object.assign({ max: true }, wa);
  return null;
}
let snapGhost = null;
function showSnapGhost(r) {
  if (!r) { if (snapGhost && !snapGhost.isDestroyed()) snapGhost.hide(); return; }
  if (!snapGhost || snapGhost.isDestroyed()) {
    snapGhost = new BrowserWindow({ show: false, frame: false, transparent: true, focusable: false, skipTaskbar: true, resizable: false, hasShadow: false, alwaysOnTop: true,
      webPreferences: { sandbox: true, contextIsolation: true } });
    snapGhost.setIgnoreMouseEvents(true);
    snapGhost.loadURL('data:text/html,' + encodeURIComponent('<body style="margin:0;background:transparent"><div style="position:fixed;inset:6px;border-radius:10px;background:rgba(138,180,248,.18);border:2px solid rgba(138,180,248,.75);backdrop-filter:blur(2px)"></div>'));
  }
  const b = { x: r.x, y: r.y, width: r.width, height: r.height };
  snapGhost.setBounds(b);
  if (!snapGhost.isVisible()) snapGhost.showInactive();
}
function dragTick() {
  if (!tabDrag) return;
  const p = screen.getCursorScreenPoint();
  const mw = tabDrag.mover;
  if (mw.win.isDestroyed()) { stopTabDrag(); return; }
  mw.win.setPosition(Math.round(p.x - tabDrag.offX), Math.round(p.y - tabDrag.offY));
  const hit = stripHit(p, mw);
  tabDrag.snap = hit ? null : snapZone(p);
  showSnapGhost(tabDrag.snap);
  if (hit !== tabDrag.hover) {
    if (tabDrag.hover && !tabDrag.hover.ui.webContents.isDestroyed()) tabDrag.hover.ui.webContents.send('drop-hint', null);
    tabDrag.hover = hit;
  }
  if (hit) hit.ui.webContents.send('drop-hint', p.x - hit.win.getContentBounds().x);
}
function stopTabDrag() {
  if (!tabDrag) return null;
  clearInterval(tabDrag.timer);
  showSnapGhost(null);
  try { if (!tabDrag.mover.ui.webContents.isDestroyed()) tabDrag.mover.ui.webContents.send('being-moved', false); } catch (e) {}
  if (tabDrag.hover && !tabDrag.hover.ui.webContents.isDestroyed()) tabDrag.hover.ui.webContents.send('drop-hint', null);
  const d = tabDrag; tabDrag = null; return d;
}

/* ---------- task manager: memory + CPU of every process ---------- */
function openTasks(w) {
  const ex = allTabs().find(t => isTasks(t.url));
  if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(TASKS_URL);
}
function taskRows() {
  const m = app.getAppMetrics();
  const mem = x => (x.memory.privateBytes || x.memory.workingSetSize || 0) * 1024;    // bytes
  const cpu = x => Math.round((x.cpu.percentCPUUsage || 0) * 10) / 10;
  const byPid = new Map(m.map(x => [x.pid, x]));
  const used = new Set(), rows = [];
  const add = (kind, name, pid, extra = {}) => {
    const x = byPid.get(pid); if (!x || used.has(pid)) return;
    used.add(pid); rows.push(Object.assign({ kind, name, pid, mem: mem(x), cpu: cpu(x) }, extra));
  };
  for (const x of m) if (x.type === 'Browser') add('browser', '3zT', x.pid);
  for (const x of m) if (x.type === 'GPU') add('gpu', T('معالجة الرسوميات (GPU)', 'GPU process'), x.pid);
  // tabs: several tabs of the same site can share one process
  const groups = new Map();
  for (const t of allTabs()) {
    if (!t.view || t.view.webContents.isDestroyed()) continue;
    const pid = t.view.webContents.getOSProcessId();
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(t);
  }
  for (const [pid, ts] of groups) {
    const names = ts.map(t => t.title || (isNewtab(t.url) ? T('تبويب جديد', 'New tab') : t.url));
    add('tab', names.join(' · '), pid, { tabs: ts.map(t => ({ id: t.id, active: t.id === t.win.activeId, win: t.win.id })), favicon: ts[0].favicon && !isInternal(ts[0].url) ? ts[0].favicon : '' });
  }
  for (const w of wins) if (!w.ui.webContents.isDestroyed()) add('ui', T('شريط الأدوات', 'Toolbar') + (wins.length > 1 ? ' #' + w.id : ''), w.ui.webContents.getOSProcessId());
  for (const x of m) {
    if (used.has(x.pid)) continue;
    const n = x.type === 'Utility' ? (x.serviceName || x.name || 'Utility').replace(/^.*\./, '') : x.type;
    add(x.type === 'Tab' ? 'other' : 'util', x.type === 'Tab' ? T('إضافة / عامل خلفية', 'Extension / worker') : n, x.pid);
  }
  const sleeping = allTabs().filter(t => t.discarded || !t.view).map(t => ({ id: t.id, title: t.title || t.url }));
  const total = rows.reduce((a, r) => a + r.mem, 0);
  return { rows, sleeping, total, cpu: Math.round(rows.reduce((a, r) => a + r.cpu, 0) * 10) / 10, blockedTotal: settings.data.adBlockedTotal || 0, procs: m.length };
}

/* ---------- permissions + downloads for a session ---------- */
/* Google blocks sign-in from Electron-based browsers ("this browser may not be secure").
   Only on Google's sign-in pages we look like Firefox (which Google allows); every other site sees Chrome. */
const FIREFOX_UA = process.platform === 'win32'
  ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0'
  : 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0';
const pkMode = () => (process.env.ZEUS_NO_PASSKEY_FIX ? 'nofix' : settings.data.passkeys ? 'on' : 'off');
const SIGNIN_URLS = ['*://accounts.google.com/*', '*://accounts.youtube.com/*'];
let adSaveTimer = null;
const setUpSessions = new WeakSet();
function setupSession(ses) {
  if (setUpSessions.has(ses)) return;   // a private window's tabs share one session: set it up once
  setUpSessions.add(ses);
  try { ses.protocol.handle('zeus-res', FEAT.serve); } catch (e) {}
  try { ses.setSpellCheckerEnabled(false); } catch (e) {}   // no dictionary download, less memory
  ses.webRequest.onBeforeSendHeaders({ urls: SIGNIN_URLS }, (d, cb) => {
    const h = d.requestHeaders;
    h['User-Agent'] = FIREFOX_UA;
    for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];   // Firefox sends no client hints
    cb({ requestHeaders: h });
  });
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    if (!adblock || settings.data.adblock === false || d.resourceType === 'mainFrame') return cb({});
    let page = '';
    try { page = d.frame && d.frame.top ? d.frame.top.url : (d.webContents ? d.webContents.getURL() : ''); } catch (e) {}
    if (!page) { try { page = d.webContents ? d.webContents.getURL() : ''; } catch (e) {} }
    if (!/^https?:/i.test(page)) return cb({});            // only websites (not our own pages)
    const ph = hostOf(page);
    if (ph && settings.data.adAllow.includes(AdBlocker.site(ph))) return cb({});
    if (!adblock.shouldBlock(d.url, page, d.resourceType)) return cb({});
    const t = d.webContents && tabOfWc(d.webContents);
    if (t) { t.blocked = (t.blocked || 0) + 1; if (t.id === t.win.activeId) t.win.pushState(); }
    // the running total: counted in memory, written to disk at most once a minute (not on every blocked request)
    settings.data.adBlockedTotal = (settings.data.adBlockedTotal || 0) + 1;
    if (!adSaveTimer) adSaveTimer = setTimeout(() => { adSaveTimer = null; settings.save(); }, 60000);
    cb({ cancel: true });
  });
  setupPermissions(ses);
  ses.on('will-download', (e, item, wc) => {
    const resumeId = dl.takeResume();
    const t = wc && tabOfWc(wc);
    const hk = (wc ? wc.id : 0) + ' ' + item.getURL(); const hint = dlNames.get(hk); dlNames.delete(hk); if (process.env.ZEUS_DEBUG_DL) console.log('[3zT] will-download', item.getURL(), JSON.stringify(item.getFilename()), !!hint);
    const askNow = dlAskFor.delete(item.getURL());
    const rec = dl.handle(item, { resumeId, ask: askNow, nameHint: hint && Date.now() - hint.t < 15000 ? hint.name : '', partition: ses !== session.defaultSession ? ((t && t.win.partition) || partitionOfSession(ses) || 'private') : null });
    rec.winId = (() => { const w = (t && t.win) || focusedWin(); return w ? w.id : null; })();
    // a tab a site opened only to start this download (nothing ever showed in it): closed once the file has a place, like Chrome
    if (t && t.openedByPage && !t.committed) { dlBlankTabs.set(rec.id, t); item.once('done', () => closeBlankTab(rec.id)); }
  });
}

/* ---------- site permissions (src/permissions.js) ---------- */
let perms = null;
const partOf = t => (t && t.win && t.win.private ? t.win.partition : null);
let permSeq = 0;
/* ask in the bar of the tab's window (one question at a time per window);
   resolves { choice: 'allow' | 'block' | 'ignore', pick } (pick = the device or screen chosen) */
function askPermission(tab, q) {
  return new Promise(resolve => {
    const w = tab && tab.win;
    if (!w || w.win.isDestroyed() || w.ui.webContents.isDestroyed()) return resolve({ choice: 'ignore', pick: null });
    const id = ++permSeq;
    const item = { id, tab, q, resolve };
    (w.permQueue || (w.permQueue = [])).push(item);
    if (w.permQueue.length === 1) showPermission(w);
  });
}
function showPermission(w) {
  const item = w.permQueue && w.permQueue[0]; if (!item) return;
  if (w.ui.webContents.isDestroyed()) return finishPermission(w, item.id, 'ignore');
  if (item.tab.id !== w.activeId && item.q.type === 'ask') w.activate(item.tab.id);   // the question is about the page you can see
  w.ui.webContents.send('perm-ask', Object.assign({ id: item.id }, item.q));
  // a question nobody answers never hangs the page (the bar itself closes much sooner)
  item.timer = setTimeout(() => finishPermission(w, item.id, 'ignore'), item.q.type === 'ask' ? 60000 : 10 * 60000);
}
function finishPermission(w, id, choice, pick) {
  const q = w.permQueue || []; const i = q.findIndex(x => x.id === id); if (i < 0) return;
  const [item] = q.splice(i, 1);
  clearTimeout(item.timer);
  if (!w.ui.webContents.isDestroyed()) w.ui.webContents.send('perm-cancel', id);
  item.resolve({ choice, pick: pick == null ? null : String(pick) });
  if (q.length && i === 0) setTimeout(() => showPermission(w), 250);
}
/* a page went away (closed or left): drop its questions */
function cancelPermissionsOf(tab) {
  const w = tab.win; if (!w || !w.permQueue) return;
  for (const x of w.permQueue.slice()) if (x.tab === tab) finishPermission(w, x.id, 'ignore');
}
function permNote(tab, origin, kinds) {   // refused this time: the bar shows a small icon to change it
  if (!tab) return;
  tab.permDenied = tab.permDenied && tab.permOrigin === origin ? tab.permDenied : new Set();
  tab.permOrigin = origin;
  for (const k of kinds) tab.permDenied.add(k);
  if (tab.id === tab.win.activeId) tab.win.pushState();
}
function permAsked(tab, origin, kinds) {
  if (!tab) return;
  if (tab.permAskedOrigin !== origin) { tab.permAskedOrigin = origin; tab.permAsked = new Set(); }
  for (const k of kinds) tab.permAsked.add(k);
}
const hostLabel = o => { try { return new URL(o).host; } catch (e) { return o; } };
function setupPermissions(ses) {
  const tabOf = wc => (wc && !wc.isDestroyed() ? tabOfWc(wc) : null);
  // 1. a site asks (camera, microphone, location, notifications...)
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (PERM.ALWAYS.has(permission)) return cb(true);
    const kinds = PERM.kindsOf(permission, details);
    if (!kinds.length) return cb(false);                    // anything else sensitive: no
    const origin = PERM.originOf((details && details.requestingUrl) || (wc && wc.getURL()));
    const tab = tabOf(wc);
    if (!origin || !tab) return cb(false);                  // our own pages, extension popups...
    const part = partOf(tab);
    permAsked(tab, origin, kinds);
    const saved = kinds.map(k => perms.get(origin, k, part));
    if (saved.every(v => v === 'allow')) return cb(true);
    if (saved.some(v => v === 'block')) { permNote(tab, origin, kinds.filter((k, i) => saved[i] === 'block')); return cb(false); }
    const ask = kinds.filter((k, i) => saved[i] !== 'allow');
    askPermission(tab, { type: 'ask', host: hostLabel(origin), kinds: ask }).then(({ choice }) => {
      if (choice === 'allow' || choice === 'block') for (const k of ask) perms.set(origin, k, choice, part);
      else permNote(tab, origin, ask);
      if (choice === 'block') permNote(tab, origin, ask);
      cb(choice === 'allow');
    });
  });
  // 2. a site checks what it may use (navigator.permissions, device labels...)
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => {
    if (PERM.ALWAYS.has(permission)) return true;
    const origin = PERM.originOf(requestingOrigin || (details && (details.requestingUrl || details.securityOrigin)) || '');
    const part = partOf(tabOf(wc));
    if (permission === 'media') {
      const k = PERM.checkKind(permission, details);
      if (!origin) return false;
      if (k) return perms.get(origin, k, part) === 'allow';
      return perms.get(origin, 'camera', part) === 'allow' && perms.get(origin, 'microphone', part) === 'allow';
    }
    const k = PERM.checkKind(permission, details);
    if (!k) return true;                                    // not a permission we manage: Chromium's own behaviour
    return !!origin && perms.get(origin, k, part) === 'allow';
  });
  // 3. USB / HID / serial devices: allowed sites keep their access; the device is picked in the bar
  ses.setDevicePermissionHandler(d => {
    const origin = PERM.originOf(d.origin || ''); if (!origin) return false;
    return perms.get(origin, d.deviceType, null) === 'allow' || [...wins].some(w => w.private && perms.get(origin, d.deviceType, w.partition) === 'allow');
  });
  const pickDevice = (kind, frame, list, cb) => {
    let wc = null; try { wc = frame ? webContents.fromFrame(frame) : null; } catch (e) {}
    const tab = tabOf(wc); const origin = PERM.originOf(frame ? frame.url : wc ? wc.getURL() : '');
    if (!tab || !origin || perms.get(origin, kind, partOf(tab)) === 'block') return cb();
    askPermission(tab, { type: 'device', kind, host: hostLabel(origin), devices: list.slice(0, 40) }).then(({ choice, pick }) => {
      if (choice === 'allow' && pick && list.some(x => x.id === pick)) { perms.set(origin, kind, 'allow', partOf(tab)); cb(pick); }
      else cb();
    });
  };
  ses.on('select-hid-device', (e, d, cb) => { e.preventDefault(); pickDevice('hid', d.frame, (d.deviceList || []).map(x => ({ id: x.deviceId, name: x.name || x.productName || 'HID ' + x.productId })), id => cb(id || '')); });
  ses.on('select-usb-device', (e, d, cb) => { e.preventDefault(); pickDevice('usb', d.frame, (d.deviceList || []).map(x => ({ id: x.deviceId, name: [x.manufacturerName, x.productName].filter(Boolean).join(' ') || 'USB ' + x.productId })), id => cb(id || undefined)); });
  ses.on('select-serial-port', (e, list, wc, cb) => { e.preventDefault(); pickDevice('serial', wc && wc.mainFrame, (list || []).map(x => ({ id: x.portId, name: x.displayName || x.portName })), id => cb(id || '')); });
  // 4. screen sharing: pick a screen or a window (asked every time, like Chrome)
  ses.setDisplayMediaRequestHandler(async (req, cb) => {
    // refusing: Electron wants no stream at all here (an empty object throws)
    const deny = () => { try { cb(null); } catch (e) { try { cb({}); } catch (x) {} } };
    let wc = null; try { wc = req.frame ? webContents.fromFrame(req.frame) : null; } catch (e) {}
    const tab = tabOf(wc); const origin = PERM.originOf(req.securityOrigin || (req.frame && req.frame.url) || '');
    if (!tab || !origin || perms.get(origin, 'screen', partOf(tab)) === 'block') return deny();
    let sources = [];
    try { sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 256, height: 144 }, fetchWindowIcons: false }); } catch (e) {}
    if (!sources.length) return deny();
    const list = sources.slice(0, 24).map(s => ({ id: s.id, name: s.name, screen: s.id.startsWith('screen:'), thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '' }));
    askPermission(tab, { type: 'screen', host: hostLabel(origin), sources: list, audio: !!req.audioRequested }).then(({ choice, pick }) => {
      const src = choice === 'allow' && sources.find(s => s.id === pick);
      if (!src) return deny();
      const out = { video: src };
      if (req.audioRequested && process.platform === 'win32' && src.id.startsWith('screen:')) out.audio = 'loopback';   // the computer's sound with a whole screen
      cb(out);
    });
  });
}
function setupPermissionIpc() {
  ipcMain.on('perm:answer', (e, a) => {
    const w = uiWin(e); if (!w || !a) return;
    const item = (w.permQueue || []).find(x => x.id === a.id); if (!item) return;
    finishPermission(w, a.id, a.choice === 'allow' ? 'allow' : a.choice === 'block' ? 'block' : 'ignore', a.pick);
  });
  // the site panel in the bar: change a permission of the current site
  ipcMain.on('perm:set', (e, a) => {
    const w = uiWin(e); if (!w || !a) return;
    const t = w.active(); const origin = t && PERM.originOf(t.url); if (!origin || !PERM.KINDS[a.kind]) return;
    perms.set(origin, a.kind, a.value === 'allow' || a.value === 'block' ? a.value : null, partOf(t));
    if (t.permDenied) { t.permDenied.delete(a.kind); }
    w.pushState(); settingsChanged();
  });
}

/* ---------- downloads: tell the bar (notices + icon) and the downloads page ---------- */
let dlPageTimer = null;
/* which private session a download / page belongs to (null = normal browsing) */
function partitionOfSession(ses) {
  const w = wins.find(x => x.private && x.tabs.some(t => t.view && !t.view.webContents.isDestroyed() && t.view.webContents.session === ses));
  return w ? w.partition : null;
}
function partOfSender(e) { const t = tabOfWc(e.sender); return t && t.win.private ? t.win.partition : null; }
const samePart = (r, part) => (r.partition || null) === (part || null);
const dlBlankTabs = new Map();   // download id -> empty tab that only started it
/* names pages give their downloads (<a download="ملف.pdf">): Electron loses names that are not plain English */
const dlNames = new Map();       // '<tab webContents id> <absolute href>' -> { name, t }
const dlNameRate = new Map();
const dlAskFor = new Set();      // "Save link as…": always asks where, like Chrome
ipcMain.on('dl:name', (e, d) => {
  e.returnValue = true;
  if (!tabOfWc(e.sender) || !d || typeof d.href !== 'string' || typeof d.name !== 'string') return;
  // a few per second at most (a page cannot flood the browser)
  const now = Date.now(), r = dlNameRate.get(e.sender.id) || { t: now, n: 0 };
  if (now - r.t > 1000) { r.t = now; r.n = 0; } if (++r.n > 10) return; dlNameRate.set(e.sender.id, r);
  let href, page; try { page = new URL(e.senderFrame.url); href = new URL(d.href, page.href); } catch (x) { return; }
  // like Chrome: a page can only name its own files (same site address, or files it made: blob:/data:)
  if (!/^(blob|data):$/.test(href.protocol) && href.origin !== page.origin) return;
  const name = d.name.trim().slice(0, 200); if (!name) return;
  dlNames.set(e.sender.id + ' ' + href.href, { name, t: now }); if (process.env.ZEUS_DEBUG_DL) console.log('[3zT] dl:name', href.href, name);
  if (dlNames.size > 50) dlNames.delete(dlNames.keys().next().value);
});
function closeBlankTab(id) {
  const t = dlBlankTabs.get(id); dlBlankTabs.delete(id);
  if (t && !t.committed && t.win && t.win.tabs.includes(t)) t.win.closeTab(t.id, { forget: true });
}
function dlNotify(rec, ev) {
  if (ev === 'start' || ev === 'done') closeBlankTab(rec.id);
  const w = wins.find(x => x.id === rec.winId) || focusedWin();
  if ((ev === 'start' || ev === 'done') && w && !w.ui.webContents.isDestroyed()) {
    w.ui.webContents.send('download', { id: rec.id, name: rec.name, path: rec.path, state: ev === 'start' ? 'started' : rec.state });
  }
  for (const x of wins) x.pushState();
  if (!dlPageTimer) dlPageTimer = setTimeout(() => {
    dlPageTimer = null;
    for (const t of allTabs()) if (t.view && isDownloads(t.url) && !t.view.webContents.isDestroyed()) t.view.webContents.send('dl:changed');
  }, ev === 'update' ? 400 : 0);
}
function openDownloads(w) {
  const ex = allTabs().find(x => isDownloads(x.url));
  if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(DOWNLOADS_URL);
}
function dlSummary() {
  const live = dl ? dl.list().filter(r => r.state === 'progressing') : [];
  let got = 0, all = 0; for (const r of live) { got += r.received || 0; all += r.total || 0; }
  return { active: live.length, progress: all ? got / all : -1, session: dl ? dl.sessionList().length : 0 };
}
/* ---------- built-in media downloader (src/media): videos, audio, photo posts, trimming ----------
   Nothing starts until it is used: the engine is made on the first request, its tools are fetched once. */
let media = null, mediaPageTimer = null;
const mediaPending = new Map();   // downloader window webContents id -> { url, partition } from the address-bar button
const mediaWins = new Map();      // partition ('' = normal browsing) -> the downloader window
const mediaWinPart = new Map();   // downloader window webContents id -> partition
/* the video downloader has its own small window (one for normal browsing, one per private session) */
function openMediaWindow(url, partition) {
  const key = partition || '';
  let mw = mediaWins.get(key);
  const give = () => { if (!url || mw.isDestroyed()) return; mediaPending.set(mw.webContents.id, { url, partition: partition || null }); mw.webContents.send('media:url', url); };
  if (mw && !mw.isDestroyed()) { if (mw.isMinimized()) mw.restore(); mw.focus(); give(); return mw; }
  mw = new BrowserWindow(Object.assign({
    width: 620, height: Math.min(820, Math.max(540, screen.getPrimaryDisplay().workAreaSize.height - 40)), minWidth: 460, minHeight: 540, show: false, backgroundColor: '#0b0b0f', title: '3zT',
    autoHideMenuBar: true, titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0b0f', symbolColor: '#dddddd', height: 38 },
    webPreferences: { preload: PRELOAD_TAB, partition: partition || undefined, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  }, ICON_OPT));
  mediaWins.set(key, mw);
  const id = mw.webContents.id;
  mediaWinPart.set(id, partition || null);
  if (url) mediaPending.set(id, { url, partition: partition || null });
  mw.webContents.on('will-navigate', e => e.preventDefault());   // it only ever shows its own page
  mw.webContents.setWindowOpenHandler(d => { if (/^https?:/i.test(d.url)) { const w = wins.find(x => (x.private ? x.partition : null) === (partition || null)); if (w) { w.createTab(d.url); w.win.focus(); } else if (!partition) newWindow({ url: d.url }); } return { action: 'deny' }; });
  mw.once('ready-to-show', () => mw.show());
  // closing it stops everything it started (after asking, if something is still downloading)
  let closeOk = false;
  mw.on('close', e => {
    if (closeOk || quitting || !media || !media.running(partition || null)) return;
    e.preventDefault();
    const r = dialog.showMessageBoxSync(mw, { type: 'question', buttons: [T('أوقفه وأقفل', 'Stop and close'), T('إلغاء', 'Cancel')], defaultId: 1, cancelId: 1, noLink: true,
      title: '3zT', message: T('فيه تحميل شغال. توقفه وتقفل النافذة؟', 'A download is still running. Stop it and close?') });
    if (r === 0) { closeOk = true; mw.close(); }
  });
  mw.on('closed', () => {
    if (media) media.reset(partition || null, id);   // programs stopped, temporary files and the list gone
    mediaWins.delete(key); mediaWinPart.delete(id); mediaPending.delete(id);
    if (!wins.length && !mediaWins.size) app.quit();
  });
  mw.loadFile(MEDIA_FILE);
  return mw;
}
const mediaSaved = new Set();     // jobs already added to the downloads list
const trimOwners = new Map();     // list id -> { proc } of a running trim (for Cancel)
function mediaEngine() {
  if (media) return media;
  const { MediaEngine } = require('./media/engine');
  media = new MediaEngine({
    dir: path.join(app.getPath('userData'), 'media'),
    outDir: () => settings.data.mediaDir || path.join(app.getPath('downloads'), '3zT'),
    fetch: (u, o) => net.fetch(u, o),
    jsRuntime: process.execPath,
    packedDir: app.isPackaged ? path.join(process.resourcesPath, 'tools') : path.join(SRC, '..', 'tools-cache'),
    version: app.getVersion(),
    userAgent: app.userAgentFallback,
    log: (...a) => console.log('[3zT media]', ...a),
    onChange: job => {
      if (job && job.state === 'done' && job.file && !mediaSaved.has(job.id)) {
        mediaSaved.add(job.id);
        const rec = dl.addFile({ name: path.basename(job.file), path: job.file, url: job.url, partition: job.partition || null });
        rec.winId = job.winId || null;
        dlNotify(rec, 'start'); dlNotify(rec, 'done');
      }
      if (!mediaPageTimer) mediaPageTimer = setTimeout(() => {
        mediaPageTimer = null;
        for (const mw of mediaWins.values()) if (!mw.isDestroyed()) mw.webContents.send('media:changed');
      }, job && job.state === 'running' ? 300 : 0);
    }
  });
  try { media.copied = true; media.copyPacked(); } catch (e) {}   // tools from the setup, ready at once
  return media;
}
/* the link of the video you are looking at. TikTok's "For You" feed keeps the address at tiktok.com/ while you
   scroll, so the page itself is asked which video is on screen (in a separate script world the page cannot touch) */
const FEED_JS = String.raw`(() => {
  const area = v => { const r = v.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)); };
  const vids = [...document.querySelectorAll('video')].map(v => ({ v, a: area(v), p: !v.paused })).filter(x => x.a > 0).sort((x, y) => (y.p - x.p) || (y.a - x.a));
  for (const { v } of vids) {
    let user = '', vid = '';
    for (let el = v, i = 0; el && i < 14; el = el.parentElement, i++) {
      if (i && el.querySelectorAll('video').length > 1) break;   // left this video's own box: the rest belongs to other videos
      if (!user) { const u = el.querySelector && el.querySelector('a[href*="/@"]'); if (u) { const m = /\/@([\w.-]+)/.exec(u.getAttribute('href') || ''); if (m) user = m[1]; } }
      const a = el.querySelector && el.querySelector('a[href*="/video/"], a[href*="/photo/"]');
      if (a) { const m = /\/@([\w.-]+)\/(video|photo)\/(\d+)/.exec(a.href); if (m) return 'https://www.tiktok.com/@' + m[1] + '/' + m[2] + '/' + m[3]; }
      const id = /(?:^|[^\d])(\d{17,21})(?:[^\d]|$)/.exec(el.id || '');
      if (id && !vid) vid = id[1];
      if (vid && user) break;
    }
    if (vid) return 'https://www.tiktok.com/@' + user + '/video/' + vid;   // the account name is only a nicety (the number is enough)
  }
  return '';
})()`;
async function currentMediaUrl(t) {
  let u = t.url;
  try {
    const x = new URL(u);
    if (/(^|\.)tiktok\.com$/i.test(x.hostname) && !/\/(video|photo)\/\d+/.test(x.pathname) && t.view && !t.view.webContents.isDestroyed()) {
      const r = await Promise.race([t.view.webContents.executeJavaScriptInIsolatedWorld(1999, [{ code: FEED_JS }]), new Promise(res => setTimeout(() => res(''), 1500))]);
      if (typeof r === 'string' && /^https:\/\/www\.tiktok\.com\/@[\w.-]*\/(video|photo)\/\d+$/.test(r)) u = r;
    }
  } catch (e) {}
  return u;
}
/* the cookies of the link's own site only (for posts you can see because you are signed in) */
async function mediaCookies(url, ses) {
  let host = ''; try { host = new URL(url).hostname; } catch (e) { return []; }
  const s = siteOf(host); if (!s) return [];
  try { return (await ses.cookies.get({})).filter(c => { const d = c.domain.replace(/^\./, ''); return d === s || d.endsWith('.' + s); }); } catch (e) { return []; }
}
function setupMediaIpc() {
  const okPage = e => { try { return mediaWinPart.has(e.sender.id) && same(e.senderFrame.url, pathToFileURL(MEDIA_FILE).href); } catch (x) { return false; } };
  const okList = e => okPage(e) || (() => { try { return isDownloads(e.senderFrame.url); } catch (x) { return false; } })();   // trimming list files
  // the downloader window of a private session uses that session's cookies; the normal one uses yours
  const sesFor = e => {
    const part = mediaWinPart.get(e.sender.id) || null;
    return { ses: part ? e.sender.session : session.defaultSession, partition: part };
  };
  const cleanUrl = u => { try { const x = new URL(String(u || '').trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  // the address-bar button: open the downloads page with this page's link
  ipcMain.on('media:open', async e => {
    const w = uiWin(e); if (!w) return;
    const t = w.active(); if (!t || !/^https?:/i.test(t.url)) return;
    openMediaWindow(await currentMediaUrl(t), w.private ? w.partition : null);
  });
  ipcMain.on('media:window', e => { const t = tabOfWc(e.sender); if (!t || !isDownloads(t.url)) return; openMediaWindow('', t.win.private ? t.win.partition : null); });
  ipcMain.handle('media:info', async (e, u) => {
    if (!okPage(e)) return { error: 'denied' };
    const url = cleanUrl(u); if (!url) return { error: 'bad-url' };
    const { ses } = sesFor(e);
    try { return await mediaEngine().info({ url, cookies: await mediaCookies(url, ses), key: e.sender.id }); } catch (x) { return { error: String(x.message || x) }; }
  });
  // the link from the address-bar button, given once (a reload of the page does not fill it again)
  ipcMain.handle('media:take', e => { if (!okPage(e)) return null; const p = mediaPending.get(e.sender.id); if (!p || p.taken) return null; p.taken = true; return p.url; });
  ipcMain.handle('media:list', e => (okPage(e) ? { jobs: media ? media.list(mediaWinPart.get(e.sender.id) || null) : [], tools: media ? media.toolsInfo() : { ready: mediaEngine().ready(), setup: null }, folder: settings.data.mediaDir || path.join(app.getPath('downloads'), '3zT') } : null));
  ipcMain.handle('media:start', async (e, o) => {
    if (!okPage(e) || !o) return { error: 'denied' };
    const url = cleanUrl(o.url); if (!url) return { error: 'bad-url' };
    const { ses, partition } = sesFor(e);
    const cookies = await mediaCookies(url, ses);
    try {
      const m = mediaEngine();
      const winId = (() => { const w = wins.find(x => (x.private ? x.partition : null) === partition); return w ? w.id : null; })();
      return o.mode === 'images' ? await m.startImages({ url, cookies, partition, winId }) : await m.startVideo({ url, mode: o.mode, q: o.q, trim: !!o.trim, cookies, partition, winId, start: o.start, end: o.end, exact: !!o.exact, infoId: o.infoId });
    } catch (x) { return { error: String(x.message || x) }; }
  });
  ipcMain.handle('media:cancel', (e, id) => (okPage(e) && media ? media.cancel(String(id)) : false));
  ipcMain.handle('media:save', (e, id, idx) => {
    if (!okPage(e) || !media) return { error: 'expired' };
    try {
      const files = media.saveImages(String(id), idx);
      const j = media.jobs.get(String(id));
      for (const f of files) { const r = dl.addFile({ name: path.basename(f), path: f, url: j && j.url, partition: j && j.partition }); dlNotify(r, 'refresh'); }
      return { saved: files.length, files };
    } catch (x) { return { error: String(x.message || x) }; }
  });
  ipcMain.handle('media:trim', async (e, id, o) => {
    if (!okPage(e) || !media || !o) return { error: 'expired' };
    try { return await media.finishTrim(String(id), { start: +o.start || 0, end: +o.end || 0, exact: !!o.exact, whole: !!o.whole }); }
    catch (x) { return { error: String(x.message || x) }; }
  });
  // trim a finished download from the list: a new "(clip)" file next to it
  ipcMain.handle('media:trimFile', async (e, id, o) => {
    if (!okList(e) || !o) return { error: 'denied' };
    const r = dl.get(String(id));
    if (!r || r.state !== 'completed' || !r.path || !fs.existsSync(r.path) || !/\.(mp4|webm|mov|m4v|mkv)$/i.test(r.path)) return { error: 'not-video' };
    const owner = {}; trimOwners.set(String(id), owner);
    try {
      const out = await mediaEngine().trimExisting(r.path, { start: +o.start || 0, end: +o.end || 0, exact: !!o.exact }, pc => { try { e.sender.send('media:trimPct', id, pc); } catch (x) {} }, owner);
      trimOwners.delete(String(id));
      const nr = dl.addFile({ name: path.basename(out), path: out, url: r.url, partition: r.partition || null }); dlNotify(nr, 'refresh');
      return { file: out };
    } catch (x) { trimOwners.delete(String(id)); return { error: owner.cancelled ? 'cancelled' : String(x.message || x) }; }
  });
  ipcMain.handle('media:trimCancel', (e, id) => {
    if (!okList(e)) return false;
    const o = trimOwners.get(String(id)); if (!o) return false;
    o.cancelled = true; if (media && o.proc) media.killTree(o.proc);
    return true;
  });
  ipcMain.handle('media:update', async e => { if (!okPage(e)) return null; try { return await mediaEngine().updateTools(); } catch (x) { return { error: String(x.message || x) }; } });
  ipcMain.handle('media:show', (e, f) => {
    if (!okPage(e) || typeof f !== 'string' || !media) return false;
    const known = [...media.jobs.values()].some(j => j.file === f || (j.items || []).some(x => x.path === f));
    if (known && fs.existsSync(f)) shell.showItemInFolder(f);
    return known;
  });
  ipcMain.handle('media:folder', async (e, choose) => {
    if (!okPage(e)) return null;
    const cur = settings.data.mediaDir || path.join(app.getPath('downloads'), '3zT');
    if (!choose) { fs.mkdirSync(cur, { recursive: true }); shell.openPath(cur); return cur; }
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender) || undefined, { title: T('اختر مجلد الحفظ', 'Choose a folder'), defaultPath: cur, properties: ['openDirectory', 'createDirectory'] });
    if (!r.canceled && r.filePaths[0]) { settings.data.mediaDir = r.filePaths[0]; settings.save(); }
    return settings.data.mediaDir || cur;
  });
  // the page itself says it has a real video on it (unknown sites)
  ipcMain.on('media:seen', e => {
    const t = tabOfWc(e.sender); if (!t || e.senderFrame !== e.sender.mainFrame || t.mediaSeen) return;
    t.mediaSeen = true; if (t.id === t.win.activeId) t.win.pushState();
  });
  // drag a finished download out of the list onto a website, the desktop or a folder (a real Windows drag)
  const dragIcon = (() => { let i = null; return () => i || (i = nativeImage.createFromPath(path.join(SRC, 'ui', 'app.png')).resize({ width: 32, height: 32 })); })();
  ipcMain.on('dl:drag', (e, id) => {
    if (!uiWin(e) && !okList(e)) return;
    const r = dl.get(String(id));
    if (!r || r.state !== 'completed' || !r.path || !fs.existsSync(r.path)) return;
    let icon = dragIcon();
    try { const u = dragIcons.get(r.path); if (u) icon = u; } catch (x) {}
    try { e.sender.startDrag({ file: r.path, icon }); } catch (x) {}
  });
}
const dragIcons = new Map();   // file path -> its Windows icon (filled when the list shows it)
function setupDownloadIpc() {
  const okPage = e => { try { return isDownloads(e.senderFrame.url); } catch (x) { return false; } };
  ipcMain.handle('dl:list', e => (okPage(e) ? {
    items: dl.list().filter(r => samePart(r, partOfSender(e))).map(r => (r.state === 'completed' && r.path ? Object.assign({}, r, { exists: fs.existsSync(r.path) }) : r)),
    folder: dl.folder(), ask: settings.data.dlAsk !== false } : null));
  ipcMain.handle('dl:act', (e, id, cmd) => {
    if (!okPage(e)) return false;
    const r = dl.get(id);
    if (cmd === 'open' && r && r.path) { shell.openPath(r.path); return true; }
    if (cmd === 'show' && r && r.path) { shell.showItemInFolder(r.path); return true; }
    const t = tabOfWc(e.sender);
    const ses = t && t.win.private ? t.view.webContents.session : session.defaultSession;
    const ok = dl.action(id, cmd, ses); dlNotify(r || { id }, 'refresh'); return ok;
  });
  // the bar's download list: this run's downloads only (they leave the list when the browser closes)
  const iconCache = new Map();
  const fileIcon = async r => {
    if (!r.path || r.state !== 'completed') return '';
    if (iconCache.has(r.path)) return iconCache.get(r.path);
    let u = ''; try { if (fs.existsSync(r.path)) { const im = await app.getFileIcon(r.path, { size: 'normal' }); dragIcons.set(r.path, im); u = im.toDataURL(); } } catch (x) {}
    iconCache.set(r.path, u); return u;
  };
  ipcMain.handle('dl:session', async e => {
    if (!uiWin(e)) return [];
    const part = uiWin(e).private ? uiWin(e).partition : null;
    return Promise.all(dl.sessionList().filter(r => samePart(r, part)).slice(0, 30).map(async r => ({
      id: r.id, name: r.name, state: r.state, paused: !!r.paused, received: r.received || 0, total: r.total || 0, speed: r.speed || 0,
      canResume: r.canResume !== false, exists: r.state === 'completed' && r.path ? fs.existsSync(r.path) : true, icon: await fileIcon(r)
    })));
  });
  ipcMain.on('dl:uiAct', (e, id, cmd) => {
    const w = uiWin(e); if (!w) return;
    const r = dl.get(id); if (!r) return;
    if (cmd === 'open') { if (r.path && r.state === 'completed') shell.openPath(r.path); return; }
    if (cmd === 'show') { if (r.path) shell.showItemInFolder(r.path); return; }
    if (!['pause', 'resume', 'cancel', 'retry'].includes(cmd)) return;
    const ses = w.private && w.tabs[0] && w.tabs[0].view ? w.tabs[0].view.webContents.session : session.defaultSession;
    dl.action(id, cmd, ses); dlNotify(r, 'refresh');
  });
  ipcMain.handle('dl:clear', e => { if (!okPage(e)) return false; dl.clear(); dlNotify({}, 'refresh'); return true; });
  ipcMain.handle('dl:folder', e => { if (okPage(e)) shell.openPath(dl.folder()); return true; });
  ipcMain.handle('dl:icon', async (e, id) => {
    if (!okPage(e)) return '';
    const r = dl.get(id); if (!r || !r.path || !fs.existsSync(r.path)) return '';
    try { const im = await app.getFileIcon(r.path, { size: 'normal' }); dragIcons.set(r.path, im); return im.toDataURL(); } catch (x) { return ''; }
  });
}

/* ---------- passwords ---------- */
const pwOffers = new Map();
function setupPasswordIpc() {
  // web pages (top frame of a normal tab) — the origin comes from Chromium, never from the page
  const pageOrigin = e => {
    const t = tabOfWc(e.sender); if (!t || t.win.private) return '';
    try { if (e.senderFrame !== e.sender.mainFrame) return ''; const o = e.senderFrame.origin; return /^https?:\/\//.test(o) ? o : ''; } catch (x) { return ''; }
  };
  ipcMain.handle('pw:query', e => {
    const o = pageOrigin(e); if (!o) return [];
    return passwords.forOrigin(o).slice(0, 8).map(x => ({ id: x.id, username: x.username, host: hostOf(x.origin) }));
  });
  ipcMain.handle('pw:get', (e, id) => {
    const o = pageOrigin(e); if (!o) return null;
    const x = passwords.forOrigin(o).find(v => v.id === id); if (!x) return null;
    passwords.touch(id);
    return { username: x.username, password: passwords.reveal(id) };
  });
  ipcMain.on('pw:offer', (e, a) => {
    const o = pageOrigin(e); if (!o || !a || !a.password || a.password.length > 512) return;
    const site = AdBlocker.site(hostOf(o) || '');
    if ((settings.data.pwNever || []).includes(site)) return;
    const un = String(a.username || '').slice(0, 256);
    const ex = passwords.find(o, un);
    if (ex && passwords.reveal(ex.id) === a.password) return;
    const id = require('crypto').randomUUID();
    pwOffers.set(id, { origin: o, username: un, password: a.password, update: !!ex });
    setTimeout(() => pwOffers.delete(id), 120000);
    const t = tabOfWc(e.sender);
    if (t && !t.win.ui.webContents.isDestroyed()) t.win.ui.webContents.send('pw-offer', { id, host: hostOf(o).replace(/^www\./, ''), username: un, update: !!ex });
  });
  ipcMain.on('pw:answer', (e, a) => {
    if (!uiWin(e) || !a) return;
    const off = pwOffers.get(a.id); pwOffers.delete(a.id); if (!off) return;
    if (a.choice === 'save') passwords.upsert(off.origin, off.username, off.password);
    if (a.choice === 'never') { const l = settings.data.pwNever || (settings.data.pwNever = []); l.push(AdBlocker.site(hostOf(off.origin) || '')); settings.save(); }
  });
  // the passwords page
  ipcMain.handle('pw:list', e => (internalPage(e) ? { entries: passwords.list().map(x => Object.assign(x, { favicon: cachedFavicon(x.origin) })), encrypted: passwords.encrypted, never: settings.data.pwNever || [] } : null));
  ipcMain.handle('pw:reveal', (e, id) => (internalPage(e) ? passwords.reveal(id) : ''));
  ipcMain.handle('pw:delete', (e, id) => (internalPage(e) ? passwords.remove(id) : false));
  ipcMain.handle('pw:unnever', (e, site) => { if (!internalPage(e)) return false; settings.data.pwNever = (settings.data.pwNever || []).filter(x => x !== site); settings.save(); return true; });
  ipcMain.handle('pw:import', async e => {
    if (!internalPage(e) && !uiWin(e)) return null;
    const t = tabOfWc(e.sender), w = (t && t.win) || uiWin(e) || focusedWin();
    const r = await dialog.showOpenDialog(w.win, { title: T('اختر ملف كلمات السر من كروم (CSV)', 'Choose the Chrome passwords file (CSV)'), properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    try { const res = passwords.importCSV(fs.readFileSync(r.filePaths[0], 'utf8')); res.file = r.filePaths[0]; return res; }
    catch (err) { return { error: String(err.message || err) }; }
  });
  ipcMain.handle('pw:deleteFile', async (e, file) => {
    if (!internalPage(e) || typeof file !== 'string' || !/\.csv$/i.test(file)) return false;
    try { await shell.trashItem(file); return true; } catch (err) { return false; }
  });
  // YouTube ad blocking: asked by the page preload before YouTube's own scripts run
  ipcMain.on('signin:ua', e => { e.returnValue = FIREFOX_UA; });
  // frames inside pages: passkeys on/off (Settings) and, inside Google's sign-in, the Firefox look
  ipcMain.on('pk:mode', (e, signin) => { e.returnValue = { mode: pkMode(), ua: signin ? FIREFOX_UA : '' }; });
  ipcMain.handle('tr:batch', async (e, texts, tl) => {
    if (!tabOfWc(e.sender) || !Array.isArray(texts)) return [];
    return trBatch(texts.slice(0, 400).map(x => String(x).slice(0, 5000)), tl === 'en' ? 'en' : 'ar');
  });
  ipcMain.on('yt:adblock', e => {
    const t = tabOfWc(e.sender);
    e.returnValue = !!(t && settings.data.adblock !== false && settings.data.ytAds !== false && !settings.data.adAllow.includes('youtube.com'));
  });
  setupSiteIpc();
}

/* ---------- built-in site features (were extensions) ---------- */
const senderHost = e => { try { return new URL(e.senderFrame.url).hostname; } catch (x) { return ''; } };
const isYT = h => /(^|\.)youtube\.com$/i.test(h), isTwitch = h => /(^|\.)twitch\.tv$/i.test(h);
let ambientStore = null;
function siteCfg(host) {
  const d = settings.data, adsOn = d.adblock !== false;
  return {
    fast: FAST, lang: d.lang,
    pk: pkMode(),
    yt: isYT(host) ? { clean: ytCleanAttrs(), cleanCss: FEAT.YT_CLEAN_CSS, sponsor: d.sponsorBlock !== false ? (d.sbCats || []) : [], ambient: d.ambient !== false } : null,
    twitch: isTwitch(host) && adsOn && d.twitchAds !== false && !d.adAllow.includes('twitch.tv')
  };
}
function ytCleanAttrs() {
  const on = settings.data.ytClean || {}, out = {};
  for (const [id, attrs] of Object.entries(FEAT.YT_CLEAN)) for (const a of attrs) out[a] = !!on[id];
  return out;
}
function setupSiteIpc() {
  ipcMain.on('site:cfg', e => { e.returnValue = tabOfWc(e.sender) ? siteCfg(senderHost(e)) : {}; });
  ipcMain.on('site:code', (e, name) => {
    const h = senderHost(e);
    const ok = (name === 'twitch' && isTwitch(h)) || (name === 'ambientContent' && isYT(h));
    e.returnValue = ok ? FEAT.code(name) : '';
  });
  ipcMain.handle('site:ambientMain', e => (isYT(senderHost(e)) ? FEAT.code('ambientMain') : ''));
  ipcMain.handle('sb:get', (e, id) => (isYT(senderHost(e)) && settings.data.sponsorBlock !== false ? FEAT.sbSegments(id, settings.data.sbCats) : []));
  // chrome.storage.local for ambient light
  const amb = () => ambientStore || (ambientStore = makeStore('ambient-light.json', {}));
  ipcMain.handle('amb:get', (e, keys) => {
    if (!isYT(senderHost(e))) return {};
    const all = amb().data, out = {};
    if (keys == null) return Object.assign({}, all);
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) { for (const k of keys) if (k in all) out[k] = all[k]; return out; }
    if (typeof keys === 'object') { for (const k of Object.keys(keys)) out[k] = k in all ? all[k] : keys[k]; return out; }
    return out;
  });
  ipcMain.handle('amb:set', (e, obj) => { if (!isYT(senderHost(e)) || !obj || typeof obj !== 'object') return false; Object.assign(amb().data, obj); amb().save(); return true; });
  ipcMain.handle('amb:remove', (e, keys) => { if (!isYT(senderHost(e))) return false; for (const k of [].concat(keys || [])) delete amb().data[k]; amb().save(); return true; });
}
/* "Thmanyah on every site": the installed Thmanyah font over each website's own text.
   Icons drawn with icon fonts (Material, Font Awesome and similar) and code keep their font. */
const SITE_FONT_CSS = ['Light:300', 'Regular:400', 'Medium:500', 'Bold:600 700', 'Black:800 900']
  .map(x => { const [n, w] = x.split(':'); return `@font-face{font-family:"Thmanyah3zT";src:local("thmanyah serif display ${n}"),local("thmanyahserifdisplay-${n}");font-weight:${w}}`; }).join('') +
  ':where(html,body,p,a,li,dt,dd,h1,h2,h3,h4,h5,h6,span,div,label,button,input,textarea,select,td,th,caption,figcaption,blockquote,small,strong,b,em,yt-formatted-string,article,section,header,footer,nav,aside,main)' +
  ':not(i,code,pre,kbd,samp,svg,svg *,[class*="icon" i],[class*="material" i],[class*="symbol" i],[class^="fa"],[class*=" fa-"],[class*="glyph" i],[aria-hidden="true"])' +
  '{font-family:"Thmanyah3zT",system-ui,"Segoe UI",sans-serif!important}';
function applySiteFont(tab) {
  if (!tab || !tab.view) return;
  const wc = tab.view.webContents;
  if (wc.isDestroyed() || !/^https?:/i.test(tab.url || '')) return;
  const on = !!settings.data.siteFont;
  if (!on && tab.siteFontKey) { wc.removeInsertedCSS(tab.siteFontKey).catch(() => {}); tab.siteFontKey = null; }
  if (on && !tab.siteFontKey) {
    tab.siteFontKey = 'pending';
    wc.insertCSS(SITE_FONT_CSS, { cssOrigin: 'author' }).then(k => { tab.siteFontKey = k; }).catch(() => { tab.siteFontKey = null; });
  }
}
/* tell open YouTube tabs about changed switches */
function pushSiteCfg() {
  for (const t of allTabs()) {
    if (!t.view || t.view.webContents.isDestroyed()) continue;
    const h = hostOf(t.url || '') || '';
    if (isYT(h)) t.view.webContents.send('site:update', siteCfg(h));
  }
}
/* the extensions that are now built in: carry their settings over once, then remove them */
const MERGED = { sponsorBlock: 'mnjggcdmjocbbbhaepdhchncahnbgone', cleanYT: 'kalhfjomailhflienkfajocjodgjipie', ambient: 'paponcgjfojgemddooebbgniglhkajkj' };
function mergeBuiltInExtensions() {
  if (settings.data.mergedExt) return;
  const ud = app.getPath('userData');
  const local = id => CI.readExtStorage(path.join(ud, 'Local Extension Settings', id));
  const chromeStore = (kind, id) => { for (const p of CI.profiles(app)) { const s = CI.readExtStorage(path.join(p, kind, id)); if (Object.keys(s).length) return s; } return {}; };
  try {
    let cy = local(MERGED.cleanYT); if (!Object.keys(cy).length) cy = chromeStore('Sync Extension Settings', MERGED.cleanYT);
    const clean = FEAT.cleanFromExtension(cy);
    if (Object.keys(clean).length) settings.data.ytClean = Object.assign({}, settings.data.ytClean, clean);
  } catch (e) {}
  try {
    let am = local(MERGED.ambient); if (!Object.keys(am).length) am = chromeStore('Local Extension Settings', MERGED.ambient);
    if (Object.keys(am).length) { const st = makeStore('ambient-light.json', {}); if (!Object.keys(st.data).length) { st.data = am; st.flush(); } ambientStore = st; }
  } catch (e) {}
  const ids = Object.values(MERGED);
  settings.data.extensions = (settings.data.extensions || []).filter(p => !ids.some(id => p.includes(id)));
  settings.data.pinnedExt = (settings.data.pinnedExt || []).filter(id => !ids.includes(id));
  for (const id of ids) { try { fs.rmSync(path.join(extRoot(), id), { recursive: true, force: true }); } catch (e) {} }
  settings.data.mergedExt = true; settings.save();
}

/* ---------- IPC ---------- */
const uiWin = e => winOfUi(e.sender);
const internalPage = e => { try { return isInternal(e.senderFrame.url); } catch (x) { return false; } };
const settingsPage = e => { try { return isSettings(e.senderFrame.url); } catch (x) { return false; } };

function setupIpc() {
  ipcMain.on('ui:height', (e, h) => {
    const w = uiWin(e); if (!w) return;
    w.stripH = Math.max(40, Math.min(140, +h || 56));
    w.layout();
    // the new tab page moves its shortcuts bar under the toolbar
    for (const t of w.tabs) if (t.view && isNewtab(t.url)) t.view.webContents.send('strip', w.stripH);
  });
  ipcMain.on('ui:expand', (e, on) => { const w = uiWin(e); if (!w) return; w.uiExpanded = typeof on === 'number' ? on : !!on; w.layout(); });
  ipcMain.on('win', (e, cmd) => {
    const w = uiWin(e); if (!w) return;
    if (cmd === 'min') w.win.minimize();
    else if (cmd === 'max') w.win.isMaximized() ? w.win.unmaximize() : w.win.maximize();
    else if (cmd === 'close') w.win.close();
  });

  ipcMain.on('tab', (e, cmd, arg) => {
    const w = uiWin(e); if (!w) return;
    const t = w.active(), wc = t && t.view && t.view.webContents;
    switch (cmd) {
      case 'new': w.createTab(); break;
      case 'activate': w.activate(arg); break;
      case 'close': w.closeTab(arg); break;
      case 'reopen': reopenClosed(w); break;
      case 'back': if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
      case 'forward': if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
      case 'reload': if (wc) wc.reload(); break;
      case 'stop': if (wc) wc.stop(); break;
      case 'go': navigate(w, arg && arg.text, arg && arg.newTab); break;
      case 'bookmark': toggleBookmark(w); break;
      case 'zoom': zoom(w, arg); break;
      case 'zoomReset': if (wc) { wc.setZoomFactor(1); w.pushState(); } break;
      case 'focusPage': if (wc) wc.focus(); break;
      case 'translate': translate(w); break;
      case 'mute': { const x = w.tab(arg); if (x) toggleMute(x); break; }
      case 'menu': tabMenu(w, arg); break;
      case 'history': w.createTab(HISTORY_URL); break;
      case 'print': if (wc) wc.print({}, () => {}); break;
      case 'tasks': openTasks(w); break;
      case 'passwords': { const ex = allTabs().find(x => isPasswords(x.url)); if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(PASSWORDS_URL); break; }
      case 'settings': { const ex = allTabs().find(x => isSettings(x.url)); if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(SETTINGS_URL); break; }
      case 'adSite': {   // turn the blocker off / on for the current site, then reload it
        if (!t || !/^https?:/i.test(t.url)) break;
        const site = AdBlocker.site(hostOf(t.url)); const list = settings.data.adAllow;
        const i = list.indexOf(site); if (i >= 0) list.splice(i, 1); else list.push(site);
        settings.save(); if (wc) wc.reload(); w.pushState(); break;
      }
      case 'store': { const ex = allTabs().find(x => /^https:\/\/chromewebstore\.google\.com\//.test(x.url || '')); if (ex) { ex.win.activate(ex.id); ex.win.win.focus(); } else w.createTab(STORE_URL); break; }
      case 'newWindow': newWindow(); break;
      case 'incognito': newWindow({ private: true }); break;
      case 'move': {   // reorder inside this window: arg = {id, to}
        const i = w.tabs.findIndex(x => x.id === arg.id); if (i < 0) break;
        const [x] = w.tabs.splice(i, 1);
        const pins = w.tabs.filter(t => t.pinned).length;
        let to = Math.max(0, Math.min(w.tabs.length, arg.to));
        to = x.pinned ? Math.min(to, pins) : Math.max(to, pins);   // a pinned tab stays with the pinned ones
        w.tabs.splice(to, 0, x);
        w.pushState(); saveSessionSoon(); break;
      }
    }
  });

  /* find in page */
  ipcMain.on('find', (e, a) => {
    const w = uiWin(e); const t = w && w.active(); const wc = t && t.view && t.view.webContents; if (!wc) return;
    if (!a || !a.text) { wc.stopFindInPage('clearSelection'); w.ui.webContents.send('found', { active: 0, matches: 0 }); return; }
    w.findText = a.text;   // F3 / Ctrl+G find the next one
    wc.findInPage(a.text, { forward: a.forward !== false, findNext: !!a.next });
  });
  ipcMain.on('find:stop', e => { const w = uiWin(e); if (w) w.findText = ''; const t = w && w.active(); if (t && t.view) t.view.webContents.stopFindInPage('clearSelection'); });

  /* tab dragged out of the strip: split into its own window, follow the mouse */
  ipcMain.on('tab:dragout', (e, a) => {
    const w = uiWin(e);
    if (process.env.ZEUS_DEBUG) console.log('[drag] out', a, !!w, !!tabDrag);
    if (!w || tabDrag) return;
    const t = w.tab(a.id); if (!t) return;
    const p = screen.getCursorScreenPoint();
    let mover;
    if (w.tabs.length === 1) {
      mover = w;                       // only tab: the whole window moves
      if (w.win.isMaximized()) w.win.unmaximize();
      if (w.win.isFullScreen()) w.win.setFullScreen(false);
    } else {
      mover = detachToNewWindow(t, { x: p.x - 200, y: p.y - 20 });
    }
    const b = mover.win.getBounds();
    // keep the mouse over the tab's spot in the new window (roughly the strip, near the middle)
    const offX = Math.min(b.width - 60, Math.max(60, a.offX != null ? a.offX : b.width / 2));
    tabDrag = { mover, tabId: t.id, offX, offY: 22, hover: null, source: w };
    tabDrag.timer = setInterval(dragTick, 8);
    dragTick();
    // the moving window sits under the mouse, so on Windows it is the one that hears the button being let go
    try { mover.ui.webContents.send('being-moved', true); } catch (err) {}
  });
  ipcMain.on('tab:dragend', async () => {
    const d = stopTabDrag(); if (!d) return;
    const p = screen.getCursorScreenPoint();
    const target = stripHit(p, d.mover);
    const t = d.mover.tab(d.tabId);
    if (target && t && d.mover.tabs.length === 1) {
      let index = target.tabs.length;
      try { index = await target.ui.webContents.executeJavaScript(`tabIndexAt(${p.x - target.win.getContentBounds().x})`); } catch (err) {}
      d.mover.releaseTab(t);
      target.adoptTab(t, index);
      d.mover.win.close();
      target.win.focus();
    } else if (!d.mover.win.isDestroyed()) {
      const z = snapZone(p);
      if (z && z.max) d.mover.win.maximize();
      else if (z) d.mover.win.setBounds({ x: z.x, y: z.y, width: z.width, height: z.height });
      d.mover.win.show(); d.mover.win.focus();
    }
    saveSessionSoon();
  });

  ipcMain.on('set', (e, key, val) => {
    const dlPage = (() => { try { return isDownloads(e.senderFrame.url); } catch (x) { return false; } })();
    if (!uiWin(e) && !settingsPage(e) && !(internalPage(e) && key === 'lang') && !(dlPage && key === 'dlAsk')) return;
    if (key === 'perfMode' && ['normal', 'fast'].includes(val)) settings.data.perfMode = val;
    if (key === 'sponsorBlock') settings.data.sponsorBlock = !!val;
    if (key === 'sbCats' && Array.isArray(val)) settings.data.sbCats = val.filter(c => FEAT.SB_CATS.includes(c));
    if (key === 'ambient') settings.data.ambient = !!val;
    if (key === 'twitchAds') settings.data.twitchAds = !!val;
    if (key === 'ytClean' && val && typeof val === 'object') { const o = {}; for (const k of Object.keys(FEAT.YT_CLEAN)) if (val[k]) o[k] = true; settings.data.ytClean = o; pushSiteCfg(); }
    if (key === 'lang' && (val === 'ar' || val === 'en')) settings.data.lang = val;
    if (key === 'memorySaverMin' && [0, 5, 15, 30, 60].includes(+val)) settings.data.memorySaverMin = +val;
    if (key === 'restoreTabs') settings.data.restoreTabs = !!val;
    if (key === 'hwAccel') settings.data.hwAccel = !!val;
    if (key === 'darkPages') settings.data.darkPages = !!val;
    if (key === 'siteFont') { settings.data.siteFont = !!val; for (const t of allTabs()) applySiteFont(t); }
    if (key === 'adblock') settings.data.adblock = !!val;
    if (key === 'ytAds') settings.data.ytAds = !!val;
    if (key === 'dlAsk') settings.data.dlAsk = !!val;
    if (key === 'passkeys') settings.data.passkeys = !!val;
    settings.save(); settings.flush();
    for (const w of wins) w.pushState();
    settingsChanged();
    if (key === 'lang') { for (const t of allTabs()) if (t.view && isInternal(t.url)) t.view.webContents.send('lang', settings.data.lang); for (const mw of mediaWins.values()) mw.webContents.send('lang', settings.data.lang); }
  });

  ipcMain.handle('ext:list', e => (uiWin(e) ? listExtensions() : []));
  ipcMain.handle('ext:add', async e => {
    const w = uiWin(e); if (!w) return { ok: false };
    const r = await dialog.showOpenDialog(w.win, { title: T('اختر مجلد الإضافة', 'Choose the extension folder'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const dst = await addExtensionFolder(r.filePaths[0]);
      const ext = await loadExtensionDir(dst);
      const list = settings.data.extensions.filter(p => p !== ext.path); list.push(ext.path);
      settings.data.extensions = list; settings.save();
      return { ok: true, name: ext.name };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('ext:remove', (e, id) => (uiWin(e) ? removeExtension(id) : false));
  ipcMain.on('ext:popup', (e, a) => { const w = uiWin(e); if (w && a && a.id) openExtPopup(w, a.id, a.rect || { x: 0, y: 0, w: 0, h: 40 }); });
  ipcMain.on('ext:popupClose', e => { if (uiWin(e)) closeExtPopup(); });
  ipcMain.on('ext:pin', (e, id) => {
    if (!uiWin(e)) return;
    const l = settings.data.pinnedExt || (settings.data.pinnedExt = []);
    const i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id);
    settings.save(); for (const w of wins) w.pushState();
  });
  ipcMain.handle('ext:importChrome', async e => {
    if (!uiWin(e)) return null;
    for (const x of extApi().getAllExtensions()) if (x.path.startsWith(extRoot()) && !x.path.includes(path.sep + 'manual' + path.sep)) { try { extApi().removeExtension(x.id); } catch (err) {} }
    const r = importChromeExtensions();
    for (const p of settings.data.extensions) { try { await loadExtensionDir(p); } catch (err) {} }
    for (const w of wins) w.pushState();
    return { imported: r.imported.map(x => x.name), skipped: r.skipped.map(x => ({ name: x.name, reason: x.reason })) };
  });
  ipcMain.on('ext:options', (e, url) => { const w = uiWin(e); if (w && /^chrome-extension:\/\//.test(url)) w.createTab(url); });

  ipcMain.handle('bm:import', e => (uiWin(e) ? importChromeBookmarks() : 0));
  ipcMain.handle('bm:get', e => (internalPage(e) || uiWin(e) ? bookmarks.data : { children: [] }));
  ipcMain.handle('fav:get', (e, urls) => {
    if (!internalPage(e) || !Array.isArray(urls)) return {};
    const out = {}; for (const u of urls.slice(0, 500)) { const f = cachedFavicon(u); if (f) out[u] = f; }
    return out;
  });
  ipcMain.handle('ntp:take', e => { if (!internalPage(e) || !pendingImport) return null; const p = pendingImport; pendingImport = null; return p; });
  ipcMain.handle('ntp:import', e => (uiWin(e) ? prepareNewtabImport() : false));

  ipcMain.handle('history:search', (e, text, max) => {
    if (!internalPage(e) && !uiWin(e)) return [];
    const q = String(text || '').toLowerCase(), out = [], seen = new Set();
    const h = history.data;
    for (let i = h.length - 1; i >= 0 && out.length < (max || 600); i--) {
      const it = h[i];
      if (q && !(it.url.toLowerCase().includes(q) || (it.title || '').toLowerCase().includes(q) || safeDecode(it.url).toLowerCase().includes(q))) continue;
      if (seen.has(it.url)) continue; seen.add(it.url);
      out.push({ url: it.url, title: it.title, lastVisitTime: it.t, favicon: cachedFavicon(it.url) });
    }
    return out;
  });
  ipcMain.handle('history:delete', (e, url) => {
    if (!internalPage(e)) return false;
    history.data = history.data.filter(x => x.url !== url); return true;
  });
  ipcMain.handle('history:clear', e => { if (!internalPage(e)) return false; history.data = []; history.flush(); return true; });

  // warm up a connection to a site you are about to open (link under the mouse, address being typed)
  const warmed = new Map();
  ipcMain.on('net:warm', (e, origin) => {
    const w = uiWin(e), t = w ? w.active() : tabOfWc(e.sender);
    if (!t || !t.view || t.view.webContents.isDestroyed()) return;
    let u; try { u = new URL(String(origin)); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    if (adblock && settings.data.adblock !== false && adblock.shouldBlock(u.origin + '/', t.url)) return;   // never for ad/tracker hosts
    const now = Date.now(), last = warmed.get(u.origin) || 0;
    if (now - last < 20000) return;
    warmed.set(u.origin, now); if (warmed.size > 300) warmed.clear();
    try { t.view.webContents.session.preconnect({ url: u.origin, numSockets: 1 }); } catch (x) {}
  });
  // your own past searches (typed in the address bar or on Google), newest first
  ipcMain.handle('search:history', (e, text, max) => {
    if (!uiWin(e)) return [];
    // the searches you make most often first, then the latest ones
    const q = String(text || '').trim().toLowerCase(), n = max || 6;
    const all = new Map();   // key -> { s, count, last }
    for (const it of history.data) {
      if (!/^https:\/\/(www\.)?google\.[a-z.]+\/search\?/i.test(it.url)) continue;
      let s = '', sp = null; try { sp = new URL(it.url).searchParams; s = (sp.get('q') || '').trim(); } catch (x) {}
      // only real searches: no Google AI Mode chats (udm=50), no long questions
      if (!s || sp.get('udm') === '50' || s.length > 90) continue;
      const k = s.toLowerCase(); if (q && !k.includes(q)) continue;
      const e = all.get(k) || { s, count: 0, last: 0 };
      // Google rewrites the address a few times for one search: visits within 10 minutes count once
      if ((it.t || 0) - e.last > 10 * 60 * 1000) e.count++;
      e.last = Math.max(e.last, it.t || 0); all.set(k, e);
    }
    const list = [...all.values()];
    const often = list.filter(e => e.count >= 2).sort((a, b) => b.count - a.count || b.last - a.last).slice(0, Math.ceil(n / 2));
    const recent = list.filter(e => !often.includes(e)).sort((a, b) => b.last - a.last);
    return [...often, ...recent].slice(0, n).map(e => e.s);
  });
  ipcMain.handle('suggest', async (e, q, hl) => {
    if (!internalPage(e) && !uiWin(e)) return [];
    try {
      // ie/oe=utf-8: without them Arabic suggestions came back in another text encoding and were lost
      const r = await net.fetch('https://suggestqueries.google.com/complete/search?client=firefox&ie=utf-8&oe=utf-8&hl=' + (hl === 'en' ? 'en' : 'ar') + '&q=' + encodeURIComponent(String(q || '')));
      const j = JSON.parse(new TextDecoder('utf-8').decode(await r.arrayBuffer())); return Array.isArray(j[1]) ? j[1].slice(0, 8) : [];
    } catch (err) { return []; }
  });
  ipcMain.handle('lang:get', () => settings.data.lang);
  ipcMain.handle('tasks:get', e => (internalPage(e) ? taskRows() : null));
  ipcMain.handle('tasks:sleep', (e, id) => {
    if (!internalPage(e)) return false;
    const t = allTabs().find(x => x.id === id); if (!t) return false;
    if (t.id === t.win.activeId) return false;
    discard(t); return true;
  });

  ipcMain.on('misc', (e, cmd) => { const w = uiWin(e); if (w) runMisc(w, cmd); });
  setupSettingsIpc();
  setupDownloadIpc(); setupMediaIpc();
  ipcMain.on('download:show', (e, p) => { if (uiWin(e) && typeof p === 'string') shell.showItemInFolder(p); });
}
async function runMisc(w, cmd) {
  {
    const t = w.active();
    if (cmd === 'downloads') openDownloads(w);
    if (cmd === 'makeDefault') makeDefault();
    if (cmd === 'devtools' && t && t.view) t.view.webContents.toggleDevTools();
    if (cmd === 'fullscreen') w.win.setFullScreen(!w.win.isFullScreen());
    if (cmd === 'relaunch') { quitting = true; saveSession(); for (const s of stores()) s.flush(); app.relaunch(); app.exit(0); }
    if (cmd === 'clearData') {
      const r = await dialog.showMessageBox(w.win, {
        type: 'warning', buttons: [T('مسح', 'Clear'), T('إلغاء', 'Cancel')], defaultId: 1, cancelId: 1, title: '3zT',
        message: T('مسح السجل والكاش والكوكيز؟ (بيطلعك من حساباتك في المواقع)', 'Clear history, cache and cookies? (signs you out of sites)')
      });
      if (r.response !== 0) return;
      history.data = []; history.flush();
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({ storages: ['cookies', 'cachestorage', 'serviceworkers', 'shadercache', 'websql'] });
      return true;
    }
  }
}

/* ---------- settings page (3zt://settings) ---------- */
function removeExtension(id) {
  const ext = extApi().getExtension(id); if (!ext) return false;
  extApi().removeExtension(id);
  settings.data.extensions = settings.data.extensions.filter(p => p !== ext.path);
  settings.data.pinnedExt = (settings.data.pinnedExt || []).filter(x => x !== id);
  settings.save();
  if (ext.path.startsWith(extRoot())) { try { fs.rmSync(ext.path, { recursive: true, force: true }); } catch (err) {} }
  if (isStoreExt(ext)) { try { fs.rmSync(path.join(storeRoot(), id), { recursive: true, force: true }); } catch (err) {} }
  // like Chrome: removing an extension also removes what it saved
  session.defaultSession.clearStorageData({ origin: `chrome-extension://${id}` }).catch(() => {});
  setTimeout(() => { for (const k of ['Local Extension Settings', 'Sync Extension Settings', 'Managed Extension Settings']) { try { fs.rmSync(path.join(app.getPath('userData'), k, id), { recursive: true, force: true }); } catch (err) {} } }, 1500);
  for (const w of wins) w.pushState();
  return true;
}
function settingsChanged() {
  for (const t of allTabs()) if (t.view && isSettings(t.url) && !t.view.webContents.isDestroyed()) t.view.webContents.send('settings:changed');
}
function setupSettingsIpc() {
  ipcMain.handle('settings:get', e => {
    if (!settingsPage(e)) return null;
    const d = settings.data;
    return {
      lang: d.lang, perfMode: d.perfMode || 'normal', perfActive: FAST ? 'fast' : 'normal',
      memorySaverMin: d.memorySaverMin, hwAccel: d.hwAccel !== false, hwAccelActive: early.hwAccel !== false, darkPages: d.darkPages !== false, darkPagesActive: DARK_PAGES, siteFont: !!d.siteFont, restoreTabs: !!d.restoreTabs,
      adblock: d.adblock !== false, ytAds: d.ytAds !== false, twitchAds: d.twitchAds !== false, adAllow: d.adAllow || [],
      blockedTotal: d.adBlockedTotal || 0, adRules: adblock ? adblock.ruleCount : 0,
      sponsorBlock: d.sponsorBlock !== false, sbCats: d.sbCats || [], ambient: d.ambient !== false, ytClean: d.ytClean || {},
      passkeys: !!d.passkeys, dlAsk: d.dlAsk !== false, dlDir: dl ? dl.folder() : '', canDefault: process.platform === 'win32', isDefault: isDefaultCache,
      perms: perms ? perms.all() : [],
      extensions: listExtensions(), versions: { app: app.getVersion(), chrome: process.versions.chrome }
    };
  });
  ipcMain.handle('settings:act', async (e, cmd, arg) => {
    if (!settingsPage(e)) return null;
    const t = tabOfWc(e.sender), w = t ? t.win : focusedWin();
    switch (cmd) {
      case 'makeDefault': makeDefault(); return true;
      case 'relaunch': if (w) runMisc(w, 'relaunch'); return true;
      // "Check for updates": looks now instead of waiting; a found update is downloaded and checked right away
      case 'checkUpdate': {
        if (!UPD.installed() && !process.env.ZEUS_UPDATE_URL) return { state: 'portable' };
        return UPD.check();
      }
      // install it now: the browser closes, the update goes in, and 3zT opens again by itself
      case 'installUpdate': { app.relaunch(); app.quit(); return true; }
      case 'clearData': return w ? runMisc(w, 'clearData') : false;
      case 'importBookmarks': return importChromeBookmarks();
      case 'importLook': return prepareNewtabImport();
      case 'extRemove': { const r = removeExtension(arg); settingsChanged(); return r; }
      case 'extImport': {
        for (const x of extApi().getAllExtensions()) if (x.path.startsWith(extRoot()) && !x.path.includes(path.sep + 'manual' + path.sep)) { try { extApi().removeExtension(x.id); } catch (err) {} }
        const r = importChromeExtensions();
        for (const p of settings.data.extensions) { try { await loadExtensionDir(p); } catch (err) {} }
        for (const x of wins) x.pushState(); settingsChanged();
        return { imported: r.imported.map(x => x.name) };
      }
      case 'openStore': if (w) w.createTab(STORE_URL); return true;
      case 'permSet': {   // arg: JSON {origin, kind, value}
        let o = null; try { o = JSON.parse(arg); } catch (x) {}
        if (!o || !PERM.originOf(o.origin) || !PERM.KINDS[o.kind]) return false;
        perms.set(PERM.originOf(o.origin), o.kind, o.value === 'allow' || o.value === 'block' ? o.value : null);
        settingsChanged(); return true;
      }
      case 'permClear': { const o = PERM.originOf(arg || ''); if (!o) return false; perms.clearSite(o); settingsChanged(); return true; }
      case 'extOptions': if (w && /^chrome-extension:\/\//.test(arg || '')) w.createTab(arg); return true;
      case 'unallow': settings.data.adAllow = settings.data.adAllow.filter(x => x !== arg); settings.save(); settingsChanged(); for (const x of wins) x.pushState(); return true;
      case 'open': {
        if (!w) return false;
        if (arg === 'tasks') openTasks(w);
        else if (arg === 'history') w.createTab(HISTORY_URL);
        else if (arg === 'passwords') { const ex = allTabs().find(x => isPasswords(x.url)); if (ex) ex.win.activate(ex.id); else w.createTab(PASSWORDS_URL); }
        return true;
      }
      case 'downloads': if (w) openDownloads(w); return true;
      case 'dlFolder': {
        const r = await dialog.showOpenDialog(w ? w.win : undefined, { title: T('اختر مجلد التنزيلات', 'Choose the downloads folder'), defaultPath: dl.folder(), properties: ['openDirectory', 'createDirectory'] });
        if (!r.canceled && r.filePaths[0]) { settings.data.dlDir = r.filePaths[0]; settings.save(); settingsChanged(); }
        return true;
      }
    }
    return null;
  });
}

/* ---------- start ---------- */
/* ---------- default browser (Windows) ---------- */
// a link or file Windows hands us on the command line ("3zT.exe" "https://...")
function urlFromArgv(argv) {
  for (const a of argv.slice(1)) {
    if (!a || a.startsWith('-')) continue;
    if (/^(https?|ftp|file):/i.test(a)) return a;
    if (/\.(html?|xhtml|pdf|svg|webp|mht(ml)?)$/i.test(a) && fs.existsSync(a)) return pathToFileURL(a).href;
  }
  return '';
}
const PROGID = '3zTBrowserHTML', APPKEY = 'Software\\Clients\\StartMenuInternet\\3zT Browser';
function reg(args) {
  return new Promise(res => { try { const p = spawn('reg', args, { windowsHide: true }); let out = ''; p.stdout.on('data', d => out += d); p.on('close', c => res(c === 0 ? out : null)); p.on('error', () => res(null)); } catch (e) { res(null); } });
}
// tell Windows we are a browser (current user only, no admin needed)
async function registerBrowser() {
  if (process.platform !== 'win32') return false;
  const exe = process.execPath, cmd = `"${exe}" "%1"`, ico = `"${exe}",0`;
  const K = 'HKCU\\' + APPKEY, C = 'HKCU\\Software\\Classes\\' + PROGID;
  const add = (key, name, val) => reg(['add', key, ...(name ? ['/v', name] : ['/ve']), '/t', 'REG_SZ', '/d', val, '/f']);
  const jobs = [
    add(C, '', '3zT HTML Document'), add(C + '\\DefaultIcon', '', ico), add(C + '\\shell\\open\\command', '', cmd),
    add(C + '\\Application', 'ApplicationName', '3zT'), add(C + '\\Application', 'ApplicationIcon', ico),
    add(K, '', '3zT'), add(K + '\\DefaultIcon', '', ico), add(K + '\\shell\\open\\command', '', `"${exe}"`),
    add(K + '\\Capabilities', 'ApplicationName', '3zT'), add(K + '\\Capabilities', 'ApplicationIcon', ico),
    add(K + '\\Capabilities', 'ApplicationDescription', 'A light browser built on Chromium'),
    add(K + '\\Capabilities\\StartMenu', 'StartMenuInternet', '3zT Browser'),
    add('HKCU\\Software\\RegisteredApplications', '3zT Browser', APPKEY + '\\Capabilities')
  ];
  for (const p of ['http', 'https', 'ftp']) jobs.push(add(K + '\\Capabilities\\URLAssociations', p, PROGID));
  for (const x of ['.htm', '.html', '.xhtml', '.pdf', '.svg', '.webp', '.shtml', '.mht', '.mhtml']) jobs.push(add(K + '\\Capabilities\\FileAssociations', x, PROGID));
  const ok = (await Promise.all(jobs)).every(Boolean);
  if (ok) { settings.data.registeredExe = exe; settings.save(); }
  return ok;
}
let isDefaultCache = false;
async function checkDefault() {
  if (process.platform !== 'win32') return false;
  const q = k => reg(['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\' + k, '/v', 'ProgId']);
  const out = (await q('UserChoice')) || (await q('UserChoiceLatest'));
  const v = !!(out && out.includes(PROGID));
  if (v !== isDefaultCache) { isDefaultCache = v; for (const w of wins) w.pushState(); }
  return v;
}
async function makeDefault() {
  await registerBrowser();
  // Windows only lets the user pick the default browser: open the settings page for our app
  shell.openExternal('ms-settings:defaultapps?registeredAppUser=' + encodeURIComponent('3zT Browser'));
  let n = 0; const iv = setInterval(() => { checkDefault(); if (++n > 40) clearInterval(iv); }, 3000);   // notice when they switch
}

app.on('second-instance', (e, argv) => {
  const w = focusedWin();
  const u = urlFromArgv(argv);
  if (!w) { newWindow({ url: u }); return; }
  if (w.win.isMinimized()) w.win.restore();
  w.win.focus();
  if (u) w.createTab(u);
});
app.on('before-quit', () => { if (!quitting) { quitting = true; saveSession(); } for (const s of stores()) s.flush(); if (media) media.close(); });
// a downloaded update is installed silently once the browser has closed
app.on('will-quit', () => { if (gotLock) { try { UPD.installOnQuit(); } catch (e) {} } });   // never from a second copy that is only handing over a link

app.whenReady().then(async () => {
  // dark everywhere: sites, error pages, scrollbars, form controls, the PDF viewer, menus
  nativeTheme.themeSource = DARK_PAGES ? 'dark' : 'system';
  if (process.env.ZEUS_TIMING) console.log('[timing] ready', Math.round(performance.now()), 'ms');
  Menu.setApplicationMenu(null);
  settings = makeStore('settings.json', {
    lang: 'ar', memorySaverMin: 15, restoreTabs: true, extensions: [], bookmarksImported: false,
    favImported: false, ntpImported: false, hwAccel: true,
    adblock: true, adAllow: [], adBlockedTotal: 0,
    ytAds: true, dlAsk: true, pinnedExt: [], extImported: false, pwNever: [],
    perfMode: 'normal', sponsorBlock: true, sbCats: ['sponsor', 'selfpromo', 'interaction'], ambient: true, twitchAds: true, ytClean: {}, mergedExt: false
  });
  bookmarks = makeStore('bookmarks.json', { children: [] });
  history = makeStore('history.json', []);
  sessionStore = makeStore('session.json', { windows: [] });
  favStore = makeStore('favicons.json', {});
  dl = new DownloadManager({ app, store: makeStore('downloads.json', []), settings, notify: dlNotify });

  // first run (or first run of this version): bring things over from Chrome
  if (!settings.data.bookmarksImported) { try { importChromeBookmarks(); } catch (e) {} settings.data.bookmarksImported = true; settings.data.favImported = true; }
  if (!settings.data.favImported) { try { importChromeFavicons(); } catch (e) {} settings.data.favImported = true; }
  if (!settings.data.ntpImported) { prepareNewtabImport(); settings.data.ntpImported = true; }
  settings.save();

  adblock = new AdBlocker(path.join(app.getPath('userData'), 'adblock'));
  // get the full lists in the background (refreshed every few days)
  const refreshLists = () => adblock.refresh(u => net.fetch(u)).then(() => { for (const w of wins) w.pushState(); }).catch(() => {});
  setTimeout(refreshLists, 4000);
  setInterval(refreshLists, 6 * 3600 * 1000);
  perms = new PERM.Permissions({ settings, onChange: () => { for (const w of wins) w.pushState(); } });
  setupSession(session.defaultSession);
  setupIpc();
  setupPermissionIpc();
  passwords = new PW.PasswordStore(path.join(app.getPath('userData'), 'passwords.json'), safeStorage);
  setupPasswordIpc();
  // re-patch the copies already on disk when the patcher improves (also refreshes the shim)
  if ((settings.data.extPatchLevel || 0) < 2) {
    try {
      for (const sub of ['', 'manual']) {
        const base = path.join(extRoot(), sub);
        let names = []; try { names = fs.readdirSync(base); } catch (e) {}
        for (const n of names) { const d = path.join(base, n); if (fs.existsSync(path.join(d, 'manifest.json'))) { try { EXT.patch(d, SHIM); } catch (e) {} } }
      }
    } catch (e) {}
    settings.data.extPatchLevel = 2; settings.save();
  }
  if (!settings.data.extImported) {
    try { const r = importChromeExtensions(); console.log('[3zT] extensions imported:', r.imported.map(x => x.name).join(', ')); } catch (e) { console.warn('extension import failed', e.message); }
    settings.data.extImported = true; settings.save();
  }
  try { mergeBuiltInExtensions(); } catch (e) { console.warn('merge failed', e.message); }
  // all extensions load at the same time (not one after another): the window opens sooner
  await Promise.all([
    ...settings.data.extensions.slice().map(p => loadExtensionDir(p).catch(e => console.warn('extension failed', p, e.message))),
    // extensions from the Chrome Web Store (installs, loads and keeps them updated)
    setupWebStore().catch(e => console.warn('web store failed', e.message))
  ]);
  // a new extension (from the store or anywhere): refresh the bar and the settings page
  try { extApi().on('extension-loaded', () => { for (const w of wins) w.pushState(); settingsChanged(); }); extApi().on('extension-unloaded', () => { for (const w of wins) w.pushState(); settingsChanged(); }); } catch (e) {}

  // closed tabs from before the restart
  for (const c of (Array.isArray(sessionStore.data.closed) ? sessionStore.data.closed : [])) if (c && (c.url || Array.isArray(c.group))) closedStack.push(c);
  // restore windows (old single-window format supported too)
  let saved = sessionStore.data.windows;
  if (!saved && sessionStore.data.tabs) saved = [{ tabs: sessionStore.data.tabs, active: sessionStore.data.active, bounds: settings.data.bounds, maximized: settings.data.maximized }];
  if (settings.data.restoreTabs && saved && saved.length && saved.some(s => s.tabs && s.tabs.length)) {
    for (const s of saved) {
      if (!s.tabs || !s.tabs.length) continue;
      const w = new Win({ bounds: s.bounds, maximized: s.maximized });
      const act = Math.min(s.active || 0, s.tabs.length - 1);
      s.tabs.forEach((t, i) => w.createTab(t.url || NEWTAB_URL, i === act ? { activate: false, pinned: !!t.pinned } : { activate: false, discarded: true, title: t.title, pinned: !!t.pinned }));
      w.activate(w.tabs[act].id);
    }
  } else {
    // not restored: what was open last time is the first thing Ctrl+Shift+T brings back
    const last = (saved || []).flatMap(s => (s.tabs || []).map(t => ({ url: t.url, title: t.title }))).filter(t => t.url && !isInternal(t.url));
    if (last.length) { closedStack.push({ group: last }); if (closedStack.length > 25) closedStack.shift(); }
    newWindow({ bounds: settings.data.bounds, maximized: settings.data.maximized, url: urlFromArgv(process.argv) || undefined });
  }
  // opened by Windows with a link while restoring tabs: show the link too
  const startUrl = urlFromArgv(process.argv);
  if (startUrl && settings.data.restoreTabs && wins.length && !wins[0].tabs.some(t => t.url === startUrl)) wins[0].createTab(startUrl);
  // keep the Windows registration pointing at this copy if the folder was moved
  if (settings.data.registeredExe && settings.data.registeredExe !== process.execPath) registerBrowser();
  setTimeout(checkDefault, 4000);
  // just updated: a short green note in the bar, with the release notes behind "Details"
  try {
    const u = UPD.takeUpdated(settings.data.lang === 'en' ? 'en' : 'ar');
    const w = wins[0];
    if (u && w) {
      const send = () => { if (!w.ui.webContents.isDestroyed()) w.ui.webContents.send('updated', u); };
      if (w.ui.webContents.isLoading()) w.ui.webContents.once('did-finish-load', () => setTimeout(send, 700)); else setTimeout(send, 700);
    }
  } catch (e) {}
  // look for updates in the background (installed copies only)
  UPD.start({ log: (...a) => console.log('[3zT]', ...a) });
});

app.on('window-all-closed', () => app.quit());
