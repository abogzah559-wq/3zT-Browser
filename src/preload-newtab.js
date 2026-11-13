'use strict';
/*
 * Runs in every tab (main frame).
 *  - our own pages (file://.../newtab/*.html) get the `zeus` API
 *  - websites get two built-in features, from this isolated world (the page can't touch them):
 *      * password autofill (click a login field -> pick an account) + offer to save
 *      * YouTube ad blocking (cleans the player data before YouTube's own scripts read it)
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// frames inside a page (iframes) only get the passkey fix below; everything else is for the page itself
const SUB = typeof process !== 'undefined' && process.isMainFrame === false;
const inMainWorld = code => {
  try { if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: new Function(code) }); else webFrame.executeJavaScript(code); }
  catch (e) { try { webFrame.executeJavaScript(code); } catch (x) {} }
};
/* sign-in pages and the "Windows Security" window: see where it is used below.
   mode: 'off'   = passkeys are off (the default): passkey requests are answered "no passkey" at once, so the site
                   carries on with the password. The one exception is a security key used as a second step for an
                   account (the site names the account's key) right after you clicked: that still reaches Windows.
         'on'    = passkeys allowed: only requests you did not ask for are refused (background, or "any passkey" without a click)
         'nofix' = tests only: nothing changed
   ua:   Google's sign-in only: look like Firefox (Google refuses Electron browsers)
   Everything is applied again inside blank frames and windows of the same page (about:blank, window.open), because
   sign-in pages take an untouched copy of navigator.credentials.get from such a frame. The changed functions
   behave like built-in ones toward the page (toString shows the original source, no prototype, can't be "new"ed). */
