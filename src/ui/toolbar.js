'use strict';
const $ = id => document.getElementById(id);
let S = { tabs: [], activeId: null, url: '', isNewtab: true, lang: 'ar' };
const en = () => S.lang === 'en';
const L = (ar, e) => (en() ? e : ar);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TIPS = {
  min: ['تصغير', 'Minimize'], max: ['تكبير', 'Maximize'], close: ['إغلاق', 'Close'],
  back: ['رجوع (Alt+←)', 'Back (Alt+←)'], forward: ['للأمام (Alt+→)', 'Forward (Alt+→)'], reload: ['تحديث (F5)', 'Reload (F5)'],
  star: ['حفظ في المفضلة (Ctrl+D)', 'Bookmark (Ctrl+D)'], ext: ['الإضافات', 'Extensions'], menu: ['القائمة', 'Menu'], downloads: ['التنزيلات', 'Downloads'],
  newtab: ['تبويب جديد (Ctrl+T)', 'New tab (Ctrl+T)'], translate: ['ترجمة الصفحة', 'Translate page'],
  shield: ['مانع الإعلانات', 'Ad blocker']
};
const ICO = {
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  win: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17"/></svg>',
  incog: '<svg viewBox="0 0 24 24"><path d="M3 11h18M6 11l2-6h8l2 6"/><circle cx="7.5" cy="16" r="3"/><circle cx="16.5" cy="16" r="3"/><path d="M10.5 16h3"/></svg>',
  hist: '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v4h4M12 8v4l3 2"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="6"/></svg>',
  find: '<svg viewBox="0 0 24 24"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><circle cx="11.5" cy="13.5" r="2.5"/><path d="M13.5 15.5l2 2"/></svg>',
  tr: '<svg viewBox="0 0 24 24"><path d="M3 5h9M7.5 3v2M5 5c.6 3 2.6 5.6 5.5 7M10 5c-.6 3-3 6-6.5 7.5"/><path d="M12.5 21l4-10 4 10M14 17.5h5"/></svg>',
  chip: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
  brush: '<svg viewBox="0 0 24 24"><path d="M18.5 3.5l2 2-9 9-2-2zM9.5 12.5c-2 0-3.5 1.5-3.5 3.5 0 1.2-.8 2-2 2.5 1 1 2.5 1.5 4 1.5 2.5 0 4-1.8 4-4z"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v7"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.5v5l4-2.5z"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
};

/* ---------- state from the main process ---------- */
ui.on('state', st => {
  const langChanged = st.lang !== S.lang;
  S = st;
  const d = document.documentElement;
  d.lang = S.lang; d.dir = en() ? 'ltr' : 'rtl';
  const b = document.body.classList;
  b.toggle('newtab', S.isNewtab); b.toggle('web', !S.isNewtab); b.toggle('loading', S.loading);
  b.toggle('private', S.private); b.toggle('translated', S.translated);
  b.toggle('isweb', S.isWeb);
  $('incog').hidden = !S.private; $('incog').title = L('نافذة متخفية: ما ينحفظ سجل ولا كوكيز', 'Incognito: no history or cookies are kept');
  $('back').disabled = !S.canGoBack;
  $('fwd').disabled = !S.canGoForward;
  $('star').classList.toggle('on', S.bookmarked);
  const shOff = !S.adblock || S.adSiteOff;
  $('shield').classList.toggle('off', shOff);
  $('shCount').textContent = !shOff && S.blocked ? (S.blocked > 99 ? '99+' : S.blocked) : '';
  $('act').title = S.isWeb ? (S.translated ? L('عرض الصفحة الأصلية', 'Show original') : TIPS.translate[en() ? 1 : 0]) : '';
  $('act').disabled = !S.isWeb;
  $('maxIco').innerHTML = S.maximized
    ? '<rect x="2" y="4" width="6" height="6" rx="1"/><path d="M4 4V2.6c0-.3.3-.6.6-.6h4.8c.3 0 .6.3.6.6v4.8c0 .3-.3.6-.6.6H8"/>'
    : '<rect x="2" y="2" width="8" height="8" rx="1.2"/>';
  if (document.activeElement !== $('addr') || !document.hasFocus()) $('addr').value = S.url;
  $('addr').placeholder = L('ابحث في Google أو اكتب رابط', 'Search Google or type a URL');
  $('findq').placeholder = L('ابحث في الصفحة', 'Find in page');
  if (langChanged) applyTips();
  if (!dragging) renderTabs();
  updateFull();
  renderPins();
  drawDl();
  if (!$('drop').hidden && openKind && openKind !== 'sug') renderMenu(openKind);
});
function applyTips() {
  document.querySelectorAll('[data-tip]').forEach(el => {
    const k = el.dataset.tip;
    if (k === 'max') el.title = S.maximized ? L('استعادة', 'Restore') : TIPS.max[en() ? 1 : 0];
    else if (TIPS[k]) el.title = TIPS[k][en() ? 1 : 0];
  });
}
applyTips();

