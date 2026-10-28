'use strict';
const $ = id => document.getElementById(id);
let S = { tabs: [], activeId: null, url: '', isNewtab: true, lang: 'ar' };
const en = () => S.lang === 'en';
const L = (ar, e) => (en() ? e : ar);

const TIPS = {
  min: ['تصغير', 'Minimize'], max: ['تكبير', 'Maximize'], close: ['إغلاق', 'Close'],
  back: ['رجوع (Alt+←)', 'Back (Alt+←)'], forward: ['للأمام (Alt+→)', 'Forward (Alt+→)'], reload: ['تحديث (F5)', 'Reload (F5)'],
  star: ['حفظ في المفضلة (Ctrl+D)', 'Bookmark (Ctrl+D)'], ext: ['الإضافات', 'Extensions'], tabs: ['التبويبات', 'Tabs'], menu: ['القائمة', 'Menu']
};
const ICO = {
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/></svg>'
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- state from the main process ---------- */
ui.on('state', st => {
  const langChanged = st.lang !== S.lang;
  S = st;
  document.documentElement.lang = S.lang;
  document.documentElement.dir = en() ? 'ltr' : 'rtl';
  document.body.classList.toggle('newtab', S.isNewtab);
  document.body.classList.toggle('web', !S.isNewtab);
  document.body.classList.toggle('loading', S.loading);
  $('back').disabled = !S.canGoBack;
  $('fwd').disabled = !S.canGoForward;
  $('star').classList.toggle('on', S.bookmarked);
  $('tabCount').textContent = S.tabs.length > 99 ? ':D' : S.tabs.length;
  $('maxIco').innerHTML = S.maximized
    ? '<rect x="1.5" y="3.5" width="7" height="7" rx="1"/><path d="M3.5 3.5V2a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H8.5"/>'
    : '<rect x="1.5" y="1.5" width="9" height="9" rx="1"/>';
  if (document.activeElement !== $('addr') || !document.hasFocus()) $('addr').value = S.url;
  $('addr').placeholder = L('ابحث في Google أو اكتب رابط', 'Search Google or type a URL');
  if (langChanged) applyTips();
  if (!$('drop').hidden && openKind && openKind !== 'sug') renderMenu(openKind);
});
function applyTips() {
  document.querySelectorAll('[data-tip]').forEach(b => {
    const k = b.dataset.tip; if (k === 'max') b.title = S.maximized ? L('استعادة', 'Restore') : TIPS.max[en() ? 1 : 0];
    else if (TIPS[k]) b.title = TIPS[k][en() ? 1 : 0];
  });
}
applyTips();

/* ---------- window buttons + dragging the empty strip ---------- */
$('wMin').onclick = () => ui.send('win', 'min');
$('wMax').onclick = () => ui.send('win', 'max');
$('wClose').onclick = () => ui.send('win', 'close');
const strip = $('strip');
strip.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target !== strip) return;
  strip.setPointerCapture(e.pointerId);
  ui.send('drag:start', e.clientY);
});
const endDrag = () => ui.send('drag:end');
strip.addEventListener('pointerup', endDrag);
strip.addEventListener('lostpointercapture', endDrag);
strip.addEventListener('dblclick', e => { if (e.target === strip) ui.send('win', 'max'); });
window.addEventListener('blur', endDrag);

/* ---------- navigation buttons ---------- */
$('back').onclick = () => ui.send('tab', 'back');
$('fwd').onclick = () => ui.send('tab', 'forward');
$('reload').onclick = () => ui.send('tab', S.loading ? 'stop' : 'reload');
$('star').onclick = () => ui.send('tab', 'bookmark');
// middle click on back/forward/reload does nothing special; keep it simple