const pkCode = (mode, ua) => `(() => {
  'use strict';
  const MODE = ${JSON.stringify(mode)}, UA = ${JSON.stringify(ua || '')};
  const fts0 = Function.prototype.toString;
  const src = f => { try { return fts0.call(f); } catch (e) { return 'function () { [native code] }'; } };
  const native = new WeakMap();      // our function -> the source text of the one it replaced
  const done = new WeakSet(), foreign = new WeakSet();
  const same = (f, orig, name) => { native.set(f, src(orig)); try { Object.defineProperty(f, 'name', { value: name || orig.name, configurable: true }); } catch (e) {} try { Object.defineProperty(f, 'length', { value: orig.length, configurable: true }); } catch (e) {} return f; };
  const setFn = (o, k, f) => { const d = o && Object.getOwnPropertyDescriptor(o, k); if (!d || typeof d.value !== 'function') return; try { Object.defineProperty(o, k, { value: same(f(d.value), d.value), configurable: true, writable: true, enumerable: d.enumerable }); } catch (e) {} };
  const setGet = (o, k, f) => { const d = o && Object.getOwnPropertyDescriptor(o, k); if (!d || !d.get) return; try { Object.defineProperty(o, k, Object.assign({}, d, { get: same(f(d.get), d.get) })); } catch (e) {} };
  // methods written as { m() {} } are like built-in ones: no prototype, can't be called with "new"
  const install = w => {
    if (!w || foreign.has(w)) return;
    let realm;   // one per document's global (a frame that loads a new page gets a new one)
    try { realm = w.document && w.Function.prototype; } catch (e) { foreign.add(w); return; }   // another site's frame: its own copy of this runs there
    if (!realm || done.has(realm)) return;
    done.add(realm);
    try {
      // toString of a changed function shows the built-in source (checked by sign-in pages)
      const FP = w.Function.prototype, fts = FP.toString;
      if (!native.has(fts)) {
        const ts = ({ toString() { return native.has(this) ? native.get(this) : fts.call(this); } }).toString;
        native.set(ts, src(fts));
        try { Object.defineProperty(FP, 'toString', { value: ts, configurable: true, writable: true, enumerable: false }); } catch (e) {}
      }
      const DE = w.DOMException, P = w.Promise;
      const no = () => P.reject(new DE('The operation either timed out or was not allowed.', 'NotAllowedError'));
      if (UA) {
        const N = w.Navigator.prototype;
        const val = { userAgent: UA, appVersion: UA.slice(8), vendor: '', userAgentData: undefined, platform: UA.includes('Windows') ? 'Win32' : 'Linux x86_64', oscpu: UA.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : 'Linux x86_64' };
        for (const k of Object.keys(val)) {
          const g = Object.getOwnPropertyDescriptor({ get [k]() { return val[k]; } }, k).get;
          const d = Object.getOwnPropertyDescriptor(N, k);
          if (d && d.get) { same(g, d.get); try { Object.defineProperty(N, k, Object.assign({}, d, { get: g })); } catch (e) {} }
          else { native.set(g, 'function get ' + k + '() { [native code] }'); try { Object.defineProperty(N, k, { get: g, configurable: true, enumerable: true }); } catch (e) {} }
        }
        try { delete w.chrome; } catch (e) {}
        // Chrome's passkeys live inside Chrome and aren't reachable here: straight to the password
        try { Object.defineProperty(w, 'PublicKeyCredential', { value: undefined, configurable: true, writable: true }); } catch (e) {}
      }
      if (MODE !== 'nofix') {
        const CC = w.CredentialsContainer && w.CredentialsContainer.prototype;
        setFn(CC, 'get', orig => ({ get(opts) {
          if (opts && opts.publicKey) {
            const ac = w.navigator.userActivation, youAsked = !!(ac && ac.isActive);
            if (opts.mediation === 'conditional') {
              // the background "passkey autofill" request: waits forever (no list to show), like Chrome when you pick nothing
              return new P((res, rej) => { const s = opts.signal; if (s) { if (s.aborted) return rej(s.reason || new DE('The operation was aborted.', 'AbortError')); s.addEventListener('abort', () => rej(s.reason || new DE('The operation was aborted.', 'AbortError')), { once: true }); } });
            }
            if (UA || opts.mediation === 'immediate') return no();
            // a request for "any passkey" (no account named) or one you didn't ask for (no click or key just before):
            // answered as if you pressed Cancel. Passkeys off: only an account's own security key after a click goes through.
            const named = Array.isArray(opts.publicKey.allowCredentials) && opts.publicKey.allowCredentials.length > 0;
            if (MODE === 'off' ? !(named && youAsked) : (!named && !youAsked)) return no();
          }
          return orig.apply(this, arguments);
        } }).get);
        const PKC = w.PublicKeyCredential;
        if (PKC) {
          setFn(PKC, 'isConditionalMediationAvailable', () => ({ isConditionalMediationAvailable() { return P.resolve(false); } }).isConditionalMediationAvailable);
          if (MODE === 'off') setFn(PKC, 'isUserVerifyingPlatformAuthenticatorAvailable', () => ({ isUserVerifyingPlatformAuthenticatorAvailable() { return P.resolve(false); } }).isUserVerifyingPlatformAuthenticatorAvailable);
          setFn(PKC, 'getClientCapabilities', orig => ({ getClientCapabilities() {
            return orig.apply(this, arguments).then(c => { const o = Object.assign({}, c, { conditionalGet: false }); if (MODE === 'off') { o.passkeyPlatformAuthenticator = false; o.userVerifyingPlatformAuthenticator = false; o.hybridTransport = false; } return o; });
          } }).getClientCapabilities);
        }
      }
      // frames and windows made by this page get the same, the moment the page can reach them
      const kids = () => { try { for (let i = 0; i < w.length; i++) install(w[i]); } catch (e) {} };
      const viaWin = g => ({ f() { const r = g.apply(this == null ? w : this, arguments); try { install(r); } catch (e) {} return r; } }).f;
      const viaDoc = g => ({ f() { const r = g.apply(this, arguments); try { if (r) install(r.defaultView); } catch (e) {} return r; } }).f;
      for (const C of [w.HTMLIFrameElement, w.HTMLFrameElement, w.HTMLObjectElement, w.HTMLEmbedElement]) if (C) { setGet(C.prototype, 'contentWindow', viaWin); setGet(C.prototype, 'contentDocument', viaDoc); if (C.prototype.getSVGDocument) setFn(C.prototype, 'getSVGDocument', viaDoc); }
      setFn(w, 'open', viaWin);
      // window[0] / frames[0]: there is no hook for those, so after anything is added to the page the new frames are covered
      let n = w.length;
      const after = f => ({ f() { const r = f.apply(this, arguments); if (w.length !== n) { n = w.length; kids(); } return r; } }).f;
      const NP = w.Node.prototype, EP = w.Element.prototype, DP = w.Document.prototype;
      for (const k of ['appendChild', 'insertBefore', 'replaceChild']) setFn(NP, k, after);
      for (const k of ['append', 'prepend', 'after', 'before', 'replaceWith', 'replaceChildren', 'insertAdjacentElement', 'insertAdjacentHTML']) setFn(EP, k, after);
      for (const k of ['write', 'writeln']) setFn(DP, k, after);
      for (const k of ['innerHTML', 'outerHTML']) {
        const d = Object.getOwnPropertyDescriptor(EP, k);
        if (d && d.set) { const set0 = d.set; const ns = Object.getOwnPropertyDescriptor({ set [k](v) { set0.call(this, v); if (w.length !== n) { n = w.length; kids(); } } }, k).set; same(ns, set0); try { Object.defineProperty(EP, k, Object.assign({}, d, { set: ns })); } catch (e) {} }
      }
      kids();
    } catch (e) {}
  };
  install(window);
})();`;

