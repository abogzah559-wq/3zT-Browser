'use strict';
/* the picture-in-picture window's own layer: buttons, time bar, moving and resizing (see src/pip.js) */
const $ = id => document.getElementById(id);
let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
const L = (ar, en) => (lang === 'en' ? en : ar);
const tips = () => {
  $('back').title = L('رجّعه للتبويب (Alt+P)', 'Back to tab (Alt+P)');
  $('close').title = L('إغلاق', 'Close');
  $('prev').title = L('السابق', 'Previous');
  $('next').title = L('التالي', 'Next');
  $('play').title = L('تشغيل / إيقاف', 'Play / pause');
};
tips();
pip.onLang(l => { lang = l; tips(); });

/* ---------- the buttons show while the mouse is on the window ---------- */
let inside = false, idleT = 0, pollT = 0, polling = false, st = null;
const body = document.body;
function wake() {
  body.classList.add('on'); body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => { if (grab) return; if (!inside) sleep(); else if (!(st && st.paused)) body.classList.add('idle'); }, 2500);
  if (!polling) poll();
}
function sleep() { body.classList.remove('on', 'idle'); clearTimeout(idleT); }
const clock = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
function paint() {
  const s = st || {};
  // (SVG elements have no .hidden property: the attribute itself)
  $('icoPlay').toggleAttribute('hidden', !s.paused && !s.none); $('icoPause').toggleAttribute('hidden', !!(s.paused || s.none));
  $('prev').hidden = $('next').hidden = !s.tracks;
  const d = s.d || 0;
  $('bot').hidden = !(d > 0);
  if (d > 0) { $('time').textContent = clock(s.t) + ' / ' + clock(d); $('fill').style.width = Math.min(100, (s.t / d) * 100) + '%'; }
}
// asked only while the buttons are showing
const showing = () => body.classList.contains('on') && !body.classList.contains('idle');
async function poll() {
  polling = true; clearTimeout(pollT);
  try { st = await pip.state(); } catch (e) { st = null; }
  paint();
  if (showing()) pollT = setTimeout(poll, 500); else polling = false;
}
// (mouseenter / mouseleave come to the page's root element, not to the document)
const root = document.documentElement;
root.addEventListener('mouseenter', () => { inside = true; wake(); });
root.addEventListener('mouseleave', () => { inside = false; if (!grab) setTimeout(() => { if (!inside && !grab) sleep(); }, 250); });

const act = async (c, a) => { wake(); await pip.cmd(c, a); setTimeout(poll, 120); };
$('play').onclick = () => act('play');
$('prev').onclick = () => act('prev');
$('next').onclick = () => act('next');
$('back').onclick = () => pip.cmd('back');
$('close').onclick = () => pip.cmd('close');
$('bar').addEventListener('pointerdown', e => {
  e.stopPropagation();
  const r = $('bar').getBoundingClientRect();
  act('seek', Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
});
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); act('play'); }
});

/* ---------- moving (anywhere) and resizing (the edges) ---------- */
const GRIP = 14;
let grab = null, raf = 0;
const zone = (x, y) => {
  const W = innerWidth, H = innerHeight;
  const v = y < GRIP ? 'n' : y > H - GRIP ? 's' : '', h = x < GRIP ? 'w' : x > W - GRIP ? 'e' : '';
  return v + h;
};
const CUR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
document.addEventListener('pointermove', e => {
  if (grab) { if (!raf) raf = requestAnimationFrame(() => { raf = 0; pip.drag(); }); return; }
  inside = true; wake();
  const z = e.target.closest('button,#bar') ? '' : zone(e.clientX, e.clientY);
  body.style.cursor = z ? CUR[z] : '';
});
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('button,#bar')) return;
  grab = zone(e.clientX, e.clientY) || 'move';
  pip.grab(grab);
  try { document.documentElement.setPointerCapture(e.pointerId); } catch (x) {}
});
const drop = () => { if (!grab) return; grab = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } pip.drag(); pip.drop(); };
document.addEventListener('pointerup', e => { drop(); if (!inside) setTimeout(() => { if (!inside) sleep(); }, 250); });
document.addEventListener('pointercancel', drop);
window.addEventListener('blur', drop);

wake();
