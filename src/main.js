'use strict';
/*
 * 3zT Browser - main process
 * One frameless window. Each tab is a WebContentsView. The floating toolbar is a
 * transparent WebContentsView laid on top of the active tab.
 */
const {
  app, BaseWindow, WebContentsView, ipcMain, Menu, session, dialog,
  screen, net, shell, clipboard, nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

app.setName('3zT Browser');
if (process.platform === 'win32') app.setAppUserModelId('com.3zo.3ztbrowser');

/* ---------- lighter Chromium ---------- */
// no idle "spare" renderer process kept around for the next tab
app.commandLine.appendSwitch('disable-features', [
  'SpareRendererForSitePerProcess',
  'MediaRouter',
  'OptimizationHints',
  'Translate'
].join(','));

/* a plain Chrome user agent (no "Electron/x" token) so sites treat us like Chrome */
(() => {
  const major = (process.versions.chrome || '140').split('.')[0];
  const plat = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : 'X11; Linux x86_64';
  app.userAgentFallback = `Mozilla/5.0 (${plat}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
})();

if (!app.requestSingleInstanceLock()) { app.quit(); }

/* ---------- paths ---------- */
const SRC = __dirname;
const NEWTAB_FILE = path.join(SRC, 'newtab', 'newtab.html');
const NEWTAB_URL = pathToFileURL(NEWTAB_FILE).href;
const UI_FILE = path.join(SRC, 'ui', 'toolbar.html');
const PRELOAD_UI = path.join(SRC, 'preload-ui.js');
const PRELOAD_TAB = path.join(SRC, 'preload-newtab.js');
const ICON = path.join(SRC, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

const STRIP = 56;            // height of the toolbar strip
const isNewtab = u => !u || u === NEWTAB_URL || u.startsWith(NEWTAB_URL + '#') || u.startsWith(NEWTAB_URL + '?');

/* ---------- tiny JSON store (data + debounced, atomic save) ---------- */
let settings, bookmarks, history, sessionStore;
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
  return {
    get data() { return data; },
    set data(v) { data = v; this.save(); },
    save() { if (!t) t = setTimeout(flush, 800); },
    flush
  };
}

/* ---------- state ---------- */
let win = null, ui = null;
let tabs = [];               // {id, view, url, title, favicon, loading, discarded, lastActive}
let activeId = null;
let nextId = 1;
let uiExpanded = false;
let htmlFullscreen = false;
const closedStack = [];
let stateTimer = null;

const T = (ar, en) => (settings.data.lang === 'en' ? en : ar);
const active = () => tabs.find(t => t.id === activeId) || null;
const byWc = wc => tabs.find(t => t.view && t.view.webContents === wc);

/* ---------- layout ---------- */
function layout() {
  if (!win || win.isDestroyed()) return;
  const { width: w, height: h } = win.getContentBounds();
  const t = active();
  const full = htmlFullscreen;
  if (t && t.view) {
    const flush = full || isNewtab(t.url);
    t.view.setBounds(flush ? { x: 0, y: 0, width: w, height: h } : { x: 0, y: STRIP, width: w, height: Math.max(0, h - STRIP) });
  }
  if (ui) {
    ui.setVisible(!full);
    const uh = uiExpanded === true ? h : typeof uiExpanded === 'number' ? Math.min(h, uiExpanded) : STRIP;
    ui.setBounds({ x: 0, y: 0, width: w, height: uh });
  }
}

/* ---------- state sent to the toolbar ---------- */
function pushState() {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    if (!ui || ui.webContents.isDestroyed()) return;
    const t = active();
    const wc = t && t.view ? t.view.webContents : null;
    const url = t ? t.url : '';
    ui.webContents.send('state', {
      tabs: tabs.map(x => ({
        id: x.id, title: x.title || (isNewtab(x.url) ? T('تبويب جديد', 'New tab') : x.url),
        url: isNewtab(x.url) ? '' : x.url, favicon: x.favicon || '', loading: !!x.loading,
        discarded: !!x.discarded, audible: !!(x.view && !x.view.webContents.isDestroyed() && x.view.webContents.isCurrentlyAudible())
      })),
      activeId,
      url: isNewtab(url) ? '' : url,
      isNewtab: isNewtab(url),
      loading: !!(t && t.loading),
      canGoBack: !!(wc && wc.navigationHistory.canGoBack()),
      canGoForward: !!(wc && wc.navigationHistory.canGoForward()),
      bookmarked: !!(url && !isNewtab(url) && findBookmark(url)),
      maximized: win ? win.isMaximized() : false,
      fullscreen: win ? win.isFullScreen() : false,
      lang: settings.data.lang,
      memorySaverMin: settings.data.memorySaverMin,
      restoreTabs: settings.data.restoreTabs,
      zoom: wc ? Math.round(wc.getZoomFactor() * 100) : 100,
      closedCount: closedStack.length,
      versions: { app: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }
    });
  }, 16);
}

/* ---------- tabs ---------- */
function makeView(tab) {
  const view = new WebContentsView({
    webPreferences: {
      preload: PRELOAD_TAB,            // only exposes its API on the new tab page (checked inside)
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  });
  view.setBackgroundColor(isNewtab(tab.url) ? '#000000' : '#ffffff');
  const wc = view.webContents;

  wc.setWindowOpenHandler(d => {
    // real popups (sign-in windows etc.) keep their opener; normal "_blank" links become tabs
    if (d.disposition === 'new-window' && d.features) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#111', icon: fs.existsSync(ICON) ? ICON : undefined }
      };
    }
    createTab(d.url, { activate: d.disposition !== 'background-tab', after: tab.id });
    return { action: 'deny' };
  });

  const upd = () => { pushState(); };
  wc.on('did-start-loading', () => { tab.loading = true; upd(); });
  wc.on('did-stop-loading', () => { tab.loading = false; upd(); });
  wc.on('page-title-updated', (e, title) => {
    tab.title = title; upd();
    const h = history.data; if (h.length && h[h.length - 1].url === tab.url) { h[h.length - 1].title = title; history.save(); }
  });
  wc.on('page-favicon-updated', (e, favs) => { tab.favicon = favs && favs[0] || ''; upd(); });
  const nav = (e, url) => {
    const was = isNewtab(tab.url);
    tab.url = url;
    view.setBackgroundColor(isNewtab(url) ? '#000000' : '#ffffff');
    if (isNewtab(url)) { tab.favicon = ''; tab.title = ''; }
    addHistory(url, wc.getTitle());
    if (was !== isNewtab(url) && tab.id === activeId) layout();
    upd(); saveSessionSoon();
  };
  wc.on('did-navigate', nav);
  wc.on('did-navigate-in-page', (e, url, isMain) => { if (isMain) nav(e, url); });
  wc.on('audio-state-changed', upd);
  wc.on('context-menu', (e, p) => contextMenu(tab, p));
  wc.on('before-input-event', (e, input) => { if (handleKey(input)) e.preventDefault(); });
  wc.on('enter-html-full-screen', () => { htmlFullscreen = true; win.setFullScreen(true); layout(); });
  wc.on('leave-html-full-screen', () => { htmlFullscreen = false; win.setFullScreen(false); layout(); });
  wc.on('render-process-gone', (e, d) => { if (d.reason !== 'clean-exit') { tab.title = T('تعطلت الصفحة، حدّثها', 'Page crashed, reload it'); upd(); } });
  wc.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = aborted
    tab.title = T('تعذّر فتح الصفحة', 'Could not open page'); upd();
  });
  tab.view = view;
  tab.discarded = false;
  return view;
}

function createTab(url, opts = {}) {
  const tab = { id: nextId++, view: null, url: url || NEWTAB_URL, title: '', favicon: '', loading: false, discarded: false, lastActive: Date.now() };
  if (opts.discarded) { tab.discarded = true; tab.title = opts.title || ''; }
  else { makeView(tab); loadInto(tab, tab.url); }
  const i = opts.after ? tabs.findIndex(t => t.id === opts.after) : -1;
  if (i >= 0) tabs.splice(i + 1, 0, tab); else tabs.push(tab);
  if (opts.activate !== false) activate(tab.id); else pushState();
  saveSessionSoon();
  return tab;
}

function loadInto(tab, url) {
  const wc = tab.view.webContents;
  // pages without their own background must be white (like Chrome); the new tab is black
  tab.view.setBackgroundColor(isNewtab(url) ? '#000000' : '#ffffff');
  if (isNewtab(url)) wc.loadFile(NEWTAB_FILE).catch(() => {});
  else wc.loadURL(url).catch(() => {});
}

function activate(id) {
  const t = tabs.find(x => x.id === id); if (!t) return;
  const prev = active();
  if (prev && prev.view && prev !== t) { try { win.contentView.removeChildView(prev.view); } catch (e) {} prev.lastActive = Date.now(); }
  activeId = id;
  if (t.discarded || !t.view) { makeView(t); loadInto(t, t.url); }
  win.contentView.addChildView(t.view, 0);   // under the toolbar
  t.lastActive = Date.now();
  layout();
  if (isNewtab(t.url)) { focusAddress(); } else t.view.webContents.focus();
  pushState(); saveSessionSoon();
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id); if (i < 0) return;
  const t = tabs[i];
  if (!isNewtab(t.url)) { closedStack.push({ url: t.url, title: t.title }); if (closedStack.length > 25) closedStack.shift(); }
  tabs.splice(i, 1);
  if (t.view) { try { win.contentView.removeChildView(t.view); } catch (e) {} destroyView(t.view); }
  if (!tabs.length) { createTab(); return; }
  if (activeId === id) activate((tabs[i] || tabs[i - 1]).id); else pushState();
  saveSessionSoon();
}

function destroyView(view) {
  try { if (!view.webContents.isDestroyed()) view.webContents.close(); } catch (e) {}
}

/* memory saver: put tabs you haven't looked at for a while to sleep (frees their RAM) */
function discard(t) {
  if (!t.view || t.id === activeId) return;
  const wc = t.view.webContents;
  if (wc.isCurrentlyAudible() || wc.isDevToolsOpened()) return;
  destroyView(t.view);
  t.view = null; t.discarded = true; t.loading = false;
  pushState();
}
setInterval(() => {
  const min = settings && settings.data.memorySaverMin;
  if (!min) return;
  const limit = Date.now() - min * 60000;
  for (const t of tabs) if (t.id !== activeId && t.view && t.lastActive < limit) discard(t);
}, 30000);

/* ---------- session restore ---------- */
let sessTimer = null;
function saveSessionSoon() { clearTimeout(sessTimer); sessTimer = setTimeout(saveSession, 1000); }
function saveSession() {
  if (!sessionStore) return;
  sessionStore.data = {
    tabs: tabs.map(t => ({ url: isNewtab(t.url) ? '' : t.url, title: t.title })),
    active: Math.max(0, tabs.findIndex(t => t.id === activeId))
  };
}

/* ---------- history ---------- */
function addHistory(url, title) {
  if (!/^https?:/i.test(url)) return;
  const h = history.data;
  if (h.length && h[h.length - 1].url === url) { h[h.length - 1].t = Date.now(); }
  else h.push({ url, title: title || '', t: Date.now() });
  if (h.length > 5000) h.splice(0, h.length - 5000);
  history.save();
}

/* ---------- bookmarks (one "bar" folder, like Chrome's bookmarks bar) ---------- */
const normUrl = u => { try { const x = new URL(u); return x.origin + x.pathname.replace(/\/$/, '') + x.search; } catch (e) { return u; } };
function findBookmark(url, node = bookmarks.data) {
  const n = normUrl(url);
  for (const c of node.children || []) {
    if (c.url && normUrl(c.url) === n) return { parent: node, item: c };
    if (c.children) { const r = findBookmark(url, c); if (r) return r; }
  }
  return null;
}
function chromeBookmarkFiles() {
  const base = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data')
    : process.platform === 'darwin' ? path.join(app.getPath('home'), 'Library/Application Support/Google/Chrome')
    : path.join(app.getPath('home'), '.config/google-chrome');
  const out = [];
  try {
    for (const d of ['Default', ...fs.readdirSync(base).filter(n => /^Profile \d+$/.test(n))]) {
      const f = path.join(base, d, 'Bookmarks'); if (fs.existsSync(f)) out.push(f);
    }
  } catch (e) {}
  return out;
}
function importChromeBookmarks() {
  const files = chromeBookmarkFiles();
  if (!files.length) return 0;
  const conv = n => n.type === 'folder' ? { title: n.name, children: (n.children || []).map(conv).filter(Boolean) }
    : n.type === 'url' ? { title: n.name, url: n.url } : null;
  try {
    const j = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    const bar = (j.roots && j.roots.bookmark_bar && j.roots.bookmark_bar.children) || [];
    const items = bar.map(conv).filter(Boolean);
    // keep anything already added here, add the Chrome ones that are missing
    const have = new Set();
    (function walk(n) { for (const c of n.children || []) { if (c.url) have.add(normUrl(c.url)); if (c.children) walk(c); } })(bookmarks.data);
    let added = 0;
    for (const it of items) { if (it.url && have.has(normUrl(it.url))) continue; bookmarks.data.children.push(it); added++; }
    bookmarks.save();
    return added;
  } catch (e) { return 0; }
}

/* ---------- extensions ---------- */
const extApi = () => session.defaultSession.extensions || session.defaultSession;
async function loadExtensionDir(dir) {
  // accept a folder that has manifest.json, or one level above it (e.g. "بلاك كروم/extension")
  let d = dir;
  if (!fs.existsSync(path.join(d, 'manifest.json'))) {
    const sub = fs.readdirSync(d).map(n => path.join(d, n)).find(p => fs.existsSync(path.join(p, 'manifest.json')));
    if (!sub) throw new Error('no manifest.json');
    d = sub;
  }
  return extApi().loadExtension(d, { allowFileAccess: false });
}
function extIcon(ext) {
  try {
    const m = ext.manifest || {};
    const icons = m.icons || (m.action && m.action.default_icon) || (m.browser_action && m.browser_action.default_icon) || {};
    const pick = typeof icons === 'string' ? icons : icons[Object.keys(icons).sort((a, b) => b - a)[0]];
    if (!pick) return '';
    const p = path.join(ext.path, pick);
    const img = nativeImage.createFromPath(p);
    return img.isEmpty() ? '' : img.resize({ width: 32 }).toDataURL();
  } catch (e) { return ''; }
}
function listExtensions() {
  return extApi().getAllExtensions().map(e => {
    const m = e.manifest || {};
    const opt = (m.options_ui && m.options_ui.page) || m.options_page || '';
    return { id: e.id, name: e.name, version: e.version, icon: extIcon(e), options: opt ? `chrome-extension://${e.id}/${opt}` : '' };
  });
}