const internal = !SUB && location.protocol === 'file:' && /\/newtab\/(newtab|history|tasks|passwords|settings|downloads|media)\.html$/i.test(decodeURIComponent(location.pathname));
// the reader view shows text taken from a website: it only gets its own article, nothing else of the browser
const readerPage = !SUB && location.protocol === 'file:' && /\/newtab\/reader\.html$/i.test(decodeURIComponent(location.pathname));

/* pop-up blocking (main.js, popupCheck): the link a click or Enter was on, if any. A new tab the page opens to
   another site is let through when it is that link (or the form being sent); one a script opens on a click
   anywhere else is a pop-under ad. Only real input counts (isTrusted). */
if (/^https?:$/.test(location.protocol)) {
  const tell = e => {
    if (!e.isTrusted) return;
    let href = '';
    try {
      for (const n of e.composedPath()) {
        if (!n || !n.tagName) continue;
        if ((n.tagName === 'A' || n.tagName === 'AREA') && typeof n.href === 'string' && n.href) { href = n.href; break; }
        if ((n.tagName === 'BUTTON' || n.tagName === 'INPUT') && n.form) { href = n.formAction || n.form.action || ''; break; }
      }
    } catch (x) {}
    ipcRenderer.send('pop:gesture', String(href).slice(0, 2048));
  };
  addEventListener('pointerdown', tell, true);
  addEventListener('keydown', e => { if (e.key === 'Enter') tell(e); }, true);
}