/* ---------- 'blend' mode: the strip takes the colour of the site under it ---------- */
ui.on('tint', col => {
  const st = document.documentElement.style;
  if (!col) { document.body.classList.remove('tinted', 'light'); st.removeProperty('--tint'); return; }
  st.setProperty('--tint', `rgb(${col.join(',')})`);
  const lum = (0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2]) / 255;
  document.body.classList.add('tinted');
  document.body.classList.toggle('light', lum > 0.6);
});

/* ---------- compact (bar only) or full (tabs row above the bar) ---------- */
let stripH = 56, dropHinting = false;
function updateFull() {
  const full = !S.isNewtab || S.tabs.length > 1 || dropHinting || S.winCount > 1;   // more than one window: always show tabs so they can be dragged between windows
  document.body.classList.toggle('full', full);
  const h = full ? 96 : 56;
  if (h !== stripH) {
    stripH = h;
    document.documentElement.style.setProperty('--strip', h + 'px');
    ui.send('ui:height', h);
  }
}

/* ---------- tabs strip ---------- */
const list = $('tabList');
function favHtml(t) {
  if (t.loading && !t.discarded) return '<span class="spin"></span>';
  if (t.favicon === 'app') return '<img src="app.png" alt="">';
  if (t.favicon) return `<img src="${esc(t.favicon)}" alt="" data-fb="${esc((t.title || '?').trim().charAt(0).toUpperCase())}">`;
  return `<span class="glyph">${t.url ? esc((t.title || t.url).trim().charAt(0).toUpperCase()) : ''}</span>`;
}
function renderTabs() {
  const html = S.tabs.map(t => `
    <div class="tab${t.id === S.activeId ? ' on' : ''}${t.discarded ? ' zz' : ''}" data-id="${t.id}" title="${esc(t.title)}${t.url ? '\n' + esc(t.url) : ''}">
      <span class="fi">${favHtml(t)}</span>
      <span class="tt">${esc(t.title)}</span>
      ${t.audible || t.muted ? `<button class="snd" data-mute="${t.id}" title="${t.muted ? L('تشغيل الصوت', 'Unmute') : L('كتم الصوت', 'Mute')}">${t.muted ? ICO.mute : ICO.vol}</button>` : ''}
      <button class="x" data-close="${t.id}" title="${L('إغلاق (Ctrl+W)', 'Close (Ctrl+W)')}">${ICO.x}</button>
    </div>`).join('');
  if (list._html !== html) { list.innerHTML = html; list._html = html; }
  list.querySelectorAll('img[data-fb]').forEach(im => { im.onerror = () => { const s = document.createElement('span'); s.className = 'glyph'; s.textContent = im.dataset.fb; im.replaceWith(s); }; });
  sizeTabs();
  const a = list.querySelector('.tab.on'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function sizeTabs() { list.querySelectorAll('.tab').forEach(el => el.classList.toggle('narrow', el.offsetWidth < 74)); }
new ResizeObserver(sizeTabs).observe(list);
list.addEventListener('wheel', e => { list.scrollLeft += (e.deltaY || e.deltaX) * (en() ? 1 : -1); }, { passive: true });

$('newTab').onclick = () => ui.send('tab', 'new');

/* where would a tab dropped at x (window px) go? used by the main process when merging windows */
window.tabIndexAt = x => {
  const els = [...list.querySelectorAll('.tab')];
  let i = 0;
  for (const el of els) { const r = el.getBoundingClientRect(), mid = r.left + r.width / 2; if (en() ? x > mid : x < mid) i++; }
  return i;
};
ui.on('drop-hint', x => {
  const m = $('dropMark'), tabs = $('tabs');
  if (x == null) { m.hidden = true; tabs.classList.remove('dropping'); dropHinting = false; updateFull(); return; }
  tabs.classList.add('dropping'); dropHinting = true; updateFull();
  const els = [...list.querySelectorAll('.tab')], i = tabIndexAt(x), tr = tabs.getBoundingClientRect();
  let px;
  if (!els.length) px = tr.width / 2;
  else if (i < els.length) { const r = els[i].getBoundingClientRect(); px = (en() ? r.left : r.right) - tr.left; }
  else { const r = els[els.length - 1].getBoundingClientRect(); px = (en() ? r.right : r.left) - tr.left; }
  m.style.left = (px - 1.5) + 'px'; m.hidden = false;
});

/* click / middle click / right click / drag */
let dragging = null;
list.addEventListener('pointerdown', e => {
  const tabEl = e.target.closest('.tab'); if (!tabEl) return;
  if (e.target.closest('.x,.snd')) return;
  const id = +tabEl.dataset.id;
  if (e.button === 1) { e.preventDefault(); ui.send('tab', 'close', id); return; }
  if (e.button !== 0) return;
  ui.send('tab', 'activate', id);
  // cover the whole window while the tab is held, so the drag keeps going outside the strip
  ui.send('ui:expand', true);
  tabEl.setPointerCapture(e.pointerId);
  dragging = { id, el: tabEl, x0: e.clientX, y0: e.clientY, moved: false, out: false, pointerId: e.pointerId };
});
window.addEventListener('pointermove', e => {
  const d = dragging; if (!d) return;
  if (e.buttons === 0) { endDrag(); return; }   // the button was released somewhere we did not hear about
  if (d.out) return;
  if (!d.moved && Math.abs(e.clientX - d.x0) < 5 && Math.abs(e.clientY - d.y0) < 5) return;
  d.moved = true; d.el.classList.add('drag');
  // pulled out of the strip: split into its own window. A window's only tab moves the whole window at once (to join another window)
  if (e.clientY > stripH + 26 || e.clientY < -18 || S.tabs.length === 1) {
    d.out = true; d.el.classList.remove('drag');
    ui.send('tab:dragout', { id: d.id, offX: e.clientX });
    return;
  }
  // reorder inside the strip
  const r0 = list.getBoundingClientRect(); const over = document.elementFromPoint(e.clientX, r0.top + r0.height / 2);
  const t = over && over.closest && over.closest('.tab');
  if (t && t !== d.el && t.parentNode === list) {
    const r = t.getBoundingClientRect(), mid = r.left + r.width / 2;
    const before = en() ? e.clientX < mid : e.clientX > mid;
    list.insertBefore(d.el, before ? t : t.nextSibling);
    try { d.el.setPointerCapture(d.pointerId); } catch (err) {}   // moving the element drops capture
  }
});
function endDrag() {
  const d = dragging; if (!d) return;
  dragging = null;
  d.el.classList.remove('drag');
  expand(!!openKind);
  if (d.out) { ui.send('tab:dragend'); list._html = null; renderTabs(); return; }
  if (d.moved) {
    const to = [...list.querySelectorAll('.tab')].indexOf(d.el);
    ui.send('tab', 'move', { id: d.id, to });
  }
  list._html = null; renderTabs();
}
window.addEventListener('pointerup', endDrag);
/* this window is the one following the mouse (a tab pulled out): end the move as soon as the button is up */
let beingMoved = false;
ui.on('being-moved', v => { beingMoved = !!v; });
const moverUp = () => { if (!beingMoved) return; beingMoved = false; if (dragging && dragging.out) { endDrag(); return; } ui.send('tab:dragend'); };
window.addEventListener('mouseup', moverUp, true);
window.addEventListener('mousemove', e => { if (beingMoved && e.buttons === 0) moverUp(); }, true);
window.addEventListener('keydown', e => { if (beingMoved && e.key === 'Escape') moverUp(); }, true);
window.addEventListener('pointercancel', endDrag);
list.addEventListener('click', e => {
  const c = e.target.closest('[data-close]'); if (c) { ui.send('tab', 'close', +c.dataset.close); return; }
  const m = e.target.closest('[data-mute]'); if (m) { ui.send('tab', 'mute', +m.dataset.mute); }
});
list.addEventListener('auxclick', e => { const t = e.target.closest('.tab'); if (t && e.button === 1) e.preventDefault(); });
list.addEventListener('contextmenu', e => { const t = e.target.closest('.tab'); if (t) { e.preventDefault(); ui.send('tab', 'menu', +t.dataset.id); } });
$('tabs').addEventListener('dblclick', e => { if (e.target === $('tabs') || e.target === list) ui.send('tab', 'new'); });

/* ---------- pinned extensions + popups ---------- */
function renderPins() {
  const box = $('pins'), list = S.pinned || [];
  const html = list.map(x => `<button class="ib" data-pin="${esc(x.id)}" title="${esc(x.name)}">${x.icon ? `<img src="${esc(x.icon)}" alt="">` : ICO.pin}</button>`).join('');
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
}
function openExt(id, anchor) {
  const r = (anchor || $('ext')).getBoundingClientRect();
  ui.send('ext:popup', { id, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
}
$('pins').addEventListener('click', e => { const b = e.target.closest('[data-pin]'); if (b) openExt(b.dataset.pin, b); });
// any click in the toolbar (except on a pinned icon) closes an open extension popup
document.addEventListener('pointerdown', e => { if (!e.target.closest('[data-pin],[data-ext]')) ui.send('ext:popupClose'); }, true);

/* ---------- window buttons ---------- */
$('wMin').onclick = () => ui.send('win', 'min');
$('wMax').onclick = () => ui.send('win', 'max');
$('wClose').onclick = () => ui.send('win', 'close');

/* ---------- navigation ---------- */
$('back').onclick = () => ui.send('tab', 'back');
$('fwd').onclick = () => ui.send('tab', 'forward');
$('reload').onclick = () => ui.send('tab', S.loading ? 'stop' : 'reload');
$('star').onclick = () => ui.send('tab', 'bookmark');
$('act').onclick = () => { if (S.isWeb) ui.send('tab', 'translate'); };

/* ---------- menus ---------- */
let openKind = null;
function expand(on) { ui.send('ui:expand', on ? true : (toastOn ? stripH + 64 : false)); }
function openDrop(kind, anchor) {
  openKind = kind;
  if (kind === 'dl' && toastOn) { clearTimeout(toastT); hideToast(); }
  $('drop').classList.toggle('wide', kind === 'dl');
  $('drop').hidden = false; $('backdrop').hidden = false;
  expand(true);
  renderMenu(kind);
  place(anchor);
}
function place(anchor) {
  const d = $('drop'), r = anchor.getBoundingClientRect();
  if (openKind === 'sug') { const o = $('omni').getBoundingClientRect(); d.style.width = o.width + 'px'; d.style.left = o.left + 'px'; return; }
  d.style.width = '';
  const w = d.offsetWidth;
  let left = en() ? r.right - w : r.left;
  left = Math.max(8, Math.min(innerWidth - w - 8, left));
  d.style.left = left + 'px';
}
function closeDrop() {
  if ($('drop').hidden) return;
  $('drop').hidden = true; $('backdrop').hidden = true; openKind = null; sugSel = -1;
  expand(false);
}
ui.on('close-menus', closeDrop);
$('backdrop').addEventListener('mousedown', e => { e.preventDefault(); closeDrop(); if (document.activeElement === $('addr')) $('addr').blur(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openKind && openKind !== 'sug') closeDrop(); });
$('shield').onclick = () => (openKind === 'shield' ? closeDrop() : openDrop('shield', $('shield')));
$('ext').onclick = () => (openKind === 'ext' ? closeDrop() : openDrop('ext', $('ext')));
$('menuBtn').onclick = () => (openKind === 'menu' ? closeDrop() : openDrop('menu', $('menuBtn')));

async function renderMenu(kind) {
  const d = $('drop');
  if (kind === 'shield') {
    const host = (() => { try { return new URL(S.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
    d.innerHTML = `
      <div class="hd">${L('مانع الإعلانات والمتتبعات', 'Ad and tracker blocker')}</div>
      <div class="big">${S.adblock && !S.adSiteOff ? S.blocked : '—'}</div>
      <div class="note" style="padding-top:0">${L('محظورة في هذي الصفحة', 'blocked on this page')}</div>
      <div class="row"><span class="lbl">${esc(host)}</span>
        <button class="chip${S.adblock && !S.adSiteOff ? ' on' : ''}" data-a="adSite" ${S.adblock ? '' : 'disabled'}>${S.adSiteOff ? L('طافي لهذا الموقع', 'Off for this site') : L('شغّال', 'On')}</button></div>
      <div class="note">${L('لو موقع ما اشتغل صح، طفّه لهذا الموقع بس.', 'If a site breaks, turn it off for that site only.')}</div>
      <div class="sep"></div>
      <div class="row"><span class="lbl">${L('المانع لكل المواقع', 'Blocker for all sites')}</span>
        <button class="chip${S.adblock ? ' on' : ''}" data-a="adAll">${S.adblock ? L('شغّال', 'On') : L('طافي', 'Off')}</button></div>
      <div class="note">${L('المجموع من البداية:', 'Total so far:')} ${Number(S.blockedTotal || 0).toLocaleString('en')} · ${L('القواعد:', 'rules:')} ${Number(S.adRules || 0).toLocaleString('en')}</div>`;
  } else if (kind === 'dl') {
    const items = await ui.invoke('dl:session') || [];
    if (openKind !== 'dl') return;
    const size = b => { if (!b) return '0 ' + L('ك.ب', 'KB'); const u = en() ? ['B', 'KB', 'MB', 'GB'] : ['بايت', 'ك.ب', 'م.ب', 'ج.ب']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return (i ? b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i]; };
    let h = `<div class="hd">${L('التنزيلات', 'Downloads')}</div>`;
    if (!items.length) h += `<div class="note">${L('ما فيه تنزيلات من فتحت المتصفح.', 'Nothing downloaded since the browser opened.')}</div>`;
    for (const x of items) {
      const ext = ((x.name || '').split('.').pop() || '').slice(0, 4).toUpperCase();
      const ico = x.icon ? `<img class="fi" src="${esc(x.icon)}" alt="">` : `<span class="fi ph">${esc(ext)}</span>`;
      let st = '', bar = '', acts = '';
      if (x.state === 'progressing') {
        const pct = x.total ? Math.min(100, x.received / x.total * 100) : 0;
        st = x.paused ? L('متوقف مؤقتاً', 'Paused') + ' · ' + size(x.received) : (x.total ? Math.floor(pct) + '% · ' : '') + size(x.received) + (x.total ? ' ' + L('من', 'of') + ' ' + size(x.total) : '') + (x.speed ? ' · ' + size(x.speed) + L('/ث', '/s') : '');
        bar = `<span class="pb${x.paused ? ' paused' : ''}${x.total ? '' : ' ind'}"><i style="width:${pct}%"></i></span>`;
        acts = `<button class="ab" data-dla="${x.paused ? 'resume' : 'pause'}" title="${x.paused ? L('استئناف', 'Resume') : L('إيقاف مؤقت', 'Pause')}">${x.paused ? ICO.play : ICO.pause}</button><button class="ab" data-dla="cancel" title="${L('إلغاء', 'Cancel')}">${ICO.x}</button>`;
      } else if (x.state === 'completed') {
        st = x.exists ? size(x.total || x.received) : L('الملف انحذف أو انتقل', 'File moved or deleted');
        if (x.exists) acts = `<button class="ab" data-dla="show" title="${L('عرض في المجلد', 'Show in folder')}">${ICO.folder}</button>`;
      } else {
        st = x.state === 'cancelled' ? L('انلغى', 'Cancelled') : L('توقف التنزيل', 'Download stopped');
        acts = `<button class="ab" data-dla="${x.state === 'interrupted' && x.canResume && x.received ? 'resume' : 'retry'}" title="${L('إعادة المحاولة', 'Retry')}">${ICO.retry}</button>`;
      }
      const openable = x.state === 'completed' && x.exists;
      h += `<div class="mi dli${openable ? ' ok' : ''}${x.state === 'completed' && !x.exists ? ' gone' : ''}" data-dlid="${esc(x.id)}"${openable ? ` title="${L('فتح الملف', 'Open file')}"` : ''}>
        ${ico}<span class="dt"><span class="t">${esc(x.name)}</span><span class="ds${x.state === 'cancelled' || x.state === 'interrupted' ? ' bad' : ''}">${esc(st)}</span>${bar}</span>${acts}</div>`;
    }
    h += `<div class="sep"></div><button class="mi" data-a="downloads">${ICO.dl}<span class="t">${L('كل التنزيلات', 'All downloads')}</span><span class="sub">Ctrl+J</span></button>`;
    d.innerHTML = h;
  } else if (kind === 'notes') {
    const u = updateInfo || { to: '', notes: [] };
    d.innerHTML = `<div class="hd">${L('وش الجديد في', "What's new in")} 3zT ${esc(u.to)}</div>`
      + (u.notes.length ? `<ul class="notes">${u.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : `<div class="note">${L('تحسينات وإصلاحات.', 'Improvements and fixes.')}</div>`)
      + `<div class="sep"></div><button class="mi" data-a="relnotes">${ICO.globe}<span class="t">${L('صفحة النسخة في GitHub', 'Release page on GitHub')}</span></button>`;
  } else if (kind === 'ext') {
    d.innerHTML = `<div class="note">${L('جاري التحميل…', 'Loading…')}</div>`;
    const items = await ui.invoke('ext:list') || [];
    if (openKind !== 'ext') return;
    let h = `<div class="hd">${L('الإضافات', 'Extensions')}</div>`;
    if (!items.length) h += `<div class="note">${L('ما فيه إضافات للحين. افتح متجر كروم وأضف اللي تبي.', 'No extensions yet. Open the Chrome Web Store and add what you like.')}</div>`;
    for (const x of items) {
      h += `<div class="mi" data-ext="${esc(x.id)}" title="${esc(x.name)} ${esc(x.version)}">
        ${x.icon ? `<img src="${esc(x.icon)}" alt="">` : '<span class="ph"></span>'}<span class="t">${esc(x.name)}</span>
        ${x.options ? `<span class="sub" data-opt="${esc(x.options)}" title="${L('الإعدادات', 'Options')}">⚙</span>` : ''}
        <button class="pin${x.pinned ? ' on' : ''}" data-pinx="${esc(x.id)}" title="${x.pinned ? L('إلغاء التثبيت من الشريط', 'Unpin from the bar') : L('تثبيت في الشريط', 'Pin to the bar')}">${ICO.pin}</button>
        <span class="x" data-rm="${esc(x.id)}" title="${L('إزالة', 'Remove')}">${ICO.x}</span></div>`;
    }
    h += `<div class="sep"></div><button class="mi" data-a="store">${ICO.globe}<span class="t">${L('متجر كروم للإضافات', 'Chrome Web Store')}</span></button>
      <button class="mi" data-a="extImport">${ICO.down}<span class="t">${L('استيراد إضافاتي من كروم', 'Import my Chrome extensions')}</span></button>
      <button class="mi" data-a="extAdd">${ICO.plus}<span class="t">${L('إضافة مجلد إضافة…', 'Add extension folder…')}</span></button>`;
    d.innerHTML = h;
  } else if (kind === 'menu') {
    d.innerHTML = `
      <button class="mi" data-a="new">${ICO.plus}<span class="t">${L('تبويب جديد', 'New tab')}</span><span class="sub">Ctrl+T</span></button>
      <button class="mi" data-a="newWindow">${ICO.win}<span class="t">${L('نافذة جديدة', 'New window')}</span><span class="sub">Ctrl+N</span></button>
      <button class="mi" data-a="incognito">${ICO.incog}<span class="t">${L('نافذة متخفية', 'New incognito window')}</span><span class="sub">Ctrl+Shift+N</span></button>
      <div class="sep"></div>
      <button class="mi" data-a="history">${ICO.hist}<span class="t">${L('السجل', 'History')}</span><span class="sub">Ctrl+H</span></button>
      <button class="mi" data-a="downloads">${ICO.down}<span class="t">${L('التنزيلات', 'Downloads')}</span></button>
      <button class="mi" data-a="passwords">${ICO.key}<span class="t">${L('كلمات السر', 'Passwords')}</span></button>
      ${S.closedCount ? `<button class="mi" data-a="reopen">${ICO.clock}<span class="t">${L('إرجاع آخر تبويب مغلق', 'Reopen closed tab')}</span><span class="sub">Ctrl+Shift+T</span></button>` : ''}
      <div class="sep"></div>
      <button class="mi" data-a="find">${ICO.find}<span class="t">${L('بحث في الصفحة', 'Find in page')}</span><span class="sub">Ctrl+F</span></button>
      ${S.isWeb ? `<button class="mi" data-a="translate">${ICO.tr}<span class="t">${S.translated ? L('عرض الصفحة الأصلية', 'Show original') : L('ترجمة الصفحة', 'Translate page')}</span></button>` : ''}
      <button class="mi" data-a="print">${ICO.print}<span class="t">${L('طباعة…', 'Print…')}</span><span class="sub">Ctrl+P</span></button>
      <div class="row"><span class="lbl">${L('تكبير', 'Zoom')}</span>
        <button class="chip" data-z="-0.1">−</button><button class="chip" data-a="zoomReset">${S.zoom}%</button><button class="chip" data-z="0.1">+</button>
        <button class="chip" data-a="fullscreen" title="F11">${ICO.full}</button></div>
      <div class="sep"></div>
      <button class="mi" data-a="tasks">${ICO.chip}<span class="t">${L('مدير المهام', 'Task manager')}</span><span class="sub">Shift+Esc</span></button>
      <button class="mi" data-a="devtools">${ICO.code}<span class="t">${L('أدوات المطور', 'Developer tools')}</span><span class="sub">F12</span></button>
      <button class="mi" data-a="settings">${ICO.gear}<span class="t">${L('الإعدادات', 'Settings')}</span></button>`;
  }
  if (openKind && openKind !== 'sug') place($(kind === 'ext' ? 'ext' : kind === 'shield' ? 'shield' : 'menuBtn'));
}

$('drop').addEventListener('mousedown', e => { if (openKind === 'sug') e.preventDefault(); });
$('drop').addEventListener('click', async e => {
  const t = e.target;
  const dla = t.closest('[data-dla]'); if (dla) { const id = dla.closest('[data-dlid]').dataset.dlid; ui.send('dl:uiAct', id, dla.dataset.dla); if (dla.dataset.dla === 'show') closeDrop(); else setTimeout(() => openKind === 'dl' && renderMenu('dl'), 150); return; }
  const dli = t.closest('.dli.ok'); if (dli) { ui.send('dl:uiAct', dli.dataset.dlid, 'open'); closeDrop(); return; }
  const rm = t.closest('[data-rm]'); if (rm) { await ui.invoke('ext:remove', rm.dataset.rm); renderMenu('ext'); return; }
  const sg = t.closest('[data-sg]'); if (sg) { go(sg.dataset.sg); return; }
  const opt = t.closest('[data-opt]'); if (opt) { ui.send('ext:options', opt.dataset.opt); closeDrop(); return; }
  const pinx = t.closest('[data-pinx]'); if (pinx) { ui.send('ext:pin', pinx.dataset.pinx); setTimeout(() => renderMenu('ext'), 80); return; }
  const exi = t.closest('[data-ext]'); if (exi) { const id = exi.dataset.ext; closeDrop(); setTimeout(() => openExt(id, $('ext')), 30); return; }
  const z = t.closest('[data-z]'); if (z) { ui.send('tab', 'zoom', +z.dataset.z); return; }
  const ms = t.closest('[data-ms]'); if (ms) { ui.send('set', 'memorySaverMin', +ms.dataset.ms); return; }
  const lg = t.closest('[data-lang]'); if (lg) { ui.send('set', 'lang', lg.dataset.lang); return; }
  const a = t.closest('[data-a]'); if (!a) return;
  const cmd = a.dataset.a;
  const simple = { new: ['tab', 'new'], newWindow: ['tab', 'newWindow'], incognito: ['tab', 'incognito'], history: ['tab', 'history'],
    reopen: ['tab', 'reopen'], translate: ['tab', 'translate'], print: ['tab', 'print'], tasks: ['tab', 'tasks'], passwords: ['tab', 'passwords'], settings: ['tab', 'settings'], store: ['tab', 'store'],
    downloads: ['misc', 'downloads'], fullscreen: ['misc', 'fullscreen'], devtools: ['misc', 'devtools'] };
  if (simple[cmd]) { ui.send(...simple[cmd]); closeDrop(); return; }
  switch (cmd) {
    case 'zoomReset': ui.send('tab', 'zoomReset'); break;
    case 'relnotes': closeDrop(); go('https://github.com/abogzah559-wq/3zT-Browser/releases/tag/v' + (updateInfo ? updateInfo.to : '')); break;
    case 'adSite': ui.send('tab', 'adSite'); break;
    case 'adAll': ui.send('set', 'adblock', !S.adblock); break;
    case 'restore': ui.send('set', 'restoreTabs', !S.restoreTabs); break;
    case 'hw': ui.send('set', 'hwAccel', !S.hwAccel); break;
    case 'relaunch': ui.send('misc', 'relaunch'); break;
    case 'find': closeDrop(); openFind(); break;
    case 'clear': closeDrop(); ui.send('misc', 'clearData'); break;
    case 'extAdd': {
      const r = await ui.invoke('ext:add');
      if (r && r.ok) toast(L('تمت إضافة: ', 'Added: ') + r.name);
      else if (r && r.error) toast(L('ما قدرت أضيفها: ', 'Could not add it: ') + r.error);
      if (openKind === 'ext') renderMenu('ext');
      break;
    }
    case 'import': { const n = await ui.invoke('bm:import'); closeDrop(); toast(n ? L(`انضافت ${n} من مفضلة كروم`, `Imported ${n} bookmarks from Chrome`) : L('تم تحديث الأيقونات، وما فيه مفضلة جديدة', 'Icons updated, no new bookmarks')); break; }
    case 'extImport': {
      $('drop').innerHTML = `<div class="note">${L('جاري نقل الإضافات من كروم…', 'Importing extensions from Chrome…')}</div>`;
      const r = await ui.invoke('ext:importChrome');
      if (r) toast(L(`انضافت ${r.imported.length} إضافة من كروم`, `Imported ${r.imported.length} extensions from Chrome`) + (r.imported.length ? ': ' + r.imported.join('، ') : ''));
      if (openKind === 'ext') renderMenu('ext');
      break;
    }
    case 'pwImport': {
      closeDrop(); ui.send('tab', 'passwords'); break;
    }
    case 'ytAds': ui.send('set', 'ytAds', !S.ytAds); break;
    case 'makeDefault': closeDrop(); ui.send('misc', 'makeDefault'); toast(L('اختار "3zT" من الصفحة اللي فتحت لك', 'Pick "3zT" on the page that just opened')); break;
    case 'fdm': ui.send('set', 'fdm', !S.fdm); break;
    case 'importLook': { const ok = await ui.invoke('ntp:import'); closeDrop(); toast(ok ? L('تم. افتح تبويب جديد عشان تشوف الشكل', 'Done. Open a new tab to see it') : L('ما لقيت إعدادات بلاك كروم في كروم', 'Black Chrome settings not found in Chrome')); break; }
  }
});

/* ---------- address bar + suggestions (history + Google) ---------- */
const addr = $('addr');
let sugItems = [], sugSel = -1, sugSeq = 0, sugT = 0;
addr.addEventListener('focus', () => { setTimeout(() => addr.select(), 0); });
addr.addEventListener('input', () => { clearTimeout(sugT); sugT = setTimeout(updateSug, 60); });
addr.addEventListener('blur', () => { if (openKind === 'sug') closeDrop(); addr.value = S.url; });
addr.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeDrop(); addr.value = S.url; addr.blur(); ui.send('tab', 'focusPage'); return; }
  if (e.key === 'Enter') { e.preventDefault(); go(sugSel >= 0 && sugItems[sugSel] ? sugItems[sugSel].v : addr.value, e.altKey); return; }
  if (openKind === 'sug' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault(); const n = sugItems.length; if (!n) return;
    sugSel = e.key === 'ArrowDown' ? (sugSel + 1) % n : (sugSel <= 0 ? n - 1 : sugSel - 1);
    addr.value = sugItems[sugSel].v; drawSug();
  }
});
$('omni').addEventListener('submit', e => e.preventDefault());
function go(v, newTab) {
  v = (v || '').trim(); if (!v) return;
  closeDrop(); addr.blur();
  ui.send('tab', 'go', { text: v, newTab: !!newTab });
}
async function updateSug() {
  const q = addr.value.trim(), my = ++sugSeq;
  if (!q) { if (openKind === 'sug') closeDrop(); return; }
  const [hist, live] = await Promise.all([ui.invoke('history:search', q, 4), ui.invoke('suggest', q, S.lang)]);
  if (my !== sugSeq || document.activeElement !== addr) return;
  const items = [], seen = new Set();
  for (const h of hist || []) { items.push({ v: h.url, label: h.title || h.url, sub: h.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), ico: h.favicon ? `<img src="${esc(h.favicon)}" alt="">` : ICO.clock }); seen.add(h.url); }
  for (const s of live || []) { if (seen.has(s)) continue; items.push({ v: s, label: s, ico: ICO.search }); if (items.length >= 9) break; }
  sugItems = items; sugSel = -1;
  if (!items.length) { if (openKind === 'sug') closeDrop(); return; }
  if (openKind !== 'sug') { closeDrop(); openKind = 'sug'; $('drop').hidden = false; $('backdrop').hidden = false; expand(true); }
  drawSug(); place($('omni'));
}
function drawSug() {
  $('drop').innerHTML = sugItems.map((s, i) =>
    `<div class="mi${i === sugSel ? ' sel' : ''}" data-sg="${esc(s.v)}">${s.ico}<span class="t">${esc(s.label)}</span>${s.sub ? `<span class="sub">${esc(s.sub)}</span>` : ''}</div>`).join('');
}
ui.on('focus-address', () => { closeFind(); addr.focus(); addr.select(); });

/* ---------- find in page (inside the bar) ---------- */
const fq = $('findq');
function openFind() { $('omni').classList.add('finding'); fq.focus(); fq.select(); if (fq.value) ui.send('find', { text: fq.value }); }
function closeFind() { if (!$('omni').classList.contains('finding')) return; $('omni').classList.remove('finding'); $('findCount').textContent = ''; ui.send('find:stop'); }
ui.on('find-open', () => { openFind(); });
fq.addEventListener('input', () => { ui.send('find', { text: fq.value }); if (!fq.value) $('findCount').textContent = ''; });
fq.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeFind(); ui.send('tab', 'focusPage'); }
  if (e.key === 'Enter') { e.preventDefault(); ui.send('find', { text: fq.value, forward: !e.shiftKey, next: true }); }
});
$('findNext').onclick = () => ui.send('find', { text: fq.value, forward: true, next: true });
$('findPrev').onclick = () => ui.send('find', { text: fq.value, forward: false, next: true });
$('findClose').onclick = () => { closeFind(); ui.send('tab', 'focusPage'); };
ui.on('found', r => { $('findCount').textContent = fq.value ? `${r.active || 0}/${r.matches || 0}` : ''; });

/* ---------- notices (downloads etc.) ---------- */
let toastOn = false, toastT = 0;
function toast(text, btn, opts = {}) {
 
  const t = $('toast');
  const btns = Array.isArray(btn) ? btn : btn ? [btn] : [];
  t.innerHTML = (opts.sub ? `<span class="t2"><span>${esc(text)}</span><small>${esc(opts.sub)}</small></span>` : `<span>${esc(text)}</span>`)
    + btns.map((b, i) => `<button class="${b.alt ? 'alt' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('');
  t.querySelectorAll('button').forEach(b => { b.onclick = () => { const x = btns[+b.dataset.i]; hideToast(); x.fn && x.fn(); }; });
  t.classList.toggle('ok', !!opts.ok);
  t.hidden = false; toastOn = true;
  if (!openKind) ui.send('ui:expand', stripH + 80);
  clearTimeout(toastT); toastT = setTimeout(() => { hideToast(); opts.onTimeout && opts.onTimeout(); }, opts.ms || 5000);
}
ui.on('pw-offer', o => {
  const answer = choice => ui.send('pw:answer', { id: o.id, choice });
  toast(o.update ? L('تحديث كلمة السر المحفوظة؟', 'Update saved password?') : L('حفظ كلمة السر؟', 'Save password?'),
    [{ label: o.update ? L('تحديث', 'Update') : L('حفظ', 'Save'), fn: () => answer('save') },
     { label: L('لا', 'No'), alt: true, fn: () => answer('no') },
     ...(o.update ? [] : [{ label: L('أبداً لهذا الموقع', 'Never for this site'), alt: true, fn: () => answer('never') }])],
    { sub: `${o.username || L('(بدون اسم مستخدم)', '(no username)')} · ${o.host}`, ms: 20000 });
});
function hideToast() { $('toast').hidden = true; toastOn = false; if (!openKind) ui.send('ui:expand', false); }
/* after a silent update: a calm green note for 3 seconds, "Details" shows what changed */
let updateInfo = null;
ui.on('updated', u => {
  updateInfo = { to: String(u.to || ''), notes: Array.isArray(u.notes) ? u.notes.slice(0, 30) : [] };
  toast(L(`تم تحديث 3zT إلى ${updateInfo.to}`, `3zT was updated to ${updateInfo.to}`),
    [{ label: L('التفاصيل', 'Details'), alt: true, fn: () => openDrop('notes', $('menuBtn')) }], { ok: true, ms: 3000 });
});
let dlDoneUntil = 0;
function drawDl() {
  const b = $('dlBtn'), d = S.dl || { active: 0, progress: -1 };
  const show = d.active > 0 || d.session > 0 || Date.now() < dlDoneUntil;
  b.hidden = !show; if (!show) return;
  b.classList.toggle('done', !d.active);
  b.classList.toggle('ind', d.active > 0 && d.progress < 0);
  $('dlRing').style.strokeDashoffset = d.active && d.progress >= 0 ? String(100.5 * (1 - d.progress)) : '';
  b.title = d.active ? L(`جاري تنزيل ${d.active}`, `${d.active} downloading`) : L('التنزيلات', 'Downloads');
}
$('dlBtn').onclick = () => (openKind === 'dl' ? closeDrop() : openDrop('dl', $('dlBtn')));
ui.on('download', d => {
  if (openKind === 'dl') { dlDoneUntil = d.state === 'completed' ? Date.now() + 8000 : dlDoneUntil; return; }   // the list is open: it already shows it
  const page = { label: L('التنزيلات', 'Downloads'), fn: () => ui.send('misc', 'downloads') };
  if (d.state === 'completed') { dlDoneUntil = Date.now() + 8000; setTimeout(drawDl, 8100); drawDl(); toast(L('تم التنزيل: ', 'Downloaded: ') + d.name, [{ label: L('فتح المجلد', 'Show'), fn: () => ui.send('download:show', d.path) }, page]); }
  else if (d.state === 'interrupted') toast(L('توقف التنزيل: ', 'Download stopped: ') + d.name, page);
  else if (d.state === 'started') toast(L('جاري التنزيل: ', 'Downloading: ') + d.name, page);
});
