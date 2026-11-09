'use strict';
/*
 * Runs in every tab (main frame).
 *  - our own pages (file://.../newtab/*.html) get the `zeus` API
 *  - websites get two built-in features, from this isolated world (the page can't touch them):
 *      * password autofill (click a login field -> pick an account) + offer to save
 *      * YouTube ad blocking (cleans the player data before YouTube's own scripts read it)
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const internal = location.protocol === 'file:' && /\/newtab\/(newtab|history|tasks|passwords|settings|downloads)\.html$/i.test(decodeURIComponent(location.pathname));

if (internal) {
  contextBridge.exposeInMainWorld('zeus', {
    getBookmarks: () => ipcRenderer.invoke('bm:get'),
    favicons: urls => ipcRenderer.invoke('fav:get', urls),
    searchHistory: (text, max) => ipcRenderer.invoke('history:search', text, max),
    deleteHistory: url => ipcRenderer.invoke('history:delete', url),
    clearHistory: () => ipcRenderer.invoke('history:clear'),
    suggest: (q, hl) => ipcRenderer.invoke('suggest', q, hl),
    getLang: () => ipcRenderer.invoke('lang:get'),
    setLang: l => ipcRenderer.send('set', 'lang', l),
    onLang: fn => ipcRenderer.on('lang', (e, l) => fn(l)),
    takeImport: () => ipcRenderer.invoke('ntp:take'),
    onImportReady: fn => ipcRenderer.on('import-ready', () => fn()),
    onStrip: fn => ipcRenderer.on('strip', (e, h) => fn(h)),
    tasks: () => ipcRenderer.invoke('tasks:get'),
    sleepTab: id => ipcRenderer.invoke('tasks:sleep', id),
    pwList: () => ipcRenderer.invoke('pw:list'),
    pwReveal: id => ipcRenderer.invoke('pw:reveal', id),
    pwDelete: id => ipcRenderer.invoke('pw:delete', id),
    pwImport: () => ipcRenderer.invoke('pw:import'),
    pwDeleteFile: f => ipcRenderer.invoke('pw:deleteFile', f),
    pwUnnever: s => ipcRenderer.invoke('pw:unnever', s),
    // settings page
    settings: () => ipcRenderer.invoke('settings:get'),
    set: (k, v) => ipcRenderer.send('set', k, v),
    act: (cmd, arg) => ipcRenderer.invoke('settings:act', cmd, arg),
    onSettings: fn => ipcRenderer.on('settings:changed', () => fn()),
    // downloads page
    dlList: () => ipcRenderer.invoke('dl:list'),
    dlAct: (id, cmd) => ipcRenderer.invoke('dl:act', id, cmd),
    dlClear: () => ipcRenderer.invoke('dl:clear'),
    dlFolder: () => ipcRenderer.invoke('dl:folder'),
    dlIcon: id => ipcRenderer.invoke('dl:icon', id),
    onDl: fn => ipcRenderer.on('dl:changed', () => fn())
  });
} else if (/^https?:$/.test(location.protocol)) {
  /* ================= sites that are already dark keep their own colours =================
     3zT darkens light websites. A site that is dark by itself (YouTube's dark theme, for example) but does not say
     so would get its white bits (volume bar, sliders, icons) turned black. When the page is dark already,
     tell Chromium "this page is dark" so it leaves it exactly as the site made it. */
  (() => {
    const ID = '__3zt_cs';
    const rgb = el => {
      const m = String(getComputedStyle(el).backgroundColor).match(/[\d.]+/g);
      if (!m) return null;
      const [r, g, b, a = 1] = m.map(Number);
      return a < 0.5 ? null : (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    // the colour you actually see at a point: the first element (going outwards) that has a background
    const seen = el => { for (; el && el.nodeType === 1; el = el.parentElement) { const l = rgb(el); if (l != null) return l; } return null; };
    const isDark = () => {
      const de = document.documentElement; if (!de) return false;
      const pts = [[0.5, 0.5], [0.5, 0.12], [0.2, 0.7], [0.8, 0.7], [0.5, 0.9]];
      let dark = 0, light = 0;
      for (const [x, y] of pts) {
        const l = seen(document.elementFromPoint(innerWidth * x, innerHeight * y));
        if (l == null) continue; if (l < 0.35) dark++; else light++;
      }
      if (dark + light === 0) { const l = (document.body && rgb(document.body)) ?? rgb(de); return l != null && l < 0.35; }
      return dark > light;
    };
    let t = 0;
    const check = () => {
      t = 0;
      const de = document.documentElement; if (!de || !document.body) return;
      const st = document.getElementById(ID);
      const dark = isDark();
      if (dark && !st) { const s = document.createElement('style'); s.id = ID; s.textContent = ':root{color-scheme:dark !important}'; (document.head || de).appendChild(s); }
      else if (!dark && st) st.remove();
    };
    const soon = ms => { if (!t) t = setTimeout(check, ms); };
    document.addEventListener('DOMContentLoaded', () => {
      check();
      // the site may switch its theme later (YouTube's dark/light switch changes attributes on <html>/<body>)
      try {
        const mo = new MutationObserver(() => soon(250));
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'dark', 'theme', 'data-theme', 'data-color-mode'] });
        if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'dark', 'theme', 'data-theme'] });
      } catch (e) {}
    }, { once: true });
    addEventListener('load', () => { check(); setTimeout(check, 1200); setTimeout(check, 4000); }, { once: true });
  })();

  /* ================= faster clicks: while the mouse is on a link, connect to its site
     (address lookup + secure connection are done before you click, like Chrome) ================= */
  (() => {
    const seen = new Set(); let t = 0;
    const warm = a => {
      let u; try { u = new URL(a.href, location.href); } catch (e) { return; }
      if (!/^https?:$/.test(u.protocol) || u.origin === location.origin || seen.has(u.origin)) return;
      seen.add(u.origin); if (seen.size > 80) seen.clear();
      ipcRenderer.send('net:warm', u.origin);
    };
    const link = e => (e.target && e.target.closest ? e.target.closest('a[href]') : null);
    addEventListener('pointerover', e => { if (!e.isTrusted) return; clearTimeout(t); const a = link(e); if (a) t = setTimeout(() => warm(a), 60); }, { capture: true, passive: true });
    addEventListener('pointerdown', e => { if (!e.isTrusted) return; const a = link(e); if (a) warm(a); }, { capture: true, passive: true });
  })();
  /* ================= Google sign-in: look like Firefox (Google blocks Electron browsers) ================= */
  if (/^accounts\.(google|youtube)\.com$/i.test(location.hostname)) {
    let ua = '';
    try { ua = ipcRenderer.sendSync('signin:ua'); } catch (e) {}
    if (ua) {
      const code = `(() => {
        const UA = ${JSON.stringify(ua)};
        const N = Navigator.prototype;
        const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch (e) {} };
        def(N, 'userAgent', UA); def(N, 'appVersion', UA.slice(8)); def(N, 'vendor', ''); def(N, 'userAgentData', undefined);
        def(N, 'platform', UA.includes('Windows') ? 'Win32' : 'Linux x86_64'); def(N, 'oscpu', UA.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : 'Linux x86_64');
        try { delete window.chrome; } catch (e) {}
        // Chrome's passkeys live inside Chrome and aren't reachable here: go straight to the password
        try { Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true }); } catch (e) {}
        try { const c = navigator.credentials; if (c && c.get) { const g = c.get.bind(c); c.get = o => (o && o.publicKey ? Promise.reject(new DOMException('Not allowed', 'NotAllowedError')) : g(o)); } } catch (e) {}
      })();`;
      try {
        if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: new Function(code) });
        else webFrame.executeJavaScript(code);
      } catch (e) { try { webFrame.executeJavaScript(code); } catch (x) {} }
    }
  }

  /* ================= YouTube ad blocking ================= */
  if (/(^|\.)youtube\.com$/i.test(location.hostname)) {
    let on = false;
    try { on = ipcRenderer.sendSync('yt:adblock'); } catch (e) {}
    if (on) {
      const code = `(() => {
        // what we replace must still look built in: YouTube checks Function.prototype.toString to spot blockers
        const native = new WeakMap();
        const fts = Function.prototype.toString;
        const ts = function toString() { return native.has(this) ? native.get(this) : fts.call(this); };
        native.set(ts, fts.call(fts));
        Function.prototype.toString = ts;
        const disguise = (f, orig) => { native.set(f, fts.call(orig)); try { Object.defineProperty(f, 'name', { value: orig.name }); } catch (e) {} return f; };
        // the "Ad blockers are not allowed" popup: YouTube decides with these flags (uBlock Origin sets the same ones)
        const fixed = (obj, key, value) => { try { Object.defineProperty(obj, key, { configurable: true, get() { return value; }, set() {} }); } catch (e) {} };
        fixed(Object.prototype, 'adBlocksFound', 0);
        // not 'hasAllowedInstreamAd': forcing it on every object stops YouTube from drawing the suggested videos
        const noPopup = () => { try { const p = window.yt && yt.config_ && yt.config_.openPopupConfig; if (p && p.supportedPopups) p.supportedPopups.adBlockMessageViewModel = false; } catch (e) {} };
        noPopup(); const np = setInterval(noPopup, 200); setTimeout(() => clearInterval(np), 30000);
        const KEYS = ['adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams'];
        const clean = o => {
          try {
            if (!o || typeof o !== 'object') return o;
            for (const k of KEYS) if (k in o) delete o[k];
            if (o.playerResponse && typeof o.playerResponse === 'object') for (const k of KEYS) delete o.playerResponse[k];
            if (Array.isArray(o)) for (const x of o) if (x && x.playerResponse) for (const k of KEYS) delete x.playerResponse[k];
          } catch (e) {}
          return o;
        };
        const jp = JSON.parse;
        JSON.parse = disguise(function parse() { return clean(jp.apply(this, arguments)); }, jp);
        const rj = Response.prototype.json;
        Response.prototype.json = disguise(function json() { return rj.apply(this, arguments).then(clean); }, rj);
        let pr;
        try { Object.defineProperty(window, 'ytInitialPlayerResponse', { configurable: true, get() { return pr; }, set(v) { pr = clean(v); } }); } catch (e) {}
        // anything that still slips through: mute, fast-forward, press "skip"
        let muted = null;
        setInterval(() => {
          // if the popup still opens: close it and keep the video playing
          const enf = document.querySelector('ytd-enforcement-message-view-model');
          if (enf) {
            const d = enf.closest('tp-yt-paper-dialog'); if (d) d.remove(); else enf.remove();
            document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(x => x.remove());
            const v0 = document.querySelector('#movie_player video'); if (v0 && v0.paused) v0.play().catch(() => {});
          }
          const p = document.querySelector('#movie_player'); if (!p) return;
          const v = p.querySelector('video');
          if (p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting')) {
            if (v) { if (muted === null) muted = v.muted; v.muted = true; if (isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration; v.playbackRate = 16; }
            const b = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[id^="skip-button"]');
            if (b) b.click();
          } else if (muted !== null && v) { v.muted = muted; muted = null; if (v.playbackRate === 16) v.playbackRate = 1; }
        }, 250);
      })();`;
      try {
        if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: new Function(code) });
        else webFrame.executeJavaScript(code);
      } catch (e) { try { webFrame.executeJavaScript(code); } catch (x) {} }
      const css = `ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer, ytd-promoted-sparkles-web-renderer,
        ytd-promoted-video-renderer, ytd-display-ad-renderer, ytd-compact-promoted-video-renderer, ytd-action-companion-ad-renderer,
        ytd-player-legacy-desktop-watch-ads-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
        #masthead-ad, #player-ads, .ytp-ad-overlay-container, .ytp-ad-message-container, ytd-merch-shelf-renderer,
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer), ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
        tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ytd-enforcement-message-view-model,
        body:has(ytd-enforcement-message-view-model) tp-yt-iron-overlay-backdrop { display: none !important; }`;
      try { webFrame.insertCSS(css); } catch (e) {}
    }
  }

  /* ================= built-in features (used to be extensions) ================= */
  let cfg = {};
  try { cfg = ipcRenderer.sendSync('site:cfg') || {}; } catch (e) {}
  const mainWorld = code => {
    try { if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: new Function(code) }); else webFrame.executeJavaScript(code); }
    catch (e) { try { webFrame.executeJavaScript(code); } catch (x) {} }
  };

  /* --- Twitch ads (TwitchAdSolutions "vaft", runs before Twitch's own player) --- */
  if (cfg.twitch) { let c = ''; try { c = ipcRenderer.sendSync('site:code', 'twitch'); } catch (e) {} if (c) mainWorld(c); }

  if (cfg.yt) {
    const yt = cfg.yt;
    /* --- Clean YouTube: switches become attributes on <html>, the CSS hides things --- */
    let clean = yt.clean || {};
    try { webFrame.insertCSS(yt.cleanCss || ''); } catch (e) {}
    const applyClean = () => { const h = document.documentElement; if (h) for (const [k, v] of Object.entries(clean)) h.setAttribute(k, String(v)); };
    applyClean();
    document.addEventListener('readystatechange', applyClean);
    const autoplayOff = () => {
      if (!clean['hide-yt-autoplay']) return;
      const b = document.querySelector('.ytp-autonav-toggle-button-container > .ytp-autonav-toggle-button');
      if (b && b.getAttribute('aria-checked') === 'true') { const btn = document.querySelector('button.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]'); if (btn) btn.click(); }
    };
    ipcRenderer.on('site:update', (e, c) => { if (c && c.yt) { clean = c.yt.clean || {}; applyClean(); autoplayOff(); } });

    /* --- SponsorBlock: skip sponsor parts of the video --- */
    let segs = [], segFor = '', bound = null, muted = false, note = null;
    const vid = () => { try { const u = new URL(location.href); return u.pathname === '/watch' ? u.searchParams.get('v') || '' : (/^\/(shorts|live)\/([\w-]{11})/.exec(u.pathname) || [])[2] || ''; } catch (e) { return ''; } };
    const say = text => {
      if (!document.body) return;
      if (!note) {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;z-index:2147483647;bottom:84px;left:50%;transform:translateX(-50%);pointer-events:none';
        note = host.attachShadow({ mode: 'closed' });
        note.innerHTML = '<style>div{font:600 13px system-ui,sans-serif;color:#fff;background:rgba(20,20,24,.9);padding:8px 14px;border-radius:16px;opacity:0;transition:opacity .2s}div.on{opacity:1}</style><div></div>';
        document.body.appendChild(host);
      }
      const d = note.querySelector('div'); d.textContent = text; d.classList.add('on'); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('on'), 2200);
    };
    const NAMES = { sponsor: ['إعلان', 'sponsor'], selfpromo: ['ترويج', 'self-promotion'], interaction: ['طلب اشتراك', 'subscribe reminder'], intro: ['المقدمة', 'intro'], outro: ['الخاتمة', 'outro'], preview: ['ملخص', 'preview'], filler: ['حشو', 'filler'], music_offtopic: ['جزء بدون موسيقى', 'non-music part'] };
    const onTime = e => {
      const v = e.target; if (!segs.length || !v || v.paused && v.currentTime === 0) return;
      const t = v.currentTime; let inMute = false;
      for (const s of segs) {
        if (t >= s.s && t < s.e - 0.25) {
          if (s.a === 'mute') { inMute = true; continue; }
          v.currentTime = s.e;
          const n = NAMES[s.c] || [s.c, s.c]; say(cfg.lang === 'en' ? `Skipped: ${n[1]}` : `⏭ تخطّيت: ${n[0]}`);
          return;
        }
      }
      if (inMute !== muted) { muted = inMute; v.muted = inMute; }
    };
    const bind = () => {
      const v = document.querySelector('#movie_player video, video.html5-main-video');
      if (v && v !== bound) { if (bound) bound.removeEventListener('timeupdate', onTime); v.addEventListener('timeupdate', onTime); bound = v; }
    };
    const refresh = async () => {
      autoplayOff();
      if (!yt.sponsor || !yt.sponsor.length) return;
      const id = vid(); if (id === segFor) { bind(); return; }
      segFor = id; segs = []; muted = false;
      if (!id) return;
      try { const r = await ipcRenderer.invoke('sb:get', id); if (segFor === id) segs = r || []; } catch (e) {}
      bind();
    };
    document.addEventListener('yt-navigate-finish', refresh);
    document.addEventListener('DOMContentLoaded', refresh);
    setInterval(() => { if (vid() !== segFor) refresh(); else bind(); }, 2000);

    /* --- Ambient light for YouTube: the original scripts, in their own isolated world (like an extension's),
           so YouTube's script rules (CSP / Trusted Types) don't apply to them --- */
    if (yt.ambient && !/^\/(live_chat|embed)/.test(location.pathname)) {
      const WORLD = 1010, EV = 'zeus-amb-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { webFrame.setIsolatedWorldInfo(WORLD, { name: '3zT Ambient light', securityOrigin: 'zeus-res://ambient', csp: "script-src 'self' 'unsafe-eval' zeus-res:; object-src 'none'" }); } catch (e) {}
      const inWorld = code => webFrame.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]).catch(err => console.warn('[3zT] ambient light', err));
      const wrap = c => '(function (chrome) {\n' + c + '\n})(globalThis.__zeusChrome);';
      // requests from that world (settings storage, loading the main script) come here as events with a secret name
      document.addEventListener(EV + '-q', async e => {
        let m; try { m = JSON.parse(e.detail); } catch (x) { return; }
        let r = null;
        try {
          if (m.op === 'get') r = await ipcRenderer.invoke('amb:get', m.keys === undefined ? null : m.keys);
          else if (m.op === 'set') { r = await ipcRenderer.invoke('amb:get', Object.keys(m.obj || {})); await ipcRenderer.invoke('amb:set', m.obj); }
          else if (m.op === 'remove') await ipcRenderer.invoke('amb:remove', m.keys);
          else if (m.op === 'main') { const c = await ipcRenderer.invoke('site:ambientMain'); if (c) await inWorld(wrap(c)); }
        } catch (x) {}
        document.dispatchEvent(new CustomEvent(EV + '-a', { detail: JSON.stringify({ id: m.id, r }) }));
      });
      const prelude = `(() => {
        const EV = ${JSON.stringify(EV)}; let seq = 0; const pend = new Map(), listeners = new Set();
        document.addEventListener(EV + '-a', e => { let m; try { m = JSON.parse(e.detail); } catch (x) { return; } const p = pend.get(m.id); if (p) { pend.delete(m.id); p(m.r); } });
        const call = (op, a) => new Promise(res => { const id = ++seq; pend.set(id, res); document.dispatchEvent(new CustomEvent(EV + '-q', { detail: JSON.stringify(Object.assign({ op, id }, a)) })); });
        const fire = ch => { for (const f of listeners) { try { f(ch, 'local'); } catch (e) {} } };
        const ev = { addListener: f => listeners.add(f), removeListener: f => listeners.delete(f), hasListener: f => listeners.has(f) };
        const done = (p, cb) => { if (typeof cb === 'function') p.then(v => cb(v)); return p; };
        const local = {
          get: (keys, cb) => done(call('get', { keys: keys === undefined ? null : keys }).then(r => r || {}), cb),
          set: (obj, cb) => done(call('set', { obj }).then(old => { const c = {}; for (const k of Object.keys(obj || {})) c[k] = { newValue: obj[k], oldValue: old && old[k] }; fire(c); }), cb),
          remove: (keys, cb) => { const ks = [].concat(keys || []); return done(call('remove', { keys: ks }).then(() => { const c = {}; for (const k of ks) c[k] = { newValue: undefined }; fire(c); }), cb); },
          onChanged: ev
        };
        globalThis.__zeusChrome = {
          runtime: { id: '3zt-ambient-light', lastError: undefined, getURL: p => 'zeus-res://ambient/' + String(p || '').replace(/^\\//, ''),
            getManifest: () => ({ name: 'Ambient light for YouTube™', version: '2.38.17', manifest_version: 3 }),
            sendMessage: () => Promise.resolve(), onMessage: { addListener() {}, removeListener() {} } },
          storage: { local, onChanged: ev }
        };
        globalThis.__zeusAmbientMain = () => call('main');
      })();`;
      let c = ''; try { c = ipcRenderer.sendSync('site:code', 'ambientContent'); } catch (e) {}
      if (c) inWorld(prelude + '\n' + wrap(c));
    }
  }

  /* --- very fast mode: start loading a link the moment the mouse rests on it --- */
  if (cfg.fast) {
    const done = new Set();
    const SKIP = /log-?out|sign-?out|log-?off|delete|remove|unsubscribe|cart|checkout|\.(zip|exe|msi|rar|7z|pdf|mp4|mkv|iso)(\?|$)/i;
    const prefetch = href => {
      try {
        const u = new URL(href, location.href);
        if (u.origin !== location.origin || !/^https?:$/.test(u.protocol) || SKIP.test(u.href)) return;
        u.hash = ''; const k = u.href;
        if (k === location.href.split('#')[0] || done.has(k) || done.size > 40) return;
        done.add(k);
        const l = document.createElement('link'); l.rel = 'prefetch'; l.href = k; (document.head || document.documentElement).appendChild(l);
      } catch (e) {}
    };
    let hoverT = 0;
    document.addEventListener('mouseover', e => {
      const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
      clearTimeout(hoverT); hoverT = setTimeout(() => prefetch(a.href), 65);
    }, { capture: true, passive: true });
    document.addEventListener('mouseout', () => clearTimeout(hoverT), { capture: true, passive: true });
    document.addEventListener('mousedown', e => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) prefetch(a.href); }, { capture: true, passive: true });
  }

  /* ================= passwords ================= */
  const isPw = el => el instanceof HTMLInputElement && el.type === 'password';
  const isUserish = el => el instanceof HTMLInputElement && /^(text|email|tel|)$/i.test(el.type || 'text');
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const follows = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  function pwFieldAfter(user) {
    const scope = user.form || document;
    return [...scope.querySelectorAll('input[type=password]')].find(p => visible(p) && follows(user, p)) || null;
  }
  function userFieldBefore(pw) {
    const scope = pw.form || document;
    let best = null;
    for (const i of scope.querySelectorAll('input')) if (isUserish(i) && visible(i) && follows(i, pw)) best = i;
    return best;
  }
  const looksLikeLogin = el => /user|mail|login|account|identifier|phone|اسم|بريد/i.test([el.autocomplete, el.name, el.id, el.placeholder, el.getAttribute('aria-label')].join(' '));
  function setVal(el, v) {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus();
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* the account picker under the field (closed shadow DOM: the page can't read or restyle it) */
  let host = null, shadow = null, accounts = null;
  function hideMenu() { if (host) { host.remove(); host = null; } }
  function showMenu(field, list) {
    hideMenu();
    host = document.createElement('div');
    host.style.cssText = 'position:absolute;z-index:2147483647;top:0;left:0;';
    shadow = host.attachShadow({ mode: 'closed' });
    const r = field.getBoundingClientRect();
    const rtl = getComputedStyle(field).direction === 'rtl';
    shadow.innerHTML = `<style>
      .m{position:fixed;min-width:240px;max-width:360px;background:#202127;color:#eee;border:1px solid rgba(255,255,255,.14);border-radius:12px;
        box-shadow:0 12px 32px rgba(0,0,0,.45);padding:6px;font:13px "Segoe UI",Tahoma,sans-serif}
      .h{padding:4px 8px 6px;font-size:11px;opacity:.6}
      .i{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer}
      .i:hover{background:rgba(255,255,255,.1)}
      .k{width:26px;height:26px;border-radius:50%;background:#2f3a52;display:grid;place-items:center;font-size:12px;flex:none}
      .u{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.d{font-size:11px;opacity:.55}</style>
      <div class="m" dir="auto" style="top:${Math.round(r.bottom + 4)}px;${rtl ? 'right:' + Math.round(innerWidth - r.right) : 'left:' + Math.round(r.left)}px">
        <div class="h">3zT · كلمات السر المحفوظة</div>
        ${list.map(a => `<div class="i" data-id="${a.id}"><span class="k">🔑</span><span><div class="u"></div><div class="d"></div></span></div>`).join('')}
      </div>`;
    shadow.querySelectorAll('.i').forEach((el, n) => {
      el.querySelector('.u').textContent = list[n].username || '(بدون اسم مستخدم)';
      el.querySelector('.d').textContent = list[n].host + ' · ••••••••';
      el.addEventListener('mousedown', async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const c = await ipcRenderer.invoke('pw:get', el.dataset.id);
        hideMenu(); if (!c) return;
        const pw = isPw(field) ? field : pwFieldAfter(field);
        const user = isPw(field) ? userFieldBefore(field) : field;
        if (user && c.username) setVal(user, c.username);
        if (pw) setVal(pw, c.password);
      });
    });
    document.documentElement.appendChild(host);
  }
  document.addEventListener('focusin', async e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !visible(el)) return;
    if (!isPw(el) && !(isUserish(el) && (pwFieldAfter(el) || looksLikeLogin(el)))) return;
    if (accounts === null) { try { accounts = await ipcRenderer.invoke('pw:query'); } catch (x) { accounts = []; } }
    if (accounts.length && document.activeElement === el) showMenu(el, accounts);
  }, true);
  document.addEventListener('focusout', () => setTimeout(hideMenu, 150), true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); }, true);
  addEventListener('scroll', hideMenu, true);

  /* offer to save: remember the user name across steps (sites that ask for the e-mail first) */
  let lastUser = '';
  try { lastUser = sessionStorage.getItem('__3zt_u') || ''; } catch (e) {}
  document.addEventListener('change', e => {
    const el = e.target;
    if (isUserish(el) && (looksLikeLogin(el) || pwFieldAfter(el)) && el.value) { lastUser = el.value; try { sessionStorage.setItem('__3zt_u', lastUser); } catch (x) {} }
  }, true);
  let offered = '';
  function offer(form) {
    const pws = [...(form || document).querySelectorAll('input[type=password]')].filter(p => p.value);
    if (!pws.length) return;
    const pw = pws[pws.length - 1];               // on sign-up / change forms, the new password is the last one
    const user = userFieldBefore(pws[0]);
    const username = (user && user.value) || lastUser || '';
    const key = username + '\u0000' + pw.value;
    if (key === offered) return; offered = key;
    ipcRenderer.send('pw:offer', { username, password: pw.value });
  }
  document.addEventListener('submit', e => offer(e.target), true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button, input[type=submit], [role=button]');
    if (b) offer(b.form || b.closest('form'));
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && isPw(e.target)) offer(e.target.form); }, true);
}