/* ---------- keyboard ---------- */
function handleKey(i) {
  if (i.type !== 'keyDown') return false;
  const c = i.control || i.meta, k = (i.key || '').toLowerCase();
  const t = active(); const wc = t && t.view && t.view.webContents;
  if (c && !i.shift && k === 't') { createTab(); return true; }
  if (c && i.shift && k === 't') { reopenClosed(); return true; }
  if (c && k === 'w') { if (t) closeTab(t.id); return true; }
  if (c && k === 'tab') { cycle(i.shift ? -1 : 1); return true; }
  if (c && /^[1-8]$/.test(k)) { const x = tabs[+k - 1]; if (x) activate(x.id); return true; }
  if (c && k === '9') { activate(tabs[tabs.length - 1].id); return true; }
  if ((c && k === 'l') || k === 'f6' || (i.alt && k === 'd')) { focusAddress(); return true; }
  if (k === 'f5' || (c && k === 'r')) { if (wc) (i.shift || c && k === 'f5') ? wc.reloadIgnoringCache() : wc.reload(); return true; }
  if ((i.alt && k === 'arrowleft') || k === 'browserback') { if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); return true; }
  if ((i.alt && k === 'arrowright') || k === 'browserforward') { if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); return true; }
  if (k === 'f11') { win.setFullScreen(!win.isFullScreen()); return true; }
  if (k === 'f12' || (c && i.shift && k === 'i')) { if (wc) wc.toggleDevTools(); return true; }
  if (c && (k === '=' || k === '+')) { zoom(wc, 0.1); return true; }
  if (c && k === '-') { zoom(wc, -0.1); return true; }
  if (c && k === '0') { if (wc) { wc.setZoomFactor(1); pushState(); } return true; }
  if (c && k === 'd') { toggleBookmark(); return true; }
  if (k === 'escape' && uiExpanded === true && ui) { ui.webContents.send('close-menus'); return false; }
  return false;
}
function zoom(wc, d) { if (!wc) return; wc.setZoomFactor(Math.min(3, Math.max(0.3, Math.round((wc.getZoomFactor() + d) * 10) / 10))); pushState(); }
function cycle(dir) { if (tabs.length < 2) return; const i = tabs.findIndex(t => t.id === activeId); activate(tabs[(i + dir + tabs.length) % tabs.length].id); }
function reopenClosed() { const c = closedStack.pop(); if (c) createTab(c.url); }
function focusAddress() { if (ui && !ui.webContents.isDestroyed()) { ui.webContents.focus(); ui.webContents.send('focus-address'); } }
function toggleBookmark() {
  const t = active(); if (!t || isNewtab(t.url)) return;
  const f = findBookmark(t.url);
  if (f) f.parent.children.splice(f.parent.children.indexOf(f.item), 1);
  else bookmarks.data.children.push({ title: t.title || t.url, url: t.url });
  bookmarks.save(); pushState();
}

