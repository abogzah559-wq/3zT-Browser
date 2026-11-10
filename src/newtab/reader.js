'use strict';
/* 3zT reader view. The article was taken out of the page by Mozilla Readability (beside the page); here it is
   rebuilt from scratch: only the elements and attributes on the lists below are copied, links and pictures only
   when they are plain web addresses. Nothing from the page can run (the page's CSP forbids it as well). */
const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const KEY = qs.get('k') || '', SRC = qs.get('u') || '';
let lang = 'ar';
const L = (ar, en) => (lang === 'en' ? en : ar);

/* ---------- what may stay ---------- */
const KEEP = new Set(['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'kbd', 'samp', 'var', 'em', 'strong', 'b', 'i', 'u', 's',
  'sub', 'sup', 'small', 'mark', 'del', 'ins', 'a', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'img', 'table', 'thead', 'tbody', 'tfoot',
  'tr', 'th', 'td', 'caption', 'time', 'abbr', 'cite', 'q', 'details', 'summary', 'span', 'div', 'section', 'article', 'header', 'footer', 'aside', 'main']);
// gone with everything inside them
const DROP = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button',
  'select', 'option', 'textarea', 'svg', 'math', 'canvas', 'video', 'audio', 'source', 'track', 'link', 'meta', 'base', 'head', 'title', 'dialog', 'slot', 'portal']);
const ATTRS = { a: ['href', 'title'], img: ['src', 'srcset', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'reversed'], time: ['datetime'], abbr: ['title'], q: ['cite'], blockquote: ['cite'] };
const ANY = ['dir', 'lang'];
const BLOCKS = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'figcaption', 'td', 'th', 'dd', 'dt', 'caption', 'summary']);

