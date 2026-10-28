'use strict';
const $ = id => document.getElementById(id);
let lang = 'ar';
const L = (ar, en) => (lang === 'en' ? en : ar);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function texts() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('h').textContent = L('السجل', 'History');
  $('q').placeholder = L('ابحث في السجل', 'Search history');
  $('clear').textContent = L('مسح الكل', 'Clear all');
  $('empty').textContent = L('ما فيه شي', 'Nothing here');
}
function day(t) {
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return L('اليوم', 'Today');
  if (diff === 1) return L('أمس', 'Yesterday');
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
let seq = 0;
async function load() {
  const my = ++seq;
  const items = await zeus.searchHistory($('q').value.trim(), 1500);
  if (my !== seq) return;
  let html = '', cur = '';
  for (const it of items) {
    const d = day(it.lastVisitTime);
    if (d !== cur) { cur = d; html += `<h2>${esc(d)}</h2>`; }
    const tm = new Date(it.lastVisitTime).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
    let host = ''; try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) {}
    html += `<div class="it"><span class="tm">${esc(tm)}</span>${it.favicon ? `<img src="${esc(it.favicon)}" alt="">` : '<span class="ph"></span>'}
      <a href="${esc(it.url)}">${esc(it.title || it.url)}</a><span class="host">${esc(host)}</span>
      <button class="del" data-url="${esc(it.url)}" title="${L('حذف', 'Remove')}">✕</button></div>`;
  }
  $('list').innerHTML = html;
  $('empty').hidden = !!items.length;
}
$('q').addEventListener('input', load);
$('list').addEventListener('click', async e => {
  const b = e.target.closest('.del'); if (!b) return;
  await zeus.deleteHistory(b.dataset.url); load();
});
$('clear').onclick = async () => {
  if (!confirm(L('مسح كل السجل؟', 'Clear all history?'))) return;
  await zeus.clearHistory(); load();
};
zeus.getLang().then(l => { lang = l || 'ar'; texts(); load(); });
zeus.onLang(l => { lang = l; texts(); load(); });
