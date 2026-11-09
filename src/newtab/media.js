'use strict';
/* 3zT video downloader window: a link -> its picture, title and length to confirm -> download (video, MP3 or photos) */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let lang = 'ar', info = null, infoSeq = 0;   // info: what is at the link (shown to confirm)
const L = (ar, en) => (lang === 'en' ? en : ar);
/* ================= built-in media downloader ================= */
let starting = false, mode = 'video', M = { jobs: [], tools: { ready: false }, folder: '' }, msel = new Map(), mErr = '';
const isPhotoLink = u => /tiktok\.com\/.*\/photo\//i.test(u);
function setMode(m) {
  mode = m;
  for (const k of ['video', 'audio', 'images']) $('m-' + k).classList.toggle('on', k === m);
  $('mq').hidden = m !== 'video'; $('mtrimL').hidden = m !== 'video';
  mdraw();
}
['video', 'audio', 'images'].forEach(k => ($('m-' + k).onclick = () => setMode(k)));
const ERR = e => {
  e = String(e || '');
  if (e === 'bad-url') return L('الرابط غير صحيح', 'That link is not valid');
  if (e === 'busy-update') return L('خلّ التحميلات الشغالة تخلص أول، بعدها حدّث الأدوات', 'Let the running downloads finish first, then update the tools');
  if (e === 'cancelled') return L('انلغى', 'Cancelled');
  if (e === 'busy') return L('فيه 3 تحميلات شغالة، انتظر واحد يخلص', 'Three downloads are running, wait for one to finish');
  if (e === 'expired') return L('انتهت صلاحية هذا التحميل، ابدأه من جديد', 'This item expired, start it again');
  if (e === 'no-photos') return L('ما لقيت صور في هذا الرابط', 'No photos found at this link');
  if (/^tools:/.test(e)) return L('ما قدرت أجهّز أدوات التحميل (تأكد من الإنترنت): ', 'Could not set up the download tools (check the connection): ') + e.slice(6);
  if (/sign in|login|private|cookies/i.test(e)) return L('هذا المحتوى يحتاج تسجيل دخول أو هو خاص. سجّل دخولك في الموقع بالمتصفح وجرب مرة ثانية.', 'This needs you to be signed in, or it is private. Sign in to the site in the browser and try again.') + '\n' + e;
  if (/unsupported url/i.test(e)) return L('هذا الموقع أو الرابط غير مدعوم للتحميل المباشر.', 'This site or link is not supported.') + '\n' + e;
  return e;
};
function jobText(j) {
  if (j.stage === 'tools') return L('أجهّز أدوات التحميل لأول مرة…', 'Setting up the download tools (first time only)…') + (M.tools.setup ? ` ${M.tools.setup.stage} ${M.tools.setup.pct}%` : '');
  if (j.state === 'running' && j.stage === 'trimming') return L('أقص المقطع… ', 'Trimming… ') + j.pct + '%';
  if (j.state === 'running' && j.kind === 'images') return L('أجيب الصور… ', 'Getting the photos… ') + ((j.items || []).length || '');
  if (j.state === 'running') return j.stage === 'finishing' ? L('أجهّز الملف…', 'Finishing the file…') : L('جاري التحميل ', 'Downloading ') + j.pct + '%' + (/^part/.test(j.stage) ? ' · ' + L('الجزء ', 'part ') + j.stage.slice(4) : '');
  if (j.state === 'trim') return L('حمّلته. اختر الجزء اللي تبيه.', 'Downloaded. Pick the part you want to keep.');
  if (j.state === 'done' && j.kind === 'images') return L(`لقيت ${(j.items || []).length} — اختر اللي تبيه واحفظ`, `Found ${(j.items || []).length} — pick and save`);
  if (j.state === 'done') return L('تم الحفظ ✓', 'Saved ✓');
  if (j.state === 'cancelled') return L('انلغى', 'Cancelled');
  if (j.state === 'error') return ERR(j.error);
  return '';
}
function mdraw() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('wt').textContent = L('محمّل 3zT: فيديو وصوت وصور', '3zT downloader: video, audio, photos');
  $('murl').placeholder = L('الصق رابط المقطع أو المنشور (يوتيوب، تيك توك، انستقرام، إكس…)', 'Paste a video or post link (YouTube, TikTok, Instagram, X…)');
  $('mpaste').textContent = L('لصق', 'Paste');
  $('m-video').textContent = L('فيديو', 'Video'); $('m-audio').textContent = L('صوت MP3', 'Audio MP3'); $('m-images').textContent = L('صور', 'Photos');
  $('mq').options[0].textContent = L('أعلى جودة', 'Best quality');
  $('mtrimT').textContent = L('أختار جزء منه قبل الحفظ', 'Pick a part before saving');
  $('mgo').textContent = mode === 'images' ? L('عرض الصور', 'Show photos') : L('تحميل', 'Download');
  $('mwhereL').textContent = L('الحفظ في:', 'Saving to:'); $('mwhere').textContent = M.folder || '';
  $('mchg').textContent = L('تغيير', 'Change'); $('mopen').textContent = L('فتح المجلد', 'Open folder');
  $('mupd').textContent = L('تحديث أدوات التحميل (إذا وقف موقع)', 'Update download tools (if a site stops working)');
  $('mnote').className = 'mnote' + (mErr ? ' bad' : '');
  $('mnote').textContent = mErr || (info && info.loading ? L('أجيب معلومات المقطع…', 'Getting the video details…') : '');
  let h = '';
  for (const j of M.jobs.slice(0, 6)) {
    const bad = j.state === 'error';
    h += `<div class="mj" data-j="${esc(j.id)}"><div class="tx"><div class="nm">${esc(j.title || j.name || j.url)}</div><div class="src">${esc(j.url)}</div>
      <div class="st${bad ? ' bad' : j.state === 'done' ? ' ok' : ''}" style="white-space:pre-wrap">${esc(jobText(j))}</div>
      ${j.state === 'running' && j.stage !== 'tools' ? `<div class="pb${j.kind === 'images' ? ' ind' : ''}"><i style="width:${j.pct}%"></i></div>` : ''}
      ${j.stage === 'tools' && M.tools.setup ? `<div class="pb"><i style="width:${M.tools.setup.pct}%"></i></div>` : ''}
      ${j.kind === 'images' && j.state === 'done' ? gallery(j) : ''}</div>
      <div class="acts">${j.state === 'running' ? `<button data-m="cancel">${L('إلغاء', 'Cancel')}</button>` : ''}
        ${j.state === 'trim' ? `<button class="go" data-m="trim">${L('قص', 'Trim')}</button><button data-m="cancel">✕</button>` : ''}
        ${j.state === 'done' && j.file ? `<button data-m="show">${L('عرض في المجلد', 'Show in folder')}</button>` : ''}
        ${j.state === 'error' ? `<button data-m="retry">${L('إعادة المحاولة', 'Retry')}</button>` : ''}</div></div>`;
  }
  $('mjobs').innerHTML = h;
  $('mgo').disabled = starting;
}
function gallery(j) {
  const sel = msel.get(j.id) || new Set((j.items || []).filter(x => x.type === 'image').map(x => x.i));
  msel.set(j.id, sel);
  let h = '<div class="gal">';
  for (const it of j.items) {
    const u = fileUrl(it.file);
    const inner = it.type === 'image' ? `<img loading="lazy" src="${esc(u)}" alt="">` : it.type === 'video' ? `<video muted preload="metadata" src="${esc(u)}#t=0.1"></video><span class="tag">${L('فيديو', 'video')}</span>` : `<span class="tag">${esc(it.name.split('.').pop())}</span>`;
    h += `<div class="tile${sel.has(it.i) ? ' on' : ''}" data-i="${it.i}">${inner}<span class="ck">✓</span></div>`;
  }
  return h + `</div><div class="mrow" style="margin-top:10px"><button data-m="all">${L('تحديد الكل', 'Select all')}</button><button data-m="none">${L('إلغاء التحديد', 'Select none')}</button><span style="flex:1"></span><button class="go" data-m="save">${L('حفظ المحدد', 'Save selected')} (${sel.size})</button></div>`;
}
async function mload() { const d = await zeus.mediaList(); if (d) M = d; mdraw(); }
async function mstart(url, m) {
  url = (url || '').trim(); if (!url) { mErr = L('الصق الرابط أول', 'Paste a link first'); return mdraw(); }
  if (m === 'video' && isPhotoLink(url)) m = 'images';
  if (starting) return;
  mErr = ''; starting = true; $('mgo').disabled = true;
  const r = await zeus.mediaStart({ url, mode: m, q: $('mq').value, trim: $('mtrim').checked });
  starting = false;
  if (r && r.error) mErr = ERR(r.error);
  mload();
}
$('mgo').onclick = () => mstart($('murl').value, mode);
// Enter: show what is at the link first (press Download to confirm)
$('murl').addEventListener('keydown', e => { if (e.key === 'Enter') { if (info && info.url === $('murl').value.trim() && !info.loading) mstart($('murl').value, mode); else preview($('murl').value); } });
$('murl').addEventListener('change', () => preview($('murl').value));
$('murl').addEventListener('input', () => { if (isPhotoLink($('murl').value) && mode !== 'images') setMode('images'); });
$('mpaste').onclick = async () => { try { $('murl').value = (await navigator.clipboard.readText()).trim(); } catch (e) {} $('murl').focus(); preview($('murl').value); };
$('mchg').onclick = async () => { const f = await zeus.mediaFolder(true); if (f) { M.folder = f; mdraw(); } };
$('mopen').onclick = () => zeus.mediaFolder(false);
$('mupd').onclick = async () => {
  $('mupd').disabled = true; mErr = ''; $('mnote').textContent = L('أحدّث الأدوات…', 'Updating the tools…');
  const r = await zeus.mediaUpdate(); $('mupd').disabled = false;
  $('mnote').className = 'mnote'; $('mnote').textContent = r && r.error ? ERR(r.error) : r ? `yt-dlp: ${r.ytdlp}\ngallery-dl: ${r.gallerydl}` : '';
  $('mnote').style.whiteSpace = 'pre-wrap'; mload();
};
$('mjobs').addEventListener('click', async e => {
  const row = e.target.closest('.mj'); if (!row) return;
  const j = M.jobs.find(x => x.id === row.dataset.j); if (!j) return;
  const tile = e.target.closest('.tile');
  if (tile) { const s = msel.get(j.id); const i = +tile.dataset.i; s.has(i) ? s.delete(i) : s.add(i); return mdraw(); }
  const b = e.target.closest('[data-m]'); if (!b) return;
  const c = b.dataset.m;
  if (c === 'cancel') { await zeus.mediaCancel(j.id); return mload(); }
  if (c === 'show') return zeus.mediaShow(j.file);
  if (c === 'retry') return mstart(j.url, j.kind === 'images' ? 'images' : j.mode || 'video');
  if (c === 'trim') return openTrim({ file: j.temp, jobId: j.id });
  if (c === 'all') { msel.set(j.id, new Set(j.items.map(x => x.i))); return mdraw(); }
  if (c === 'none') { msel.set(j.id, new Set()); return mdraw(); }
  if (c === 'save') {
    const idx = [...(msel.get(j.id) || [])]; if (!idx.length) { mErr = L('اختر صورة وحدة على الأقل', 'Pick at least one'); return mdraw(); }
    const r = await zeus.mediaSave(j.id, idx);
    mErr = ''; $('mnote').className = 'mnote';
    if (r && r.error) { mErr = ERR(r.error); mdraw(); } else { mdraw(); $('mnote').textContent = L(`انحفظ ${r.saved} ✓`, `Saved ${r.saved} ✓`); }
  }
});
zeus.onMedia(mload);
zeus.onMediaUrl(u => { $('murl').value = u; if (isPhotoLink(u)) setMode('images'); window.scrollTo(0, 0); preview(u); });
zeus.mediaTake().then(u => { if (u) { $('murl').value = u; if (isPhotoLink(u)) setMode('images'); preview(u); } });
setMode('video'); mload();