const webUrl = (u, base) => { try { const x = new URL(u, base); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };
const cleanSrcset = (v, base) => String(v || '').split(',').map(c => c.trim()).map(c => { const [u, ...d] = c.split(/\s+/); const w = webUrl(u, base); return w && d.every(x => /^\d+(\.\d+)?[wx]$/.test(x)) ? [w, ...d].join(' ') : ''; }).filter(Boolean).join(', ');

function rebuild(src, out, base) {
  for (const n of src.childNodes) {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.localName;
    if (DROP.has(tag)) continue;
    if (!KEEP.has(tag)) { rebuild(n, out, base); continue; }   // unknown element: its text stays, the element goes
    const el = document.createElement(tag);
    for (const a of [...(ATTRS[tag] || []), ...ANY]) {
      if (!n.hasAttribute(a)) continue;
      let v = n.getAttribute(a);
      if (a === 'href' || a === 'cite') { v = webUrl(v, base); if (!v) continue; }
      else if (a === 'src') { v = webUrl(v, base); if (!v) continue; }
      else if (a === 'srcset') { v = cleanSrcset(v, base); if (!v) continue; }
      else if (a === 'dir') { if (!/^(rtl|ltr|auto)$/i.test(v)) continue; }
      else if (/^(width|height|colspan|rowspan|start)$/.test(a)) { if (!/^\d{1,5}$/.test(v)) continue; }
      el.setAttribute(a, v.slice(0, 4000));
    }
    if (tag === 'a') { if (!el.hasAttribute('href')) { rebuild(n, out, base); continue; } el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    if (tag === 'img') { if (!el.hasAttribute('src') && !el.hasAttribute('srcset')) continue; el.loading = 'lazy'; el.decoding = 'async'; el.referrerPolicy = 'no-referrer'; el.addEventListener('error', () => el.remove(), { once: true }); }
    if (BLOCKS.has(tag) && !el.hasAttribute('dir')) el.dir = 'auto';   // each paragraph finds its own direction (mixed articles)
    if (tag === 'table') { const w = document.createElement('div'); w.className = 'tw'; w.appendChild(el); out.appendChild(w); rebuild(n, el, base); continue; }
    out.appendChild(el);
    rebuild(n, el, base);
  }
}
// empty leftovers (a link around a removed picture, an empty paragraph)
function tidy(root) {
  for (const el of [...root.querySelectorAll('p, span, div, a, figure, section, li')].reverse()) {
    if (!el.textContent.trim() && !el.querySelector('img, br, hr, pre, table')) el.remove();
  }
}

/* ---------- reading comfort: size and width, kept between articles ---------- */
const store = { get: k => { try { return localStorage.getItem('3zt-reader-' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('3zt-reader-' + k, v); } catch (e) {} } };
let size = +(store.get('size') || 3); if (!(size >= 1 && size <= 5)) size = 3;
let width = store.get('width') || 'm'; if (!/^[nmw]$/.test(width)) width = 'm';
function applyLook() {
  document.documentElement.dataset.size = String(size);
  document.documentElement.dataset.width = width;
  $('bSm').disabled = size <= 1; $('bLg').disabled = size >= 5;
  for (const [id, k] of [['wN', 'n'], ['wM', 'm'], ['wW', 'w']]) $(id).classList.toggle('on', width === k);
}
$('bSm').onclick = () => { if (size > 1) { size--; store.set('size', size); applyLook(); } };
$('bLg').onclick = () => { if (size < 5) { size++; store.set('size', size); applyLook(); } };
for (const [id, k] of [['wN', 'n'], ['wM', 'm'], ['wW', 'w']]) $(id).onclick = () => { width = k; store.set('width', k); applyLook(); };
$('bBack').onclick = () => { if (history.length > 1) history.back(); else if (webUrl(SRC)) location.href = webUrl(SRC); };

/* ---------- the bar: there when the mouse moves, gone while you read ---------- */
let barT = 0, lastY = 0;
const showBar = () => { $('bar').classList.remove('hide'); clearTimeout(barT); barT = setTimeout(() => { if (!$('bar').matches(':hover')) $('bar').classList.add('hide'); }, 2400); };
document.addEventListener('mousemove', showBar, { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('bBack').click(); });
window.addEventListener('scroll', () => {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  $('prog').firstElementChild.style.width = (max > 0 ? Math.min(100, y / max * 100) : 100) + '%';
  if (y > lastY + 4) $('bar').classList.add('hide'); else if (y < lastY - 30) showBar();
  lastY = y;
}, { passive: true });

/* ---------- the article ---------- */
const arabic = t => { const a = (t.match(/[؀-ۿ]/g) || []).length, l = (t.match(/[A-Za-z]/g) || []).length; return a > l; };
function fmtDate(s) { const d = new Date(s); if (!s || isNaN(d)) return ''; try { return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; } }
function texts() {
  $('bBackT').textContent = L('الصفحة الأصلية', 'Original page');
  $('bBack').title = L('رجوع للصفحة الأصلية (Esc)', 'Back to the original page (Esc)');
  $('bSm').title = L('خط أصغر', 'Smaller text'); $('bLg').title = L('خط أكبر', 'Larger text');
  $('wN').title = L('عمود ضيق', 'Narrow'); $('wM').title = L('عمود متوسط', 'Medium'); $('wW').title = L('عمود عريض', 'Wide');
}
async function main() {
  let r = null;
  try { r = await zeus.readerGet(KEY); } catch (e) {}
  if (!r || !r.article) { const u = webUrl(SRC); if (u) location.replace(u); return; }   // after a restart: back to the page itself
  lang = r.lang === 'en' ? 'en' : 'ar';
  const a = r.article, base = r.url;
  const doc = new DOMParser().parseFromString(a.content, 'text/html');   // parsed only: nothing in it runs
  const art = $('art');
  rebuild(doc.body, art, base);
  tidy(art);
  // the article's own first heading is usually the title again
  const h = art.querySelector('h1, h2'); const norm = x => String(x || '').replace(/\s+/g, ' ').trim();
  if (h && norm(h.textContent) === norm(a.title) && !h.previousElementSibling?.matches?.('p')) h.remove();
  // the first picture is often the same as the header picture, or the title repeated: kept as it is (the page's own order)
  const text = art.textContent || '';
  const rtl = a.dir ? a.dir === 'rtl' : /^(ar|fa|ur|he|ps|ku)\b/i.test(a.lang) || arabic(text.slice(0, 3000));
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = (a.lang || (rtl ? 'ar' : 'en')).slice(0, 12);
  if (!rtl) document.documentElement.dataset.ltr = '';
  document.title = a.title || r.url;
  $('tt').textContent = a.title || '';
  $('tt').dir = 'auto';
  let host = ''; try { host = new URL(base).hostname.replace(/^www\./, ''); } catch (e) {}
  $('site').textContent = a.siteName || host; $('site').href = webUrl(base);
  const words = (text.match(/\S+/g) || []).length, mins = Math.max(1, Math.round(words / (rtl ? 180 : 230)));
  const meta = [a.byline, fmtDate(a.published), L(`${mins} دقيقة قراءة`, `${mins} min read`)].filter(Boolean);
  for (const m of meta) { const s = document.createElement('span'); s.textContent = m; s.dir = 'auto'; $('meta').appendChild(s); }
  $('endT').textContent = L('من', 'From');
  $('endA').textContent = base; $('endA').href = webUrl(base);
  texts(); applyLook(); showBar();
}
main();
