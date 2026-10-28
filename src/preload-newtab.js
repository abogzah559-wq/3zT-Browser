'use strict';
/*
 * Runs in every tab (main frame).
 *  - our own pages (file://.../newtab/*.html) get the `zeus` API
 *  - websites get two built-in features, from this isolated world (the page can't touch them):
 *      * password autofill (click a login field -> pick an account) + offer to save
 *      * YouTube ad blocking (cleans the player data before YouTube's own scripts read it)
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const internal = location.protocol === 'file:' && /\/newtab\/(newtab|history|tasks|passwords)\.html$/i.test(decodeURIComponent(location.pathname));

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
    pwUnnever: s => ipcRenderer.invoke('pw:unnever', s)
  });
} else if (/^https?:$/.test(location.protocol)) {
  /* ================= Google sign-in: present Electron's real identity (Google rejects disguised ones) ================= */
  if (/^accounts\.(google|youtube)\.com$/i.test(location.hostname)) {
    let ua = '';
    try { ua = ipcRenderer.sendSync('signin:ua'); } catch (e) {}
    if (ua) {
      const code = `(() => {
        const UA = ${JSON.stringify(ua)};
        const N = Navigator.prototype;
        const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch (e) {} };
        def(N, 'userAgent', UA); def(N, 'appVersion', UA.slice(8));
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
        JSON.parse = function () { return clean(jp.apply(this, arguments)); };
        const rj = Response.prototype.json;
        Response.prototype.json = function () { return rj.apply(this, arguments).then(clean); };
        let pr;
        try { Object.defineProperty(window, 'ytInitialPlayerResponse', { configurable: true, get() { return pr; }, set(v) { pr = clean(v); } }); } catch (e) {}
        // anything that still slips through: mute, fast-forward, press "skip"
        let muted = null;
        setInterval(() => {
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
        ytd-rich-item-renderer:has(ytd-ad-slot-renderer), ytd-rich-section-renderer:has(ytd-statement-banner-renderer) { display: none !important; }`;
      try { webFrame.insertCSS(css); } catch (e) {}
    }
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
