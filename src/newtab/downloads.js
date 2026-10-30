'use strict';
/* zeus://downloads - the built-in download manager */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = 'ar', D = { items: [], folder: '', ask: true };
const L = (ar, en) => (lang === 'en' ? en : ar);
const icons = new Map();

function size(b) {
  if (!b && b !== 0) return '';
  const u = lang === 'en' ? ['B', 'KB', 'MB', 'GB'] : ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; }
  return (i ? b.toFixed(b < 10 ? 1 : 0) : b) + ' ' + u[i];
}
function left(sec) {
  if (!isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return L(`باقي ${Math.ceil(sec)} ثانية`, `${Math.ceil(sec)} s left`);
  if (sec < 3600) return L(`باقي ${Math.ceil(sec / 60)} دقيقة`, `${Math.ceil(sec / 60)} min left`);
  return L(`باقي ${(sec / 3600).toFixed(1)} ساعة`, `${(sec / 3600).toFixed(1)} h left`);
}
function dayOf(t) {
  const d = new Date(t), n = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, n)) return L('اليوم', 'Today');
  const y = new Date(n); y.setDate(n.getDate() - 1); if (same(d, y)) return L('أمس', 'Yesterday');
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar', { weekday: 'long', day: 'numeric', month: 'long' });
}
function status(r) {
  if (r.state === 'progressing') {
    const pct = r.total ? Math.floor(r.received / r.total * 100) + '% · ' : '';
    const of = r.total ? `${size(r.received)} ${L('من', 'of')} ${size(r.total)}` : size(r.received);
    if (r.paused) return [`${L('متوقف مؤقتاً', 'Paused')} · ${of}`, ''];
    return [`${pct}${of}${r.speed ? ' · ' + size(r.speed) + L('/ث', '/s') : ''}${r.total && r.speed ? ' · ' + left((r.total - r.received) / r.speed) : ''}`, ''];
  }
  if (r.state === 'completed') return [size(r.total || r.received), 'ok'];
  if (r.state === 'cancelled') return [L('انلغى', 'Cancelled'), 'bad'];
  if (r.state === 'interrupted') return [L('توقف التنزيل', 'Download stopped') + (r.received ? ` · ${size(r.received)}${r.total ? ' ' + L('من', 'of') + ' ' + size(r.total) : ''}` : ''), 'bad'];
  return ['', ''];
}
function buttons(r) {
  const b = (cmd, t, cls = '') => `<button data-c="${cmd}" class="${cls}">${t}</button>`;
  if (r.state === 'progressing') return (r.paused ? b('resume', L('استئناف', 'Resume')) : b('pause', L('إيقاف مؤقت', 'Pause'))) + b('cancel', L('إلغاء', 'Cancel'));
  if (r.state === 'completed') return b('show', L('عرض في المجلد', 'Show in folder')) + b('remove', '✕', 'x');
  if (r.state === 'interrupted') return (r.canResume !== false && r.received ? b('resume', L('استئناف', 'Resume')) : '') + b('retry', L('إعادة المحاولة', 'Retry')) + b('remove', '✕', 'x');
  return b('retry', L('إعادة المحاولة', 'Retry')) + b('remove', '✕', 'x');
}
function draw() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('h').textContent = L('التنزيلات', 'Downloads');
  $('q').placeholder = L('ابحث في التنزيلات', 'Search downloads');
  $('clear').textContent = L('مسح القائمة', 'Clear list');
  $('open').textContent = L('فتح مجلد التنزيلات', 'Open downloads folder');
  $('whereL').textContent = D.ask ? L('يبدأ من:', 'Starts in:') : L('يحفظ في:', 'Saving to:'); $('where').textContent = D.folder;
  $('ask').textContent = D.ask ? L('✓ يسألني وين أحفظ كل ملف', '✓ Asks where to save each file') : L('يحفظ مباشرة بدون سؤال', 'Saves without asking');
  const q = $('q').value.trim().toLowerCase();
  const rows = D.items.filter(r => !q || (r.name || '').toLowerCase().includes(q) || (r.url || '').toLowerCase().includes(q));
  let h = '', lastDay = '';
  for (const r of rows) {
    const day = dayOf(r.added || Date.now());
    if (day !== lastDay) { h += `<div class="day">${esc(day)}</div>`; lastDay = day; }
    const [st, cls] = status(r);
    const pct = r.total ? Math.min(100, r.received / r.total * 100) : 0;
    const ext = ((r.name || '').split('.').pop() || '').slice(0, 4).toUpperCase();
    h += `<div class="it${r.state === 'completed' && r.exists === false ? ' gone' : ''}" data-id="${esc(r.id)}">
      <div class="ic">${icons.get(r.id) ? `<img src="${icons.get(r.id)}" alt="">` : `<span class="ph">${esc(ext)}</span>`}</div>
      <div class="tx"><div class="nm">${r.state === 'completed' ? `<a data-c="open">${esc(r.name)}</a>` : esc(r.name)}</div>
        <div class="src" title="${esc(r.url)}">${esc(r.url)}</div>
        <div class="st ${cls}">${esc(st)}</div>
        ${r.state === 'progressing' ? `<div class="pb${r.paused ? ' paused' : ''}${r.total ? '' : ' ind'}"><i style="width:${pct}%"></i></div>` : ''}</div>
      <div class="acts">${buttons(r)}</div></div>`;
  }
  $('list').innerHTML = h;
  $('empty').hidden = !!rows.length;
  $('empty').innerHTML = D.items.length ? L('ما فيه نتائج', 'No matches') : L('ما فيه تنزيلات للحين.<br>أي ملف تنزّله يطلع هنا، وتقدر توقفه وتكمله بعدين.', 'No downloads yet.<br>Files you download show up here; you can pause and resume them.');
  for (const r of rows) if (r.state === 'completed' && !icons.has(r.id)) {
    icons.set(r.id, '');
    zeus.dlIcon(r.id).then(u => { if (u) { icons.set(r.id, u); const im = document.querySelector(`.it[data-id="${CSS.escape(r.id)}"] .ic`); if (im) im.innerHTML = `<img src="${u}" alt="">`; } });
  }
}
async function load() { D = await zeus.dlList() || D; draw(); }

$('list').addEventListener('click', async e => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  const id = b.closest('.it').dataset.id;
  await zeus.dlAct(id, b.dataset.c); load();
});
$('q').addEventListener('input', draw);
$('clear').onclick = async () => { await zeus.dlClear(); load(); };
$('open').onclick = () => zeus.dlFolder();
$('ask').onclick = () => { zeus.set('dlAsk', !D.ask); setTimeout(load, 150); };
zeus.onDl(load);
zeus.getLang().then(l => { lang = l || 'ar'; load(); });
zeus.onLang(l => { lang = l; draw(); });