if (SUB) {
  // a sign-in box embedded from another site must not open Windows' passkey window by itself either
  if (/^https?:$/.test(location.protocol)) {
    const arg = (Array.isArray(process.argv) ? process.argv : []).find(x => x.startsWith('--3zt-pk='));
    const mode = arg ? arg.slice(9) : 'off';
    let ua = '';
    if (/^accounts\.(google|youtube)\.com$/i.test(location.hostname)) try { ua = ipcRenderer.sendSync('signin:ua'); } catch (e) {}
    if (mode !== 'nofix' || ua) inMainWorld(pkCode(mode, ua));
  }
} else if (readerPage) {
  contextBridge.exposeInMainWorld('zeus', { readerGet: k => ipcRenderer.invoke('reader:get', String(k || '').slice(0, 64)) });
} else if (internal) {
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
    onDl: fn => ipcRenderer.on('dl:changed', () => fn()),
    dlDrag: id => ipcRenderer.send('dl:drag', id),
    // built-in media downloader (downloads page)
    mediaTake: () => ipcRenderer.invoke('media:take'),
    mediaInfo: url => ipcRenderer.invoke('media:info', url),
    mediaWindow: () => ipcRenderer.send('media:window'),
    mediaList: () => ipcRenderer.invoke('media:list'),
    mediaStart: o => ipcRenderer.invoke('media:start', o),
    mediaCancel: id => ipcRenderer.invoke('media:cancel', id),
    mediaSave: (id, idx) => ipcRenderer.invoke('media:save', id, idx),
    mediaTrim: (id, o) => ipcRenderer.invoke('media:trim', id, o),
    mediaTrimFile: (id, o) => ipcRenderer.invoke('media:trimFile', id, o),
    mediaTrimCancel: id => ipcRenderer.invoke('media:trimCancel', id),
    mediaUpdate: () => ipcRenderer.invoke('media:update'),
    mediaShow: f => ipcRenderer.invoke('media:show', f),
    mediaFolder: choose => ipcRenderer.invoke('media:folder', !!choose),
    onMedia: fn => ipcRenderer.on('media:changed', () => fn()),
    onMediaUrl: fn => ipcRenderer.on('media:url', (e, u) => fn(u)),
    onTrimPct: fn => ipcRenderer.on('media:trimPct', (e, id, pc) => fn(id, pc))
  });
} else if (/^https?:$/.test(location.protocol)) {
  /* ================= names pages give their downloads (<a download="…">) =================
     Electron replaces any name that is not plain English with "download"; the name is passed along here. */
  (() => {
    // sent synchronously: the browser must know the name before the download it starts arrives
    const tell = (href, name) => { if (href && name && /[^\x20-\x7e]/.test(name)) { try { ipcRenderer.sendSync('dl:name', { href: String(href), name: String(name) }); } catch (e) {} } };
    addEventListener('click', e => { const a = e.target && e.target.closest && e.target.closest('a[download]'); if (a) tell(a.href, a.getAttribute('download')); }, true);
    // anchors made in script and clicked without being added to the page
    document.addEventListener('__3zt_dl', e => { try { const d = JSON.parse(e.detail); tell(d.href, d.name); } catch (x) {} });
    const code = `(() => {
      const orig = HTMLAnchorElement.prototype.click;
      Object.defineProperty(HTMLAnchorElement.prototype, 'click', { configurable: true, writable: true, value: function click() {
        try { if (this.hasAttribute('download')) document.dispatchEvent(new CustomEvent('__3zt_dl', { detail: JSON.stringify({ href: this.href, name: this.getAttribute('download') }) })); } catch (e) {}
        return orig.apply(this, arguments);
      } });
    })();`;
    try { if (contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: new Function(code) }); else webFrame.executeJavaScript(code); } catch (e) { try { webFrame.executeJavaScript(code); } catch (x) {} }
  })();

  /* ================= a real video on this page? (shows the download button in the address bar) ================= */
  (() => {
    let told = false;
    const look = v => {
      if (told || !v || v.tagName !== 'VIDEO') return;
      const d = v.duration, r = v.getBoundingClientRect();
      if ((d >= 5 || d === Infinity) && r.width >= 200 && r.height >= 110) { told = true; ipcRenderer.send('media:seen'); }
    };
    // media events don't bubble, but a capturing listener on the window sees them
    for (const ev of ['loadedmetadata', 'play', 'durationchange']) addEventListener(ev, e => look(e.target), { capture: true, passive: true });
    addEventListener('load', () => setTimeout(() => { for (const v of document.querySelectorAll('video')) look(v); }, 1500), { once: true });
  })();

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

  /* --- TikTok / Instagram: the highest quality the site sends, and no sponsored posts ---
     Both sites send every quality of a video with its details and let their player pick one, usually a low one
     for a browser window. Here the details are changed before the player reads them, so only the highest quality
     this computer can play is left: TikTok's list of streams (bitrateInfo, playAddr), Instagram's DASH list
     (video_dash_manifest) and plain file list (video_versions). With the ad blocker on, the sponsored posts the
     sites mix into their feeds are taken out of the same data (TikTok: isAd; Instagram: ad_id, injected, ad), so
     they never show and nothing is left blank. Nothing else is touched, and only on these two sites.
     JSON.parse and Response.json are wrapped with a Proxy: to the page they are still the built-in functions. */
  if (cfg.social && (cfg.social.site === 'tiktok' || cfg.social.site === 'instagram')) mainWorld(`(() => {
    const SITE = ${JSON.stringify(cfg.social.site)}, HQ = ${!!cfg.social.hq}, ADS = ${!!cfg.social.ads};
    const can = (mime, codecs) => { try { return window.MediaSource ? MediaSource.isTypeSupported(mime + '; codecs="' + codecs + '"') : true; } catch (e) { return true; } };
    let hevc = null;
    const hevcOk = () => (hevc === null ? (hevc = can('video/mp4', 'hvc1.1.6.L120.90') || can('video/mp4', 'hev1.1.6.L120.90')) : hevc);
    /* TikTok: { video: { playAddr, PlayAddrStruct, bitrateInfo: [{ Bitrate, CodecType, PlayAddr: { UrlList, Width, Height } }] } } */
    const side = b => { const p = b.PlayAddr || {}; return Math.min(+p.Width || 0, +p.Height || 0) || +p.Height || 0; };
    const tiktok = v => {
      const list = v.bitrateInfo.filter(b => b && b.PlayAddr && Array.isArray(b.PlayAddr.UrlList) && b.PlayAddr.UrlList.length
        && (!/265|hevc|bytevc1/i.test(String(b.CodecType || '')) || hevcOk()));
      if (!list.length) return;
      list.sort((a, b) => side(b) - side(a) || (+b.Bitrate || 0) - (+a.Bitrate || 0));
      const top = side(list[0]);
      if (!(top > 0)) return;
      const best = list[0];
      v.bitrateInfo = list.filter(b => side(b) === top);   // the same size only (other codecs of it stay as a fallback)
      v.playAddr = best.PlayAddr.UrlList[0];
      if (v.PlayAddrStruct && typeof v.PlayAddrStruct === 'object') v.PlayAddrStruct = best.PlayAddr;
      if (best.PlayAddr.Width && best.PlayAddr.Height) { v.width = best.PlayAddr.Width; v.height = best.PlayAddr.Height; }
      if (best.Bitrate) v.bitrate = best.Bitrate;
      if (typeof v.definition === 'string' && best.GearName) { const m = /(\\d{3,4})/.exec(best.GearName); if (m) v.definition = m[1] + 'p'; }
    };
    /* Instagram: the DASH list keeps one video stream, the largest this computer can play */
    const mpd = text => {
      try {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return text;
        let changed = false;
        for (const as of [...doc.getElementsByTagName('AdaptationSet')]) {
          const reps = [...as.getElementsByTagName('Representation')];
          const type = (as.getAttribute('contentType') || '') + ' ' + (as.getAttribute('mimeType') || '') + ' ' + reps.map(r => r.getAttribute('mimeType') || '').join(' ');
          if (reps.length < 2 || !/video/i.test(type)) continue;
          const ok = reps.filter(r => { const c = r.getAttribute('codecs') || as.getAttribute('codecs'); return !c || can(r.getAttribute('mimeType') || as.getAttribute('mimeType') || 'video/mp4', c); });
          const area = r => (+r.getAttribute('width') || +as.getAttribute('width') || 0) * (+r.getAttribute('height') || +as.getAttribute('height') || 0);
          ok.sort((a, b) => area(b) - area(a) || (+b.getAttribute('bandwidth') || 0) - (+a.getAttribute('bandwidth') || 0));
          if (!ok[0]) continue;
          for (const r of reps) if (r !== ok[0]) { r.remove(); changed = true; }
        }
        return changed ? new XMLSerializer().serializeToString(doc) : text;
      } catch (e) { return text; }
    };
    const insta = o => {
      if (typeof o.video_dash_manifest === 'string' && o.video_dash_manifest.indexOf('<MPD') >= 0) o.video_dash_manifest = mpd(o.video_dash_manifest);
      if (Array.isArray(o.video_versions) && o.video_versions.length > 1)
        o.video_versions = o.video_versions.slice().sort((a, b) => ((b && b.width) || 0) * ((b && b.height) || 0) - ((a && a.width) || 0) * ((a && a.height) || 0));
    };
    /* a sponsored post (checked on the post and on what wraps it in a list) */
    const adObj = o => !!o && typeof o === 'object' && (SITE === 'tiktok'
      ? o.isAd === true || o.is_ad === true || (o.adAuthorization === true && !!o.adLabelVersion)
      : !!o.ad_id || o.is_ad === true || (!!o.injected && typeof o.injected === 'object') || (!!o.ad && typeof o.ad === 'object' && !Array.isArray(o.ad) && Object.keys(o.ad).length > 0));
    const isAd = e => adObj(e) || (!!e && typeof e === 'object' && (adObj(e.item) || adObj(e.itemStruct) || adObj(e.node) || adObj(e.media) || (e.node && adObj(e.node.media))));
    const walk = (o, depth) => {
      if (!o || typeof o !== 'object' || depth > 40) return;
      if (Array.isArray(o)) {
        if (ADS) for (let i = o.length - 1; i >= 0; i--) if (isAd(o[i])) o.splice(i, 1);
        for (let i = 0; i < o.length; i++) walk(o[i], depth + 1);
        return;
      }
      if (HQ) {
        if (SITE === 'tiktok') { if (o.video && typeof o.video === 'object' && Array.isArray(o.video.bitrateInfo)) try { tiktok(o.video); } catch (e) {} }
        else if ('video_dash_manifest' in o || 'video_versions' in o) try { insta(o); } catch (e) {}
      }
      for (const k in o) { const x = o[k]; if (x && typeof x === 'object') walk(x, depth + 1); }
    };
    const KEYS = SITE === 'tiktok' ? ['bitrateInfo', 'isAd'] : ['video_', 'ad_id', '"injected"', '"ad"'];
    const fix = o => { try { walk(o, 0); } catch (e) {} return o; };
    JSON.parse = new Proxy(JSON.parse, { apply(f, self, args) {
      const r = Reflect.apply(f, self, args);
      const s = args[0];
      return typeof s === 'string' && s.length > 64 && KEYS.some(k => s.indexOf(k) >= 0) ? fix(r) : r;
    } });
    Response.prototype.json = new Proxy(Response.prototype.json, { apply(f, self, args) { return Reflect.apply(f, self, args).then(fix); } });
  })();`);

  /* --- sign-in pages and the "Windows Security" window ---
     Many sign-in pages (Google, Microsoft, GitHub...) ask for a passkey in the background as soon as they open
     (navigator.credentials.get with mediation "conditional"), so Chrome can offer saved passkeys in the
     username box. Electron has no such list: it hands that background request straight to Windows, which opens
     its "Windows Security" window (Windows Hello / security key / phone) before you did anything.
     Here sites are told "no passkey autofill" (like a browser without that list) and background requests just
     wait, the way Chrome waits when you don't pick a passkey. Some sites (Google's sign-in) instead ask at once in
     the normal way, or with the newer "immediate" mode: those are answered "no passkey" unless you clicked
     something or the site names your account. A passkey you ask for yourself ("Sign in with a passkey",
     "Use a security key") still opens Windows' window as it should.
     Passkeys are off unless you turn them on in Settings; Google's sign-in also gets the Firefox look here.
     All of it reaches blank frames and windows the page makes (see pkCode). */
  {
    let ua = '';
    if (/^accounts\.(google|youtube)\.com$/i.test(location.hostname)) try { ua = ipcRenderer.sendSync('signin:ua'); } catch (e) {}
    if (cfg.pk !== 'nofix' || ua) inMainWorld(pkCode(cfg.pk || 'off', ua));
  }

  /* ================= reader view: does this page look like an article? (after it has loaded, when the page is idle) =================
     Mozilla's isProbablyReaderable: a few element counts, no copy of the page. The article itself is only taken out
     when you press the button (reader:extract). */
  if (cfg.reader) {
    const probe = async () => {
      try {
        const code = await ipcRenderer.invoke('reader:code', 'probe'); if (!code) return;
        const m = { exports: {} }; new Function('module', code)(m);
        const yes = typeof m.exports === 'function' && m.exports(document, { minContentLength: 140, minScore: 20 });
        ipcRenderer.send('reader:able', !!yes);
      } catch (e) {}
    };
    const later = () => (window.requestIdleCallback ? requestIdleCallback(probe, { timeout: 3000 }) : setTimeout(probe, 800));
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });
    ipcRenderer.on('reader:extract', async (e, nonce) => {
      let out = null;
      try {
        const code = await ipcRenderer.invoke('reader:code', 'full');
        const m = { exports: {} }; new Function('module', code)(m);
        const doc = document.cloneNode(true);
        // pictures that load only when scrolled to: their real address
        for (const img of doc.querySelectorAll('img')) {
          const real = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('data-url');
          if (real && (!img.getAttribute('src') || /^data:|blank|placeholder|spacer/i.test(img.getAttribute('src')))) img.setAttribute('src', real);
          const ss = img.getAttribute('data-srcset'); if (ss && !img.getAttribute('srcset')) img.setAttribute('srcset', ss);
        }
        const a = new m.exports(doc, { charThreshold: 300, keepClasses: false }).parse();
        if (a && a.content) out = { title: a.title, byline: a.byline, siteName: a.siteName, lang: a.lang || document.documentElement.lang || '', dir: a.dir || document.documentElement.dir || '', publishedTime: a.publishedTime, content: a.content };
      } catch (x) {}
      ipcRenderer.send('reader:article', nonce, out);
    });
  }

  /* ================= cookie popups: answered "reject" by DuckDuckGo's Autoconsent (see main.js, AC) =================
     Runs here, beside the page (not in it); the few checks that must read the page's own variables (a CMP's API)
     are its small built-in functions, run in the page. Starts after the first paint: the page never waits for it. */
  if (cfg.cookies) {
    const go = async () => {
      let r = null; try { r = await ipcRenderer.invoke('ac:get'); } catch (e) {}
      if (!r || !r.code) return;
      try {
        const m = { exports: {} }; new Function('module', 'exports', r.code)(m, m.exports);
        const AutoConsent = m.exports.default, snippets = m.exports.evalSnippets || {};
        if (typeof AutoConsent !== 'function') return;
        let ac = null;
        const send = async msg => {
          if (!msg || !ac) return;
          if (msg.type === 'eval') {
            let result = false;
            const f = snippets[msg.snippetId];
            if (typeof f === 'function') try { result = !!(await webFrame.executeJavaScript('(' + f.toString() + ')()')); } catch (e) {}
            ac.receiveMessageCallback({ type: 'evalResp', id: msg.id, result });
          } else if (msg.type === 'autoconsentDone' || (msg.type === 'optOutResult' && msg.result)) ipcRenderer.send('ac:done', msg.cmp);
        };
        ac = new AutoConsent(send, { enabled: true, autoAction: 'optOut', enablePrehide: false, enableCosmeticRules: true, enableGeneratedRules: true, detectRetries: 20, isMainWorld: false, logs: { lifecycle: false, rulesteps: false, detectionsteps: false, evals: false, errors: false, messages: false, waits: false } },
          { autoconsent: [], compact: r.rules });
      } catch (e) {}
    };
    /* Most pages have no consent popup: the library is only loaded when the page shows signs of one (a consent
       manager's elements or frame). Checked when the page is ready, when it has loaded, and once more a little later
       (popups are often added late). */
    const SIGNS = '[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[id*="gdpr" i],[class*="gdpr" i],[id*="cmp" i],[class*="cmp-" i],'
      + '[id^="onetrust"],[id*="didomi"],[id*="usercentrics"],[id^="sp_message"],[id*="truste"],[class*="truste"],[id^="qc-cmp"],[id*="cybot" i],[class*="privacy-banner" i],'
      + 'iframe[src*="consent"],iframe[src*="privacy-mgmt"],iframe[src*="cmp"]';
    let started = false;
    const look = () => { if (started || !document.documentElement) return; try { if (document.querySelector(SIGNS)) { started = true; go(); } } catch (e) {} };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', look, { once: true }); else look();
    window.addEventListener('load', () => { look(); setTimeout(look, 2500); }, { once: true });
  }

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

    /* --- Return YouTube Dislike: the count next to the dislike button --- */
    if (yt.dislikes) {
      let rydFor = '', rydVal = null;
      const fmtN = n => { try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n); } catch (e) { return String(n); } };
      const paint = () => {
        const b = document.querySelector('ytd-watch-metadata dislike-button-view-model button, ytd-watch-metadata #segmented-dislike-button button');
        if (!b) return;
        let t = b.querySelector('.zt-ryd');
        if (rydVal == null) { if (t) t.remove(); return; }
        if (!t) {
          t = document.createElement('span'); t.className = 'zt-ryd';
          t.style.cssText = 'margin-inline-start:6px;font:500 14px/1 Roboto,Arial,sans-serif;white-space:nowrap';
          b.appendChild(t);
          b.style.width = 'auto'; b.style.paddingInline = '12px 14px';
        }
        const txt = fmtN(rydVal); if (t.textContent !== txt) t.textContent = txt;
      };
      const rydRefresh = async () => {
        const id = vid(); if (id === rydFor) return paint();
        rydFor = id; rydVal = null; paint();
        if (!id || location.pathname !== '/watch') return;
        try { const r = await ipcRenderer.invoke('ryd:get', id); if (rydFor === id && r) rydVal = r.dislikes; } catch (e) {}
        paint();
      };
      document.addEventListener('yt-navigate-finish', rydRefresh);
      setInterval(rydRefresh, 1500);   // YouTube redraws the buttons: cheap check, nothing is fetched twice
    }

    /* --- the best quality from the start: YouTube's own player functions, from the page's world.
           Once per video (and once more if the player put it back); a quality you pick yourself stays. --- */
    if (yt.maxQuality) inMainWorld(`(() => {
      let doneFor = '', tries = 0;
      const vid = () => { const u = new URL(location.href); return u.pathname === '/watch' ? u.searchParams.get('v') || '' : ''; };
      const apply = () => {
        const id = vid(); if (!id || doneFor === id) return;
        const p = document.getElementById('movie_player');
        if (!p || typeof p.getAvailableQualityLevels !== 'function' || p.classList.contains('ad-showing')) return;   // not on an ad before the video
        const lv = (p.getAvailableQualityLevels() || []).filter(q => q && q !== 'auto');
        if (!lv.length) return;
        const best = lv[0];
        try { p.setPlaybackQualityRange(best, best); } catch (e) {}
        try { p.setPlaybackQuality(best); } catch (e) {}
        doneFor = id; tries = 0;
        setTimeout(() => { if (vid() === id && p.getPlaybackQuality && p.getPlaybackQuality() !== best && tries++ < 1) { try { p.setPlaybackQualityRange(best, best); } catch (e) {} } }, 3000);
      };
      document.addEventListener('yt-navigate-finish', () => setTimeout(apply, 300));
      document.addEventListener('loadeddata', e => { if (e.target && e.target.classList && e.target.classList.contains('html5-main-video')) apply(); }, true);
      document.addEventListener('playing', e => { if (e.target && e.target.classList && e.target.classList.contains('html5-main-video')) apply(); }, true);
    })();`);

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
if (!SUB && /^https?:$/.test(location.protocol)) {
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
