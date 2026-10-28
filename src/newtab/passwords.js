'use strict';
const $ = id => document.getElementById(id);
let lang = 'ar', data = { entries: [], encrypted: true, never: [] };
const L = (ar, en) => (lang === 'en' ? en : ar);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shown = new Map();   // id -> revealed password (only while the page is open)

function texts() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('h').textContent = L('كلمات السر', 'Passwords');
  $('q').placeholder = L('ابحث عن موقع أو اسم مستخدم', 'Search site or username');
  $('imp').textContent = L('استيراد من ملف كروم (CSV)', 'Import Chrome file (CSV)');
  $('hNever').textContent = L('مواقع ما تنحفظ لها كلمات سر', 'Never saved for these sites');
}
function note() {
  const n = $('note');
  n.className = 'banner ' + (data.encrypted ? 'ok' : 'warn');
  n.innerHTML = data.encrypted
    ? L(`🔒 كلمات السر مشفّرة بحساب ويندوز حقك (نفس حماية كروم). عددها: <b>${data.entries.length}</b>. اضغط على خانة تسجيل الدخول في أي موقع وتطلع لك الحسابات.`,
        `🔒 Passwords are encrypted with your Windows account (same protection as Chrome). Saved: <b>${data.entries.length}</b>. Click a login field on any site to pick an account.`)
    : L('⚠️ نظامك ما يوفر تشفير، فكلمات السر محفوظة بدون تشفير قوي.', '⚠️ Your system offers no encryption: passwords are stored without strong encryption.');
}
async function load() {
  data = await zeus.pwList() || data;
  note(); draw();
}
function draw() {
  const q = $('q').value.trim().toLowerCase();
  const rows = data.entries.filter(e => !q || e.host.includes(q) || e.username.toLowerCase().includes(q));
  $('list').innerHTML = rows.length ? `<div class="row head"><span>${L('الموقع', 'Site')}</span><span>${L('اسم المستخدم', 'Username')}</span><span>${L('كلمة السر', 'Password')}</span><span></span></div>` +
    rows.map(e => `<div class="row" data-id="${esc(e.id)}">
      <span class="site">${e.favicon ? `<img src="${esc(e.favicon)}" alt="">` : '<span class="ph"></span>'}<a href="${esc(e.origin)}" target="_blank">${esc(e.host)}</a></span>
      <span class="user" title="${esc(e.username)}">${esc(e.username) || '—'}</span>
      <span class="pass">${shown.has(e.id) ? esc(shown.get(e.id)) : '••••••••••'}</span>
      <span class="acts">
        <button data-a="eye">${shown.has(e.id) ? L('إخفاء', 'Hide') : L('إظهار', 'Show')}</button>
        <button data-a="cu" title="${L('نسخ اسم المستخدم', 'Copy username')}">👤</button>
        <button data-a="cp" title="${L('نسخ كلمة السر', 'Copy password')}">📋</button>
        <button data-a="del" title="${L('حذف', 'Delete')}">✕</button>
      </span></div>`).join('') : '';
  $('empty').hidden = !!rows.length;
  $('empty').textContent = data.entries.length ? L('ما فيه نتائج', 'No matches')
    : L('ما فيه كلمات سر محفوظة. صدّرها من كروم: الإعدادات ← مدير كلمات المرور ← الإعدادات ← تصدير، وبعدين اضغط "استيراد".',
        'No saved passwords yet. Export them from Chrome: Settings → Password Manager → Settings → Export, then press "Import".');
  const nv = data.never || [];
  $('hNever').hidden = !nv.length;
  $('never').innerHTML = nv.map(s => `<span class="chip">${esc(s)}<button data-un="${esc(s)}" title="${L('إزالة', 'Remove')}">✕</button></span>`).join('');
}
$('q').addEventListener('input', draw);
$('list').addEventListener('click', async e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const id = b.closest('.row').dataset.id, entry = data.entries.find(x => x.id === id);
  if (b.dataset.a === 'eye') { if (shown.has(id)) shown.delete(id); else shown.set(id, await zeus.pwReveal(id)); draw(); }
  if (b.dataset.a === 'cp') { await navigator.clipboard.writeText(await zeus.pwReveal(id)); b.textContent = '✓'; setTimeout(draw, 900); }
  if (b.dataset.a === 'cu') { await navigator.clipboard.writeText(entry ? entry.username : ''); b.textContent = '✓'; setTimeout(draw, 900); }
  if (b.dataset.a === 'del') { if (confirm(L(`حذف كلمة السر لـ ${entry.host}؟`, `Delete the password for ${entry.host}?`))) { await zeus.pwDelete(id); shown.delete(id); load(); } }
});
$('never').addEventListener('click', async e => { const b = e.target.closest('[data-un]'); if (b) { await zeus.pwUnnever(b.dataset.un); load(); } });
$('imp').onclick = async () => {
  const r = await zeus.pwImport(); if (!r) return;
  const box = $('result'); box.hidden = false;
  if (r.error) { box.className = 'banner warn'; box.textContent = L('ما قدرت أقرأ الملف: ', 'Could not read the file: ') + r.error; return; }
  box.className = 'banner ok';
  box.innerHTML = L(`تم: انضافت <b>${r.added}</b>، وتحدّثت <b>${r.updated}</b>${r.skipped ? `، وتخطّيت ${r.skipped} (روابط مو مواقع)` : ''}.`,
    `Done: <b>${r.added}</b> added, <b>${r.updated}</b> updated${r.skipped ? `, ${r.skipped} skipped (not websites)` : ''}.`) +
    `<br>${L('ملف CSV غير مشفّر وفيه كل كلمات السر. الأفضل تحذفه:', 'The CSV file is not encrypted and holds every password. Better delete it:')} <button id="delf">${L('انقله لسلة المحذوفات', 'Move it to the Recycle Bin')}</button>`;
  $('delf').onclick = async () => { const ok = await zeus.pwDeleteFile(r.file); $('delf').replaceWith(document.createTextNode(ok ? L(' ✓ انحذف', ' ✓ Deleted') : L(' ما قدرت أحذفه، احذفه بنفسك', ' Could not delete it, please delete it yourself'))); };
  load();
};
zeus.getLang().then(l => { lang = l || 'ar'; texts(); load(); });
zeus.onLang(l => { lang = l; texts(); draw(); note(); });