/* ---------- menus ---------- */
let openKind = null;
function expand(on) { ui.send('ui:expand', on ? true : (toastOn ? 120 : false)); }
function openDrop(kind, anchor) {
  openKind = kind;
  const d = $('drop'); d.className = ''; d.hidden = false; $('backdrop').hidden = false;
  expand(true);
  renderMenu(kind);
  place(anchor);
}
function place(anchor) {
  const d = $('drop'), r = anchor.getBoundingClientRect();
  d.style.left = d.style.right = '';
  if (openKind === 'sug') {
    const o = $('omni').getBoundingClientRect();
    d.style.width = o.width + 'px'; d.style.left = o.left + 'px'; return;
  }
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

$('tabsBtn').onclick = () => (openKind === 'tabs' ? closeDrop() : openDrop('tabs', $('tabsBtn')));
$('ext').onclick = () => (openKind === 'ext' ? closeDrop() : openDrop('ext', $('ext')));
$('menuBtn').onclick = () => (openKind === 'menu' ? closeDrop() : openDrop('menu', $('menuBtn')));

const favImg = t => t.favicon ? `<img src="${esc(t.favicon)}" alt="">` : `<span class="ph">${t.url ? ICO.globe : ''}</span>`;

async function renderMenu(kind) {
  const d = $('drop');
  if (kind === 'tabs') {
    let h = `<button class="mi" data-a="new">${ICO.plus}<span class="t">${L('تبويب جديد', 'New tab')}</span><span class="sub">Ctrl+T</span></button>`;
    if (S.closedCount) h += `<button class="mi" data-a="reopen">${ICO.clock}<span class="t">${L('إرجاع آخر تبويب مغلق', 'Reopen closed tab')}</span><span class="sub">Ctrl+Shift+T</span></button>`;
    h += '<div class="sep"></div>';
    for (const t of S.tabs) {
      h += `<div class="mi${t.id === S.activeId ? ' on' : ''}${t.discarded ? ' zz' : ''}" data-id="${t.id}" title="${esc(t.url)}">
        ${favImg(t)}<span class="t">${esc(t.title)}</span>${t.audible ? '<span class="sub">♪</span>' : ''}${t.discarded ? `<span class="sub">${L('نايم', 'asleep')}</span>` : ''}
        <span class="x" data-close="${t.id}">${ICO.x}</span></div>`;
    }
    d.innerHTML = h;
  } else if (kind === 'ext') {
    d.innerHTML = `<div class="note">${L('جاري التحميل…', 'Loading…')}</div>`;
    const list = await ui.invoke('ext:list') || [];
    if (openKind !== 'ext') return;
    let h = `<div class="hd">${L('الإضافات', 'Extensions')}</div>`;
    if (!list.length) h += `<div class="note">${L('ما فيه إضافات. أضف مجلد إضافة (فيه manifest.json).', 'No extensions yet. Add an unpacked extension folder (with manifest.json).')}</div>`;
    for (const x of list) {
      h += `<div class="mi" ${x.options ? `data-opt="${esc(x.options)}"` : ''} title="${esc(x.name)} ${esc(x.version)}">
        ${x.icon ? `<img src="${esc(x.icon)}" alt="">` : '<span class="ph"></span>'}<span class="t">${esc(x.name)}</span>
        ${x.options ? `<span class="sub">${L('إعدادات', 'options')}</span>` : ''}<span class="x" data-rm="${esc(x.id)}" title="${L('إزالة', 'Remove')}">${ICO.x}</span></div>`;
    }
    h += `<div class="sep"></div><button class="mi" data-a="extAdd">${ICO.plus}<span class="t">${L('إضافة مجلد إضافة…', 'Add extension folder…')}</span></button>
      <div class="note">${L('متجر كروم ما يشتغل هنا. نزّل الإضافة كمجلد وفكّه، وبعدين أضفه.', 'The Chrome Web Store does not work here. Get the extension as a folder, unzip it, then add it.')}</div>`;
    d.innerHTML = h;
  } else if (kind === 'menu') {
    const ms = S.memorySaverMin;
    const chips = [[0, L('إيقاف', 'Off')], [5, '5'], [15, '15'], [30, '30'], [60, '60']]
      .map(([v, l]) => `<button class="chip${ms === v ? ' on' : ''}" data-ms="${v}">${l}</button>`).join('');
    d.innerHTML = `
      <button class="mi" data-a="new">${ICO.plus}<span class="t">${L('تبويب جديد', 'New tab')}</span><span class="sub">Ctrl+T</span></button>
      <div class="sep"></div>
      <div class="row"><span class="lbl">${L('تكبير الصفحة', 'Zoom')}</span>
        <button class="chip" data-z="-0.1">−</button><button class="chip" data-a="zoomReset">${S.zoom}%</button><button class="chip" data-z="0.1">+</button></div>
      <div class="row"><span class="lbl">${L('توفير الذاكرة (دقايق)', 'Memory saver (minutes)')}</span></div>
      <div class="row">${chips}</div>
      <div class="note">${L('التبويبات اللي ما فتحتها من هالمدة تنام وتفضّي الرام، وترجع تشتغل لما تفتحها.', 'Tabs you have not opened for this long go to sleep to free RAM, and wake up when you open them.')}</div>
      <div class="row"><span class="lbl">${L('اللغة', 'Language')}</span>
        <button class="chip${!en() ? ' on' : ''}" data-lang="ar">عربي</button><button class="chip${en() ? ' on' : ''}" data-lang="en">English</button></div>
      <div class="row"><span class="lbl">${L('رجّع تبويباتي عند الفتح', 'Restore my tabs on start')}</span>
        <button class="chip${S.restoreTabs ? ' on' : ''}" data-a="restore">${S.restoreTabs ? L('شغّال', 'On') : L('طافي', 'Off')}</button></div>
      <div class="sep"></div>
      <button class="mi" data-a="import">${ICO.star}<span class="t">${L('استيراد المفضلة من كروم', 'Import bookmarks from Chrome')}</span></button>
      <button class="mi" data-a="downloads">${ICO.down}<span class="t">${L('مجلد التنزيلات', 'Downloads folder')}</span></button>
      <button class="mi" data-a="fullscreen">${ICO.full}<span class="t">${L('ملء الشاشة', 'Full screen')}</span><span class="sub">F11</span></button>
      <button class="mi" data-a="devtools">${ICO.code}<span class="t">${L('أدوات المطور', 'Developer tools')}</span><span class="sub">F12</span></button>
      <button class="mi" data-a="clear">${ICO.trash}<span class="t">${L('مسح بيانات التصفح…', 'Clear browsing data…')}</span></button>
      <div class="sep"></div>
      <div class="note">3zT Browser ${esc(S.versions && S.versions.app)} · Chromium ${esc(S.versions && S.versions.chrome)}</div>`;
  }
  if (openKind && openKind !== 'sug') place($(kind === 'tabs' ? 'tabsBtn' : kind === 'ext' ? 'ext' : 'menuBtn'));
}

$('drop').addEventListener('mousedown', e => { if (openKind === 'sug') e.preventDefault(); });
$('drop').addEventListener('auxclick', e => {
  const row = e.target.closest('[data-id]'); if (e.button === 1 && row) ui.send('tab', 'close', +row.dataset.id);
});
$('drop').addEventListener('click', async e => {
  const t = e.target;
  const close = t.closest('[data-close]'); if (close) { ui.send('tab', 'close', +close.dataset.close); return; }
  const rm = t.closest('[data-rm]'); if (rm) { await ui.invoke('ext:remove', rm.dataset.rm); renderMenu('ext'); return; }
  const sg = t.closest('[data-sg]'); if (sg) { go(sg.dataset.sg); return; }
  const row = t.closest('[data-id]'); if (row) { ui.send('tab', 'activate', +row.dataset.id); closeDrop(); return; }
  const opt = t.closest('[data-opt]'); if (opt) { ui.send('ext:options', opt.dataset.opt); closeDrop(); return; }
  const z = t.closest('[data-z]'); if (z) { ui.send('tab', 'zoom', +z.dataset.z); return; }
  const ms = t.closest('[data-ms]'); if (ms) { ui.send('set', 'memorySaverMin', +ms.dataset.ms); return; }
  const lg = t.closest('[data-lang]'); if (lg) { ui.send('set', 'lang', lg.dataset.lang); return; }
  const a = t.closest('[data-a]'); if (!a) return;
  switch (a.dataset.a) {
    case 'new': ui.send('tab', 'new'); closeDrop(); break;
    case 'reopen': ui.send('tab', 'reopen'); closeDrop(); break;
    case 'zoomReset': ui.send('tab', 'zoomReset'); break;
    case 'restore': ui.send('set', 'restoreTabs', !S.restoreTabs); break;
    case 'extAdd': {
      const r = await ui.invoke('ext:add');
      if (r && r.ok) toast(L('تمت إضافة: ', 'Added: ') + r.name);
      else if (r && r.error) toast(L('ما قدرت أضيفها: ', 'Could not add it: ') + r.error);
      if (openKind === 'ext') renderMenu('ext');
      break;
    }
    case 'import': { const n = await ui.invoke('bm:import'); toast(n ? L(`انضافت ${n} من مفضلة كروم`, `Imported ${n} bookmarks from Chrome`) : L('ما لقيت مفضلة جديدة في كروم', 'No new Chrome bookmarks found')); closeDrop(); break; }
    case 'downloads': ui.send('misc', 'downloads'); closeDrop(); break;
    case 'fullscreen': ui.send('misc', 'fullscreen'); closeDrop(); break;
    case 'devtools': ui.send('misc', 'devtools'); closeDrop(); break;
    case 'clear': closeDrop(); ui.send('misc', 'clearData'); break;
  }
});

/* ---------- address bar + suggestions (history + Google) ---------- */
const addr = $('addr');
let sugItems = [], sugSel = -1, sugSeq = 0, sugT = 0, typed = '';
addr.addEventListener('focus', () => { setTimeout(() => addr.select(), 0); });
addr.addEventListener('input', () => { typed = addr.value; clearTimeout(sugT); sugT = setTimeout(updateSug, 60); });
addr.addEventListener('blur', () => { if (openKind === 'sug') closeDrop(); addr.value = S.url; });
addr.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); closeDrop(); addr.value = S.url; addr.blur(); ui.send('tab', 'focusPage'); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = sugSel >= 0 && sugItems[sugSel] ? sugItems[sugSel].v : addr.value;
    go(v, e.altKey);
    return;
  }
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
  for (const h of hist || []) { items.push({ v: h.url, label: h.title || h.url, sub: h.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40), ico: ICO.clock }); seen.add(h.url); }
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
ui.on('focus-address', () => { addr.focus(); addr.select(); });

/* ---------- download notice ---------- */
let toastOn = false, toastT = 0;
function toast(html, btn) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(html)}</span>` + (btn ? `<button>${esc(btn.label)}</button>` : '');
  if (btn) t.querySelector('button').onclick = () => { btn.fn(); hideToast(); };
  t.hidden = false; toastOn = true;
  if (!openKind) ui.send('ui:expand', 120);
  clearTimeout(toastT); toastT = setTimeout(hideToast, 5000);
}
function hideToast() { $('toast').hidden = true; toastOn = false; if (!openKind) ui.send('ui:expand', false); }
ui.on('download', d => {
  if (d.state === 'completed') toast(L('تم التنزيل: ', 'Downloaded: ') + d.name, { label: L('عرض', 'Show'), fn: () => ui.send('download:show', d.path) });
  else if (d.state === 'interrupted' || d.state === 'cancelled') toast(L('فشل التنزيل: ', 'Download failed: ') + d.name);
  else if (d.state === 'progressing' && d.received === 0) toast(L('جاري التنزيل: ', 'Downloading: ') + d.name);
});