/* ---------- navigation from the address bar ---------- */
function toUrl(text) {
  const t = (text || '').trim();
  if (!t) return null;
  if (/^(https?|file|chrome-extension|about|view-source):/i.test(t)) return t;
  if (/^localhost(:\d+)?(\/|$)/i.test(t) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/.test(t)) return 'http://' + t;
  if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return 'https://' + t;
  return 'https://www.google.com/search?q=' + encodeURIComponent(t);   // always Google
}
function navigate(text, newTab) {
  const url = toUrl(text); if (!url) return;
  const t = active();
  if (newTab || !t) { createTab(url); return; }
  if (!t.view) makeView(t);
  t.url = url; loadInto(t, url); t.view.webContents.focus(); layout(); pushState();
}

/* ---------- right-click menu ---------- */
function contextMenu(tab, p) {
  const wc = tab.view.webContents;
  const items = [];
  if (p.linkURL) {
    items.push({ label: T('فتح الرابط في تبويب جديد', 'Open link in new tab'), click: () => createTab(p.linkURL, { activate: false, after: tab.id }) });
    items.push({ label: T('نسخ الرابط', 'Copy link'), click: () => clipboard.writeText(p.linkURL) });
    items.push({ type: 'separator' });
  }
  if (p.mediaType === 'image' && p.srcURL) {
    items.push({ label: T('فتح الصورة في تبويب جديد', 'Open image in new tab'), click: () => createTab(p.srcURL, { activate: false, after: tab.id }) });
    items.push({ label: T('نسخ الصورة', 'Copy image'), click: () => wc.copyImageAt(p.x, p.y) });
    items.push({ label: T('حفظ الصورة', 'Save image'), click: () => wc.downloadURL(p.srcURL) });
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
    items.push({ label: T('ابحث في Google عن "', 'Search Google for "') + (s.length > 24 ? s.slice(0, 24) + '…' : s) + '"', click: () => createTab(toUrl(s), { after: tab.id }) });
    items.push({ type: 'separator' });
  }
  items.push({ label: T('رجوع', 'Back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() });
  items.push({ label: T('للأمام', 'Forward'), enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() });
  items.push({ label: T('تحديث', 'Reload'), click: () => wc.reload() });
  items.push({ type: 'separator' });
  items.push({ label: T('فحص العنصر', 'Inspect'), click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: win });
}

/* ---------- window ---------- */
function createWindow() {
  const s = settings.data;
  const b = s.bounds && screen.getAllDisplays().some(d => {
    const a = d.workArea; return s.bounds.x < a.x + a.width && s.bounds.x + s.bounds.width > a.x && s.bounds.y < a.y + a.height && s.bounds.y + 30 > a.y;
  }) ? s.bounds : null;
  win = new BaseWindow(Object.assign({
    width: 1280, height: 800, minWidth: 520, minHeight: 320,
    frame: false, backgroundColor: '#000000', show: false, title: '3zT Browser'
  }, b || {}, fs.existsSync(ICON) ? { icon: ICON } : {}));

  ui = new WebContentsView({
    webPreferences: { preload: PRELOAD_UI, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, partition: 'zeus-ui' }
  });
  ui.setBackgroundColor('#00000000');
  win.contentView.addChildView(ui);
  ui.webContents.loadFile(UI_FILE);
  ui.webContents.on('before-input-event', (e, input) => { if (handleKey(input)) e.preventDefault(); });
  ui.webContents.once('did-finish-load', () => {
    if (s.maximized) win.maximize();
    win.show(); pushState();
    const t = active(); if (t && isNewtab(t.url)) focusAddress();
  });

  win.on('resize', layout);
  win.on('maximize', () => { layout(); pushState(); });
  win.on('unmaximize', () => { layout(); pushState(); });
  win.on('enter-full-screen', () => { layout(); pushState(); });
  win.on('leave-full-screen', () => { htmlFullscreen = false; layout(); pushState(); });
  win.on('close', () => {
    settings.data.maximized = win.isMaximized();
    if (!win.isMaximized() && !win.isFullScreen()) settings.data.bounds = win.getBounds();
    settings.save(); saveSession();
    for (const st of [settings, bookmarks, history, sessionStore]) st.flush();
  });
  win.on('closed', () => { win = null; app.quit(); });

  // first tabs
  const sess = sessionStore.data;
  if (s.restoreTabs && sess.tabs && sess.tabs.length) {
    const act = Math.min(sess.active || 0, sess.tabs.length - 1);
    sess.tabs.forEach((t, i) => createTab(t.url || NEWTAB_URL, i === act ? { activate: false } : { activate: false, discarded: true, title: t.title }));
    activate(tabs[act].id);
  } else createTab();
}

/* ---------- window dragging (frameless) ---------- */
let drag = null;
function dragTick() {
  if (!drag || !win) return;
  const p = screen.getCursorScreenPoint();
  const dx = p.x - drag.cx, dy = p.y - drag.cy;
  if (win.isMaximized()) {
    if (Math.abs(dx) + Math.abs(dy) < 6) return;
    const ratio = drag.ratio;
    win.unmaximize();
    const nb = win.getBounds();
    drag.wx = Math.round(p.x - nb.width * ratio); drag.wy = p.y - drag.offY; drag.cx = p.x; drag.cy = p.y;
    win.setPosition(drag.wx, drag.wy);
    return;
  }
  win.setPosition(drag.wx + dx, drag.wy + dy);
}

/* ---------- permissions: ask before camera / mic / location / notifications ---------- */
function setupSession() {
  const ses = session.defaultSession;
  const always = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'window-management']);
  const asked = new Map();
  ses.setPermissionRequestHandler((wc, perm, cb, details) => {
    if (always.has(perm)) return cb(true);
    const origin = (() => { try { return new URL(details.requestingUrl || wc.getURL()).origin; } catch (e) { return ''; } })();
    const key = origin + '|' + perm;
    if (asked.has(key)) return cb(asked.get(key));
    const names = {
      media: T('الكاميرا / المايك', 'camera / microphone'), geolocation: T('موقعك', 'your location'),
      notifications: T('الإشعارات', 'notifications'), 'clipboard-read': T('قراءة الحافظة', 'read clipboard'),
      midi: 'MIDI', midiSysex: 'MIDI', hid: 'HID', serial: 'Serial', usb: 'USB'
    };
    if (!names[perm]) return cb(false);
    dialog.showMessageBox(win, {
      type: 'question', buttons: [T('سماح', 'Allow'), T('رفض', 'Block')], defaultId: 1, cancelId: 1,
      title: '3zT Browser', message: `${origin}\n${T('يطلب الوصول إلى', 'wants to use')}: ${names[perm]}`
    }).then(r => { const ok = r.response === 0; asked.set(key, ok); cb(ok); }).catch(() => cb(false));
  });

  // downloads go straight to the Downloads folder, the toolbar shows a small notice
  ses.on('will-download', (e, item) => {
    const dir = app.getPath('downloads');
    let name = item.getFilename() || 'download', p = path.join(dir, name), n = 1;
    const ext = path.extname(name), base = path.basename(name, ext);
    while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`);
    item.setSavePath(p);
    const send = st => ui && !ui.webContents.isDestroyed() && ui.webContents.send('download', { name: path.basename(p), path: p, state: st,
      received: item.getReceivedBytes(), total: item.getTotalBytes() });
    send('progressing');
    item.on('updated', (ev, st) => send(st));
    item.once('done', (ev, st) => send(st));
  });
}

/* ---------- IPC ---------- */
const fromUi = e => ui && e.sender === ui.webContents;
const fromNewtab = e => { try { return isNewtab(e.senderFrame.url); } catch (x) { return false; } };

function setupIpc() {
  ipcMain.on('ui:expand', (e, on) => { if (!fromUi(e)) return; uiExpanded = typeof on === 'number' ? on : !!on; layout(); });
  ipcMain.on('win', (e, cmd) => {
    if (!fromUi(e) || !win) return;
    if (cmd === 'min') win.minimize();
    else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (cmd === 'close') win.close();
  });
  ipcMain.on('drag:start', (e, offY) => {
    if (!fromUi(e) || !win || win.isFullScreen()) return;
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    drag = { cx: p.x, cy: p.y, wx: b.x, wy: b.y, ratio: (p.x - b.x) / b.width, offY: Math.max(8, Math.min(40, offY || 20)) };
    clearInterval(drag.t); drag.t = setInterval(dragTick, 10);
  });
  ipcMain.on('drag:end', e => { if (drag) { clearInterval(drag.t); drag = null; } });

  ipcMain.on('tab', (e, cmd, arg) => {
    if (!fromUi(e)) return;
    const t = active(), wc = t && t.view && t.view.webContents;
    switch (cmd) {
      case 'new': createTab(); break;
      case 'activate': activate(arg); break;
      case 'close': closeTab(arg); break;
      case 'reopen': reopenClosed(); break;
      case 'back': if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
      case 'forward': if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
      case 'reload': if (wc) wc.reload(); break;
      case 'stop': if (wc) wc.stop(); break;
      case 'go': navigate(arg && arg.text, arg && arg.newTab); break;
      case 'bookmark': toggleBookmark(); break;
      case 'zoom': zoom(wc, arg); break;
      case 'zoomReset': if (wc) { wc.setZoomFactor(1); pushState(); } break;
      case 'focusPage': if (wc) wc.focus(); break;
      case 'move': { // reorder: arg = {id, to}
        const i = tabs.findIndex(x => x.id === arg.id); if (i < 0) break;
        const [x] = tabs.splice(i, 1); tabs.splice(Math.max(0, Math.min(tabs.length, arg.to)), 0, x); pushState(); saveSessionSoon(); break;
      }
    }
  });

  ipcMain.on('set', (e, key, val) => {
    if (!fromUi(e) && !(fromNewtab(e) && key === 'lang')) return;
    if (key === 'lang' && (val === 'ar' || val === 'en')) settings.data.lang = val;
    if (key === 'memorySaverMin' && [0, 5, 15, 30, 60].includes(+val)) settings.data.memorySaverMin = +val;
    if (key === 'restoreTabs') settings.data.restoreTabs = !!val;
    settings.save(); pushState();
    // tell every open new tab page about the language
    if (key === 'lang') for (const t of tabs) if (t.view && isNewtab(t.url)) t.view.webContents.send('lang', settings.data.lang);
  });

  ipcMain.handle('ext:list', e => (fromUi(e) ? listExtensions() : []));
  ipcMain.handle('ext:add', async e => {
    if (!fromUi(e)) return { ok: false };
    const r = await dialog.showOpenDialog(win, { title: T('اختر مجلد الإضافة', 'Choose the extension folder'), properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const ext = await loadExtensionDir(r.filePaths[0]);
      const list = settings.data.extensions.filter(p => p !== ext.path); list.push(ext.path);
      settings.data.extensions = list; settings.save();
      return { ok: true, name: ext.name };
    } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('ext:remove', (e, id) => {
    if (!fromUi(e)) return false;
    const ext = extApi().getExtension(id); if (!ext) return false;
    extApi().removeExtension(id);
    settings.data.extensions = settings.data.extensions.filter(p => p !== ext.path); settings.save();
    return true;
  });
  ipcMain.on('ext:options', (e, url) => { if (fromUi(e) && /^chrome-extension:\/\//.test(url)) createTab(url); });

  ipcMain.handle('bm:import', e => (fromUi(e) ? importChromeBookmarks() : 0));
  ipcMain.handle('bm:get', e => (fromNewtab(e) || fromUi(e) ? bookmarks.data : { children: [] }));

  ipcMain.handle('history:search', (e, text, max) => {
    if (!fromNewtab(e) && !fromUi(e)) return [];
    const q = String(text || '').toLowerCase(), out = [], seen = new Set();
    const h = history.data;
    for (let i = h.length - 1; i >= 0 && out.length < (max || 600); i--) {
      const it = h[i];
      if (q && !(it.url.toLowerCase().includes(q) || (it.title || '').toLowerCase().includes(q))) continue;
      if (seen.has(it.url)) continue; seen.add(it.url);
      out.push({ url: it.url, title: it.title, lastVisitTime: it.t });
    }
    return out;
  });

  ipcMain.handle('suggest', async (e, q, hl) => {
    if (!fromNewtab(e) && !fromUi(e)) return [];
    try {
      const r = await net.fetch('https://suggestqueries.google.com/complete/search?client=firefox&hl=' + (hl === 'en' ? 'en' : 'ar') + '&q=' + encodeURIComponent(String(q || '')));
      const j = await r.json(); return Array.isArray(j[1]) ? j[1].slice(0, 8) : [];
    } catch (err) { return []; }
  });

  ipcMain.handle('lang:get', () => settings.data.lang);

  ipcMain.on('misc', async (e, cmd) => {
    if (!fromUi(e)) return;
    if (cmd === 'downloads') shell.openPath(app.getPath('downloads'));
    if (cmd === 'devtools') { const t = active(); if (t && t.view) t.view.webContents.toggleDevTools(); }
    if (cmd === 'fullscreen') win.setFullScreen(!win.isFullScreen());
    if (cmd === 'clearData') {
      const r = await dialog.showMessageBox(win, {
        type: 'warning', buttons: [T('مسح', 'Clear'), T('إلغاء', 'Cancel')], defaultId: 1, cancelId: 1, title: '3zT Browser',
        message: T('مسح السجل والكاش والكوكيز؟ (بيطلعك من حساباتك في المواقع)', 'Clear history, cache and cookies? (signs you out of sites)')
      });
      if (r.response !== 0) return;
      history.data = []; history.flush();
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({ storages: ['cookies', 'cachestorage', 'serviceworkers', 'shadercache', 'websql'] });
    }
  });
  ipcMain.on('download:show', (e, p) => { if (fromUi(e) && typeof p === 'string') shell.showItemInFolder(p); });
}

/* ---------- start ---------- */
app.on('second-instance', (e, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  const u = argv.find(a => /^https?:\/\//i.test(a)); if (u) createTab(u);
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  settings = makeStore('settings.json', {
    lang: 'ar', memorySaverMin: 15, restoreTabs: true, extensions: [], bookmarksImported: false, bounds: null, maximized: false
  });
  bookmarks = makeStore('bookmarks.json', { children: [] });
  history = makeStore('history.json', []);
  sessionStore = makeStore('session.json', { tabs: [], active: 0 });

  if (!settings.data.bookmarksImported) { importChromeBookmarks(); settings.data.bookmarksImported = true; settings.save(); }

  setupSession();
  setupIpc();
  for (const p of settings.data.extensions.slice()) {
    try { await loadExtensionDir(p); } catch (e) { console.warn('extension failed', p, e.message); }
  }
  createWindow();
});

app.on('window-all-closed', () => app.quit());