/* ================= page translation in place (3zT's translate button) ================= */
if (/^https?:$/.test(location.protocol)) {
  let on = false, tl = 'ar', obs = null, timer = null;
  const orig = new Map();      // text node -> its original text
  const shown = new Map();     // text node -> the translation we put there
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'KBD', 'SAMP', 'VAR', 'SVG', 'MATH', 'TEMPLATE']);
  const skipEl = el => { for (let p = el; p; p = p.parentElement) { if (SKIP.has(p.tagName) || p.isContentEditable || p.getAttribute('translate') === 'no' || p.classList.contains('notranslate')) return true; } return false; };
  const wanted = n => { const v = n.nodeValue; return v && /\p{L}/u.test(v) && v.trim().length > 0 && !(shown.get(n) === v) && n.parentElement && !skipEl(n.parentElement); };
  const collect = root => {
    const out = []; if (!root) return out;
    if (root.nodeType === 3) { if (wanted(root)) out.push(root); return out; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (wanted(n)) out.push(n);
    return out;
  };
  const inView = n => { try { const r = n.parentElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight * 1.5 && r.width > 0; } catch (e) { return false; } };
  async function run(nodes) {
    if (!nodes.length) return;
    nodes.sort((a, b) => inView(b) - inView(a));   // what you are looking at first
    const parts = []; for (let i = 0; i < nodes.length; i += 60) parts.push(nodes.slice(i, i + 60));
    let next = 0;
    const worker = async () => {
      while (on && next < parts.length) {
        const part = parts[next++];
        let res = []; try { res = await ipcRenderer.invoke('tr:batch', part.map(n => n.nodeValue.trim()), tl); } catch (e) {}
        if (!on) return;
        part.forEach((n, j) => {
          const r = res[j]; if (!r || !n.isConnected) return;
          const v = n.nodeValue, lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0], t = lead + r + trail;
          if (!orig.has(n) || shown.get(n) !== v) orig.set(n, v);
          shown.set(n, t); n.nodeValue = t;
        });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }
  const pending = new Set();
  const flush = () => { timer = null; const nodes = []; for (const r of pending) if (r.isConnected) nodes.push(...collect(r)); pending.clear(); run([...new Set(nodes)]); };
  function start() {
    if (on) return; on = true;
    const go = () => {
      if (!on || !document.body) return;
      run(collect(document.body));
      obs = new MutationObserver(ms => {
        for (const m of ms) {
          if (m.type === 'characterData') { if (shown.get(m.target) !== m.target.nodeValue) pending.add(m.target); }
          else for (const a of m.addedNodes) pending.add(a);
        }
        if (pending.size && !timer) timer = setTimeout(flush, 300);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
  }
  function stop() {
    on = false; if (obs) { obs.disconnect(); obs = null; } clearTimeout(timer); timer = null; pending.clear();
    for (const [n, v] of orig) if (n.isConnected && shown.get(n) === n.nodeValue) n.nodeValue = v;
    orig.clear(); shown.clear();
  }
  ipcRenderer.on('tr:start', (e, lang) => { tl = lang === 'en' ? 'en' : 'ar'; start(); });
  ipcRenderer.on('tr:stop', stop);
}
