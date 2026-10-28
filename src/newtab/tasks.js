'use strict';
const $ = id => document.getElementById(id);
let lang = 'ar';
const L = (ar, en) => (lang === 'en' ? en : ar);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = b => (b / 1048576 >= 1024 ? (b / 1073741824).toFixed(2) + ' GB' : Math.round(b / 1048576) + ' MB');

function texts() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('h').textContent = L('مدير المهام', 'Task manager');
  $('kMem').textContent = L('الذاكرة المستخدمة', 'Memory in use');
  $('kCpu').textContent = L('المعالج', 'CPU');
  $('kProc').textContent = L('العمليات', 'Processes');
  $('kAds').textContent = L('إعلانات ومتتبعات محظورة', 'Ads and trackers blocked');
  $('thName').textContent = L('المهمة', 'Task'); $('thMem').textContent = L('الذاكرة', 'Memory'); $('thCpu').textContent = L('المعالج', 'CPU');
  $('hSleep').textContent = L('تبويبات نايمة (ما تستهلك رام)', 'Sleeping tabs (no RAM used)');
  $('tip').textContent = L('للمقارنة مع كروم: افتح نفس المواقع في كروم، واضغط Shift+Esc هناك وقارن مجموع الذاكرة. الأرقام هنا هي الذاكرة الخاصة لكل عملية مثل كروم.',
    'To compare with Chrome: open the same sites in Chrome, press Shift+Esc there and compare total memory. Numbers here are private memory per process, like Chrome.');
}
const KIND = { browser: ['المتصفح', 'Browser'], gpu: ['رسوميات', 'GPU'], tab: ['تبويب', 'Tab'], ui: ['واجهة', 'UI'], util: ['خدمة', 'Service'], other: ['خلفية', 'Background'] };
const ICON = { browser: '⌂', gpu: '▣', ui: '▭', util: '⚙', other: '◌' };

async function refresh() {
  const d = await zeus.tasks(); if (!d) return;
  $('vMem').innerHTML = esc(mb(d.total));
  $('vCpu').innerHTML = esc(d.cpu.toFixed(1)) + ' <small>%</small>';
  $('vProc').textContent = d.procs;
  $('vAds').textContent = Number(d.blockedTotal).toLocaleString('en');
  const max = Math.max(1, ...d.rows.map(r => r.mem));
  const rows = d.rows.slice().sort((a, b) => b.mem - a.mem);
  $('rows').innerHTML = rows.map(r => {
    const canSleep = r.kind === 'tab' && r.tabs && r.tabs.every(t => !t.active);
    const icon = r.favicon ? `<img src="${esc(r.favicon)}" alt="">` : `<span class="ic">${r.kind === 'tab' ? '◫' : ICON[r.kind] || '•'}</span>`;
    return `<tr class="${r.mem > 400 * 1048576 ? 'hot' : ''}">
      <td><div class="name">${icon}<span class="t" title="${esc(r.name)}">${esc(r.name)}</span><span class="kind">${esc((KIND[r.kind] || KIND.other)[lang === 'en' ? 1 : 0])}</span></div>
        <div class="bar"><i style="width:${Math.max(2, Math.round(r.mem / max * 100))}%"></i></div></td>
      <td class="num mem">${esc(mb(r.mem))}</td><td class="num">${esc(r.cpu.toFixed(1))}%</td><td class="num">${r.pid}</td>
      <td>${canSleep ? `<button data-sleep="${r.tabs.map(t => t.id).join(',')}">${L('نوّم', 'Sleep')}</button>` : ''}</td></tr>`;
  }).join('');
  $('sleep').innerHTML = d.sleeping.length
    ? d.sleeping.map(t => `<div class="zz">💤 ${esc(t.title)}</div>`).join('')
    : `<div class="zz">${L('ما فيه', 'None')}</div>`;
}
$('rows').addEventListener('click', async e => {
  const b = e.target.closest('[data-sleep]'); if (!b) return;
  for (const id of b.dataset.sleep.split(',')) await zeus.sleepTab(+id);
  refresh();
});
zeus.getLang().then(l => { lang = l || 'ar'; texts(); refresh(); });
zeus.onLang(l => { lang = l; texts(); refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 1500);
