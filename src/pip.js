'use strict';
/*
 * Picture in picture: 3zT's own small window instead of Chromium's.
 *
 * Chromium's picture-in-picture window can't be styled, moves and changes size with every video, and shows the
 * site's "10 seconds back / forward" buttons. Here the tab's page itself moves into a small rounded window that
 * stays above everything, and only the chosen video is shown in it:
 *   - the video is put in the page's top layer (a "popover"), so it fills the page whatever the site's layout is;
 *     a video inside an embedded player (iframe) brings its frame along the same way
 *   - a see-through layer on top draws the frame and the buttons (back to the tab, close, previous, play/pause,
 *     next, the time bar) and moves / resizes the window
 *   - the window's place and size are kept (settings.pipBounds): every video opens where the last one was
 * Only one at a time. The tab stays in its window's tab strip; while its page is out, the window shows a note there.
 */
const { BaseWindow, WebContentsView, ipcMain, screen } = require('electron');

const M = 8;          // the see-through edge around the picture: its shadow, and where it can be resized from
const R = 12;         // corner radius
const MIN_W = 240, MIN_H = 136;
const GRIP = 14;      // from the window's edge: resizes instead of moving

/* ---------- what runs in the page (its main world: the site's own player is there) ---------- */
// kept in one string: used for the first pick and again by the small check that follows a video the site replaces
// the video is rounded itself too: Windows can hand a video that fills the window straight to the graphics card
// (an overlay), which skips the window's own round corners
const LIB = String.raw`
  const CSS = '[data-zpip]{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:${R}px!important;transform:none!important;translate:none!important;scale:none!important;rotate:none!important;filter:none!important;clip-path:none!important;mask:none!important;opacity:1!important;visibility:visible!important;display:block!important;object-fit:contain!important;background:#000!important;box-shadow:none!important;outline:0!important;z-index:2147483647!important}'
    + '[data-zpip]::backdrop{background:#000!important}'
    + 'html[data-zpip-on],html[data-zpip-on] body{overflow:hidden!important}'
    + 'video[data-zpip]::-webkit-media-controls{display:none!important}';
  const ours = s => { try { return s.cssRules.length > 0 && s.cssRules[0].selectorText === '[data-zpip]'; } catch (e) { return false; } };
  const addSheet = () => {
    try {
      if (document.adoptedStyleSheets.some(ours)) return;
      const s = new CSSStyleSheet(); s.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
    } catch (e) {
      if (document.querySelector('style[data-zpip-style]')) return;
      const st = document.createElement('style'); st.setAttribute('data-zpip-style', ''); st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
  };
  const mark = el => {
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
    addSheet();
    if (el.hasAttribute('popover') && !el.hasAttribute('data-zpip')) el.setAttribute('data-zpip-pop', el.getAttribute('popover'));
    el.setAttribute('data-zpip', '');
    el.setAttribute('popover', 'manual');
    try { if (!el.matches(':popover-open')) el.showPopover(); } catch (e) {}
    document.documentElement.setAttribute('data-zpip-on', '');
  };
  const area = v => { const r = v.getBoundingClientRect(); return r.width * r.height; };
  const pick = (x, y) => {
    const vids = [...document.querySelectorAll('video')].filter(v => v.readyState > 0 && (area(v) > 0 || v.hasAttribute('data-zpip')));
    let v = x >= 0 ? vids.find(v => { const r = v.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) : null;
    if (!v) v = vids.filter(v => !v.paused).sort((a, b) => area(b) - area(a))[0] || vids.sort((a, b) => area(b) - area(a))[0];
    return v || null;
  };
  // the site swapped the video for a new one (or took it out of the top layer): follow it, once a second
  const watch = () => {
    if (!document.documentElement.hasAttribute('data-zpip-on')) { document.documentElement.removeAttribute('data-zpip-w'); return; }
    const v = document.querySelector('video[data-zpip]');
    if (!v) { const n = pick(-1, -1); if (n) mark(n); }
    else if (!v.matches(':popover-open')) { try { v.showPopover(); } catch (e) {} }
    setTimeout(watch, 1000);
  };
`;
const FIND_JS = (x, y) => `(() => { try {
  ${LIB}
  if (document.querySelector('[data-zpip]')) return null;
  const v = pick(${+x >= 0 ? +x : -1}, ${+y >= 0 ? +y : -1});
  if (!v) return null;
  mark(v);
  if (!document.documentElement.hasAttribute('data-zpip-w')) { document.documentElement.setAttribute('data-zpip-w', ''); setTimeout(watch, 1000); }
  return { w: innerWidth, h: innerHeight };
} catch (e) { return null; } })()`;
// the <iframe> that holds the video's frame fills its page too (best match: same size, then same site, then the largest)
const FRAME_JS = (w, h, url) => `(() => { try {
  ${LIB}
  const W = ${+w || 0}, H = ${+h || 0}; let host = ''; try { host = new URL(${JSON.stringify(String(url || ''))}).host; } catch (e) {}
  const all = [...document.querySelectorAll('iframe,frame')].filter(f => { const r = f.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const score = f => { const r = f.getBoundingClientRect(); let s = 0;
    if (Math.abs(r.width - W) < 3 && Math.abs(r.height - H) < 3) s += 2;
    try { if (host && new URL(f.src, location.href).host === host) s += 1; } catch (e) {}
    return s * 1e9 + r.width * r.height; };
  all.sort((a, b) => score(b) - score(a));
  if (!all[0]) return null;
  mark(all[0]);
  return { w: innerWidth, h: innerHeight };
} catch (e) { return null; } })()`;
const UNMARK_JS = pause => `(() => { try {
  for (const el of document.querySelectorAll('[data-zpip]')) {
    if (${pause ? 'true' : 'false'} && el.tagName === 'VIDEO') { try { el.pause(); } catch (e) {} }
    try { if (el.matches(':popover-open')) el.hidePopover(); } catch (e) {}
    const p = el.getAttribute('data-zpip-pop');
    if (p !== null) { el.setAttribute('popover', p); el.removeAttribute('data-zpip-pop'); } else el.removeAttribute('popover');
    el.removeAttribute('data-zpip');
  }
  document.documentElement.removeAttribute('data-zpip-on');
  try { document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => { try { return !(s.cssRules.length > 0 && s.cssRules[0].selectorText === '[data-zpip]'); } catch (e) { return true; } }); } catch (e) {}
  document.querySelectorAll('style[data-zpip-style]').forEach(s => s.remove());
  return true;
} catch (e) { return false; } })()`;
const STATE_JS = `(() => { const v = document.querySelector('video[data-zpip]'); if (!v) return null;
  return { paused: v.paused, t: v.currentTime || 0, d: isFinite(v.duration) ? v.duration : 0, live: v.duration === Infinity }; })()`;