/* ================= the link's picture, title and length, to confirm before downloading ================= */
const dur = s => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
async function preview(u) {
  u = String(u || '').trim();
  if (!/^https?:\/\//i.test(u)) { info = null; $('pv').hidden = true; return; }
  if (info && info.url === u) return;
  const my = ++infoSeq;
  info = { url: u, loading: true };
  $('pv').hidden = false; $('pv').className = 'pv loading';
  $('pth').style.backgroundImage = ''; $('pdur').textContent = ''; $('ptitle').textContent = ''; $('pby').textContent = ''; $('plink').textContent = u;
  mdraw();
  const r = await zeus.mediaInfo(u);
  if (my !== infoSeq) return;
  info = Object.assign({ url: u, loading: false }, r || {});
  $('pv').className = 'pv';
  if (!r || r.error) {
    // a post with photos only (TikTok photo post, Instagram/X image post): offer the photos
    if (isPhotoLink(u) || /no video|unsupported url|photo/i.test((r && r.error) || '')) { setMode('images'); $('ptitle').textContent = L('منشور صور: اضغط "عرض الصور" وتختار منها.', 'A photo post: press "Show photos" and pick from them.'); }
    else { $('ptitle').textContent = L('ما قدرت أجيب معلومات هذا الرابط.', 'Could not get details for this link.'); $('pby').textContent = ERR(r && r.error); }
    $('pth').style.backgroundImage = '';
    return mdraw();
  }
  if (r.thumbnail) $('pth').style.backgroundImage = `url("${String(r.thumbnail).replace(/"/g, '%22')}")`;
  $('pdur').textContent = r.duration ? dur(r.duration) : '';
  $('ptitle').textContent = r.title || u;
  $('pby').textContent = [r.uploader, r.site].filter(Boolean).join(' · ');
  $('plink').textContent = r.url || u;
  // only the qualities this video really has
  const hs = r.heights || [];
  for (const o of $('mq').options) if (o.value !== 'best') o.hidden = hs.length ? !hs.some(h => h >= +o.value * 0.9) : false;
  mdraw();
}
zeus.getLang().then(l => { lang = l || 'ar'; mdraw(); });
zeus.onLang(l => { lang = l; mdraw(); });
window.trimHooks = { done: () => mload(), err: e => ERR(e) };