const PLAY_JS = `(() => { const v = document.querySelector('video[data-zpip]'); if (!v) return false; if (v.paused) v.play().catch(() => {}); else v.pause(); return true; })()`;
const SEEK_JS = f => `(() => { const v = document.querySelector('video[data-zpip]'); if (!v || !isFinite(v.duration) || !(v.duration > 0)) return false;
  v.currentTime = Math.max(0, Math.min(v.duration - 0.1, ${Math.max(0, Math.min(1, +f || 0))} * v.duration)); return true; })()`;
/* previous / next: the site's own buttons (YouTube, YouTube Music) */
const TRACK_JS = dir => `(() => {
  const music = location.hostname === 'music.youtube.com';
  const shown = b => !!b && getComputedStyle(b).display !== 'none' && !b.hasAttribute('disabled');
  const b = document.querySelector(music ? 'ytmusic-player-bar .${dir === 'next' ? 'next' : 'previous'}-button' : '.ytp-${dir === 'next' ? 'next' : 'prev'}-button');
  if (shown(b)) { b.click(); return true; }
  const p = document.getElementById('movie_player');
  if (${dir === 'next' ? 'true' : 'false'}) { if (p && typeof p.nextVideo === 'function') { p.nextVideo(); return true; } return false; }
  const v = document.querySelector('video[data-zpip]');
  if (v && v.currentTime > 3) { v.currentTime = 0; return true; }   // like a music player: the start of this one first
  history.back(); return true;
})()`;
const hasTracks = url => { try { return /^(www\.|m\.)?youtube\.com$|^music\.youtube\.com$/i.test(new URL(url).hostname) && !/^\/embed\//.test(new URL(url).pathname); } catch (e) { return false; } };

/* ---------- the window ---------- */
module.exports = function createPip(o) {
  // o: { settings, T, icon, preload, file, returned(tab, { focus }), changed(tab) }
  let cur = null;   // { tab, win, overlay, frame, grab, tick, onNav }
  let entering = false;

  const frames = wc => { try { return [wc.mainFrame, ...wc.mainFrame.framesInSubtree.filter(f => f !== wc.mainFrame)]; } catch (e) { return []; } };
  const alive = f => { try { return !!f && !f.isDestroyed() && !f.detached; } catch (e) { return false; } };
  const run = async (f, code) => { try { return await f.executeJavaScript(code, true); } catch (e) { return null; } };

  function workAreaFor(b) { try { return screen.getDisplayMatching(b).workArea; } catch (e) { return screen.getPrimaryDisplay().workArea; } }
  function fit(b) {
    const wa = workAreaFor(b);
    const width = Math.round(Math.max(MIN_W + 2 * M, Math.min(b.width, wa.width + 2 * M)));
    const height = Math.round(Math.max(MIN_H + 2 * M, Math.min(b.height, wa.height + 2 * M)));
    const x = Math.round(Math.max(wa.x - M, Math.min(b.x, wa.x + wa.width - width + M)));
    const y = Math.round(Math.max(wa.y - M, Math.min(b.y, wa.y + wa.height - height + M)));
    return { x, y, width, height };
  }
  function startBounds() {
    const s = o.settings.data.pipBounds;
    if (s && [s.x, s.y, s.width, s.height].every(Number.isFinite)) {
      // still on a screen (a monitor may be gone): then where it was, else the default place
      const on = screen.getAllDisplays().some(d => { const a = d.workArea; return s.x + M < a.x + a.width - 40 && s.x + s.width - M > a.x + 40 && s.y + M < a.y + a.height - 40 && s.y + s.height - M > a.y + 10; });
      if (on) return fit(s);
    }
    const wa = screen.getPrimaryDisplay().workArea;
    const width = 400 + 2 * M, height = 225 + 2 * M;
    return { x: wa.x + wa.width - width - 16 + M, y: wa.y + wa.height - height - 16 + M, width, height };
  }
  function save() {
    if (!cur || cur.win.isDestroyed()) return;
    o.settings.data.pipBounds = cur.win.getBounds();
    o.settings.save();
  }
  function layout() {
    if (!cur || cur.win.isDestroyed()) return;
    const { width, height } = cur.win.getContentBounds();
    if (cur.tab.view) cur.tab.view.setBounds({ x: M, y: M, width: Math.max(1, width - 2 * M), height: Math.max(1, height - 2 * M) });
    cur.overlay.setBounds({ x: 0, y: 0, width, height });
  }
  // the frame that holds the video (it can change: the site may load its player again)
  async function videoFrame() {
    if (!cur || !cur.tab.view || cur.tab.view.webContents.isDestroyed()) return null;
    if (alive(cur.frame) && await run(cur.frame, `!!document.querySelector('video[data-zpip]')`)) return cur.frame;
    for (const f of frames(cur.tab.view.webContents)) if (await run(f, `!!document.querySelector('video[data-zpip]')`)) { cur.frame = f; return f; }
    return null;
  }

  const usable = tab => !!(tab && tab.view && !tab.view.webContents.isDestroyed() && tab.win && !tab.win.win.isDestroyed() && tab.win.tabs.includes(tab));
  async function enter(tab, x, y) {
    if (entering || !usable(tab)) return 'none';
    entering = true;
    try { return await open(tab, x, y); } finally { entering = false; }
  }
  async function open(tab, x, y) {
    const wc = tab.view.webContents;
    // the video: the one under the mouse, else the one playing, else the biggest; the page first, then its frames
    let hit = null;
    for (const f of frames(wc)) {
      const r = await run(f, FIND_JS(f === wc.mainFrame ? x : -1, f === wc.mainFrame ? y : -1));
      if (r) { hit = { f, r }; break; }
    }
    if (!hit) return 'none';
    if (!usable(tab) || tab.view.webContents !== wc || cur) { for (const f of frames(wc)) await run(f, UNMARK_JS(false)); return 'none'; }   // closed or moved meanwhile
    // inside an embedded player: each frame around it shows only that player
    for (let f = hit.f, info = hit.r; alive(f) && f.parent; f = f.parent) {
      info = await run(f.parent, FRAME_JS(info.w, info.h, f.url));
      if (!info) break;
    }

    const b = startBounds();
    const win = new BaseWindow(Object.assign({
      x: b.x, y: b.y, width: b.width, height: b.height, frame: false, transparent: true, backgroundColor: '#00000000',
      resizable: false, maximizable: false, minimizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false,
      alwaysOnTop: true, show: false, title: '3zT'
    }, o.icon || {}));
    win.setAlwaysOnTop(true, 'floating');
    const overlay = new WebContentsView({
      webPreferences: { preload: o.preload, contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, partition: 'zeus-ui' }
    });
    overlay.setBackgroundColor('#00000000');
    // the page moves here from its window (it keeps playing, nothing reloads)
    try { tab.win.win.contentView.removeChildView(tab.view); } catch (e) {}
    win.contentView.addChildView(tab.view);
    try { tab.view.setBorderRadius(R); } catch (e) {}
    win.contentView.addChildView(overlay);
    cur = { tab, win, overlay, frame: hit.f, grab: null, tracks: hit.f === wc.mainFrame && hasTracks(wc.getURL()) };
    tab.pip = true;
    layout();
    overlay.webContents.loadFile(o.file, { query: { lang: o.settings.data.lang === 'en' ? 'en' : 'ar' } }).catch(() => {});
    overlay.webContents.once('did-finish-load', () => { if (cur && cur.win === win && !win.isDestroyed()) win.showInactive(); });
    overlay.webContents.on('before-input-event', (e, i) => {
      // Alt+P again: back to the page, like in the browser window
      if (i.type === 'keyDown' && i.alt && !i.control && !i.meta && i.code === 'KeyP') { e.preventDefault(); exit({ focus: true }); }
    });
    // closed some other way (Alt+F4): like its close button
    win.on('close', e => { if (cur && cur.win === win) { e.preventDefault(); exit({ pause: true }); } });
    win.on('closed', () => { if (cur && cur.win === win) exit({ gone: true }); });
    // the page went to another address (not a site's own in-page change): the video is gone, so is the window
    cur.onNav = () => { if (cur && cur.tab === tab) exit({}); };
    wc.on('did-navigate', cur.onNav);
    // the site replaced its player (another frame, a new video): follow it; nothing left to show for a while: close
    let missing = 0;
    cur.tick = setInterval(async () => {
      if (!cur || cur.tab !== tab || cur.grab) return;
      if (await videoFrame()) { missing = 0; return; }
      if (!cur || cur.tab !== tab) return;
      for (const f of frames(wc)) { const r = await run(f, FIND_JS(-1, -1)); if (r && cur && cur.tab === tab) { cur.frame = f; missing = 0; return; } }
      if (++missing >= 3 && cur && cur.tab === tab) exit({});
    }, 2000);
    o.changed(tab);
    return 'on';
  }

  /* back to the page. pause: the close button (like Chrome); focus: show its tab */
  function exit(opt = {}) {
    const c = cur; if (!c) return;
    cur = null;
    const { tab, win, overlay } = c;
    tab.pip = false;
    clearInterval(c.tick);
    try { if (c.onNav && tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.removeListener('did-navigate', c.onNav); } catch (e) {}
    const view = tab.view;
    if (view) {
      try { if (!win.isDestroyed()) win.contentView.removeChildView(view); } catch (e) {}
      try { view.setBorderRadius(0); } catch (e) {}
      if (!view.webContents.isDestroyed()) for (const f of frames(view.webContents)) run(f, UNMARK_JS(!!opt.pause));
    }
    try { if (!overlay.webContents.isDestroyed()) overlay.webContents.close(); } catch (e) {}
    try { if (!opt.gone && !win.isDestroyed()) win.destroy(); } catch (e) {}
    o.returned(tab, { focus: !!opt.focus });
  }

  async function toggle(tab, x, y) {
    if (cur && cur.tab === tab) { exit({ focus: true }); return 'exit'; }
    if (cur) exit({});
    return enter(tab, x, y);
  }

  /* the buttons and the edges of the window (src/ui/pip.js) */
  const from = e => cur && e.sender === cur.overlay.webContents;
  ipcMain.handle('pip:state', async e => {
    if (!from(e)) return null;
    const f = await videoFrame();
    const s = f ? await run(f, STATE_JS) : null;
    return s ? Object.assign(s, { tracks: !!(cur && cur.tracks) }) : { none: true, tracks: !!(cur && cur.tracks) };
  });
  ipcMain.handle('pip:cmd', async (e, cmd, arg) => {
    if (!from(e)) return false;
    if (cmd === 'back') { exit({ focus: true }); return true; }
    if (cmd === 'close') { exit({ pause: true }); return true; }
    const f = await videoFrame(); if (!f) return false;
    if (cmd === 'play') return !!(await run(f, PLAY_JS));
    if (cmd === 'seek') return !!(await run(f, SEEK_JS(arg)));
    if ((cmd === 'next' || cmd === 'prev') && cur && cur.tracks) return !!(await run(cur.tab.view.webContents.mainFrame, TRACK_JS(cmd)));
    return false;
  });
  // moving and resizing: the window follows the mouse (screen points, the same units as the window's place)
  const EDGES = new Set(['move', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
  ipcMain.on('pip:grab', (e, kind) => {
    if (!from(e) || !EDGES.has(kind) || cur.win.isDestroyed()) return;
    cur.grab = { kind, p: screen.getCursorScreenPoint(), b: cur.win.getBounds() };
  });
  ipcMain.on('pip:drag', e => {
    if (!from(e) || !cur.grab || cur.win.isDestroyed()) return;
    const g = cur.grab, p = screen.getCursorScreenPoint(), dx = p.x - g.p.x, dy = p.y - g.p.y;
    let { x, y, width, height } = g.b;
    if (g.kind === 'move') { x += dx; y += dy; }
    else {
      if (g.kind.includes('e')) width = g.b.width + dx;
      if (g.kind.includes('s')) height = g.b.height + dy;
      if (g.kind.includes('w')) width = g.b.width - dx;
      if (g.kind.includes('n')) height = g.b.height - dy;
      width = Math.max(MIN_W + 2 * M, width); height = Math.max(MIN_H + 2 * M, height);
      if (g.kind.includes('w')) x = g.b.x + g.b.width - width;
      if (g.kind.includes('n')) y = g.b.y + g.b.height - height;
    }
    cur.win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
    if (g.kind !== 'move') layout();
  });
  // tests only: the same as a drag that ends at these bounds (a test machine has no mouse to drag with)
  if (process.env.ZEUS_E2E) ipcMain.handle('pip:testBounds', (e, b) => {
    if (!from(e) || cur.win.isDestroyed() || !b) return null;
    cur.win.setBounds(fit({ x: +b.x || 0, y: +b.y || 0, width: +b.width || 0, height: +b.height || 0 }));
    layout(); save();
    return cur.win.getBounds();
  });
  ipcMain.on('pip:drop', e => {
    if (!from(e) || cur.win.isDestroyed()) return;
    cur.grab = null;
    cur.win.setBounds(fit(cur.win.getBounds()));   // kept on the screen
    layout(); save();
  });

  return {
    toggle, exit,
    active: () => (cur ? cur.tab : null),
    // the window's buttons speak the browser's language
    lang: () => { if (cur && !cur.overlay.webContents.isDestroyed()) cur.overlay.webContents.send('pip:lang', o.settings.data.lang === 'en' ? 'en' : 'ar'); }
  };
};
