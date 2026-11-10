'use strict';
/* 3zT downloader window
   a link -> its picture, title, length and a light preview -> pick the part on the timeline (optional) -> download
   (video, MP3 or the photos of a post). Closing the window stops everything it started and forgets the list. */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileUrl = p => 'file:///' + String(p).replace(/\\/g, '/').split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
let lang = 'ar';
const L = (ar, en) => (lang === 'en' ? en : ar);

let info = null, infoSeq = 0;                 // what is at the link: { url, loading, title, thumbnail, duration, preview, infoId, ... }
let cut = { s: 0, e: 0 };                     // the chosen part, in seconds (e = 0 means "to the end")
let starting = false, mode = 'video', note = '', noteBad = false;
let M = { jobs: [], tools: { ready: true }, folder: '' };
const msel = new Map(), meta = new Map();      // photo picks per job; job id -> { thumb, title } from the preview
const isPhotoLink = u => /tiktok\.com\/.*\/photo\//i.test(u);
const isFeed = u => /tiktok\.com\/?([a-z]{2}(-[A-Z]{2})?)?\/?(\?.*)?$/i.test(u) || /tiktok\.com\/(foryou|following|explore)/i.test(u);

/* ---------- time ---------- */
const fmt = s => { s = Math.max(0, +s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + x.toFixed(1).padStart(4, '0'); };
const fmtShort = s => { s = Math.round(+s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const parseT = t => { const p = String(t).trim().split(':').map(Number); return p.some(isNaN) ? NaN : p.reduce((a, v) => a * 60 + v, 0); };
const dur = () => (info && info.duration > 0 && isFinite(info.duration) ? info.duration : 0);
const end = () => (cut.e > 0 ? cut.e : dur());
const isWhole = () => !dur() || (cut.s < 0.05 && Math.abs(end() - dur()) < 0.05);

/* ---------- errors in plain words (the tool's own text stays behind "Details") ---------- */
function explain(e) {
  e = String(e || '');
  if (e === 'bad-url') return L('الرابط غير صحيح.', 'That link is not valid.');
  if (e === 'busy-update') return L('خلّ التحميلات الشغالة تخلص أول، بعدها حدّث الأدوات.', 'Let the running downloads finish first, then update the tools.');
  if (e === 'cancelled') return L('انلغى.', 'Cancelled.');
  if (e === 'busy') return L('فيه 3 تحميلات شغالة، انتظر واحد يخلص.', 'Three downloads are running, wait for one to finish.');
  if (e === 'expired') return L('انتهت صلاحية هذا العنصر، ابدأه من جديد.', 'This item expired, start it again.');
  if (e === 'no-photos') return L('ما لقيت صور في هذا الرابط.', 'No photos found at this link.');
  if (/^tools:/.test(e)) return L('أدوات التحميل ما اشتغلت. جرّب «تحديث أدوات التحميل».', 'The download tools did not start. Try "Update download tools".');
  if (/sign in|log ?in|private|cookies|age/i.test(e)) return L('هذا المحتوى يحتاج تسجيل دخول أو هو خاص. سجّل دخولك في الموقع من المتصفح وجرب مرة ثانية.', 'This needs you to be signed in, or it is private. Sign in to the site in the browser and try again.');
  if (/unsupported url/i.test(e)) return L('هذا الرابط مو رابط مقطع. افتح المقطع نفسه (مو الصفحة الرئيسية) وجرب.', 'This is not a link to a video. Open the video itself (not the home page) and try again.');
  if (/unavailable|removed|not available|404/i.test(e)) return L('المقطع محذوف أو غير متاح في منطقتك.', 'The video was removed or is not available in your region.');
  if (/HTTP Error 403|429|rate/i.test(e)) return L('الموقع رفض الطلب مؤقتاً. جرب بعد شوي، أو حدّث أدوات التحميل.', 'The site refused for now. Try again shortly, or update the download tools.');
  return L('ما قدرت أحمّل هذا المقطع.', 'Could not download this.');
}
const isCode = e => /^(bad-url|busy|busy-update|cancelled|expired|no-photos)$/.test(String(e || ''));

/* ---------- drawing ---------- */
function setMode(m) {
  mode = m;
  for (const k of ['video', 'audio', 'images']) $('m-' + k).classList.toggle('on', k === m);
  $('mq').hidden = m !== 'video';
  draw();
}
['video', 'audio', 'images'].forEach(k => ($('m-' + k).onclick = () => setMode(k)));

function drawTexts() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = $('wt').textContent = L('محمّل 3zT', '3zT downloader');
  $('murl').placeholder = L('الصق رابط المقطع أو المنشور (يوتيوب، تيك توك، انستقرام، إكس…)', 'Paste a video or post link (YouTube, TikTok, Instagram, X…)');
  $('mpasteT').textContent = L('لصق', 'Paste');
  $('m-video').lastElementChild.textContent = L('فيديو', 'Video');
  $('m-audio').lastElementChild.textContent = L('صوت MP3', 'MP3');
  $('m-images').lastElementChild.textContent = L('صور', 'Photos');
  $('mq').options[0].textContent = L('أعلى جودة', 'Best quality');
  $('cutT').textContent = L('الجزء اللي تبيه', 'Part to keep');
  $('cutFull').textContent = L('المقطع كامل', 'Whole video');
  $('tsL').textContent = L('من', 'From'); $('teL').textContent = L('إلى', 'To');
  $('tsNow').textContent = $('teNow').textContent = L('الوقت الحالي', 'Current time');
  $('tsNow').title = $('teNow').title = L('من مكان التشغيل في المعاينة', 'From where the preview is playing');
  $('cmF').textContent = L('سريع وبنفس الجودة', 'Fast, same quality');
  $('cmFs').textContent = L('بدون إعادة ترميز. يبدأ من أقرب إطار مفتاحي، فممكن يبدأ قبل وقتك بثواني قليلة.', 'No re-encoding. Starts at the nearest key frame, so it may begin a few seconds early.');
  $('cmE').textContent = L('دقيق على الإطار', 'Frame-exact');
  $('cmEs').textContent = L('يعيد ترميز أطراف المقطع عشان يقص بالضبط. أبطأ شوي.', 'Re-encodes the edges to cut exactly. A little slower.');
  $('perrS').textContent = L('التفاصيل', 'Details');
  $('mwhereL').textContent = L('الحفظ في', 'Saving to'); $('mwhere').textContent = M.folder || '';
  $('mchg').textContent = L('تغيير', 'Change'); $('mopen').textContent = L('فتح المجلد', 'Open folder');
  $('mupd').textContent = L('تحديث أدوات التحميل', 'Update download tools');
  $('mupd').title = L('إذا وقف موقع عن التحميل', 'If a site stops working');
}
function goText() {
  if (mode === 'images') return L('عرض الصور', 'Show photos');
  const q = mode === 'audio' ? 'MP3' : ($('mq').value === 'best' ? L('أعلى جودة', 'best quality') : ($('mq').value === '2160' ? '4K' : $('mq').value + 'p'));
  const len = dur() ? ' · ' + (isWhole() ? fmtShort(dur()) : fmtShort(end() - cut.s) + ' ' + L('من', 'of') + ' ' + fmtShort(dur())) : '';
  return L('تحميل ', 'Download ') + q + len;
}
function drawCut() {
  const d = dur(), show = !!info && !info.loading && !info.error && d > 0 && mode !== 'images';
  $('cut').hidden = !show;
  if (!show) return;
  const e = end();
  if (document.activeElement !== $('tsi')) $('tsi').value = fmt(cut.s);
  if (document.activeElement !== $('tei')) $('tei').value = fmt(e);
  $('ts').value = Math.round(cut.s / d * 1000); $('te').value = Math.round(e / d * 1000);
  $('tr').style.insetInlineStart = (cut.s / d * 100) + '%';
  $('tr').style.width = Math.max(0, (e - cut.s) / d * 100) + '%';
  const whole = isWhole();
  $('selLen').textContent = whole ? fmtShort(d) : fmt(e - cut.s);
  $('cutFull').hidden = whole;
  $('cutModes').hidden = whole;
}
function draw() {
  drawTexts();
  drawCut();
  $('mgoT').textContent = goText();
  $('mgo').disabled = starting || (info && info.loading && mode !== 'images');
  $('mnote').className = 'note' + (noteBad ? ' bad' : '');
  $('mnote').textContent = note;
  drawJobs();
}
function jobText(j) {
  if (j.state === 'running' && j.kind === 'images') return L('أجيب الصور… ', 'Getting the photos… ') + ((j.items || []).length || '');
  if (j.state === 'running' && (j.stage === 'tools' || j.stage === 'preparing')) return L('جاري التجهيز…', 'Getting ready…');
  if ((j.state === 'running' && j.stage === 'trimming') || j.state === 'trim') return L('أقص الجزء اللي اخترته… ', 'Cutting your part… ') + (j.pct ? j.pct + '%' : '');
  if (j.state === 'running' && j.stage === 'finishing') return L('أجهّز الملف…', 'Finishing the file…');
  if (j.state === 'running') return L('جاري التحميل ', 'Downloading ') + j.pct + '%';
  if (j.state === 'done' && j.kind === 'images') return L(`لقيت ${(j.items || []).length}، اختر اللي تبيه واحفظ`, `Found ${(j.items || []).length}, pick and save`);
  if (j.state === 'done') return L('انحفظ ✓', 'Saved ✓');
  if (j.state === 'cancelled') return L('انلغى', 'Cancelled');
  if (j.state === 'error') return explain(j.error);
  return '';
}
const ICON = {
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>'
};
function drawJobs() {
  let h = M.jobs.length ? `<h3>${L('التحميلات', 'Downloads')}</h3>` : '';
  for (const j of M.jobs.slice(0, 8)) {
    const m = meta.get(j.id) || {};
    const bad = j.state === 'error', ind = j.state === 'running' && (j.kind === 'images' || j.stage === 'tools' || j.stage === 'preparing' || j.stage === 'finishing' || !j.pct);
    const gal = j.kind === 'images' && j.state === 'done';
    h += `<div class="job${gal ? ' wide' : ''}" data-j="${esc(j.id)}">
      <div class="th"${m.thumb ? ` style="background-image:url(&quot;${esc(m.thumb)}&quot;)"` : ''}></div>
      <div class="tx"><div class="nm" title="${esc(j.url)}">${esc(m.title || j.title || j.name || j.url)}</div>
        <div class="st${bad ? ' bad' : j.state === 'done' ? ' ok' : ''}">${esc(jobText(j))}</div>
        ${j.state === 'running' || j.state === 'trim' ? `<div class="pb${ind ? ' ind' : ''}"><i style="width:${j.pct}%"></i></div>` : ''}</div>
      <div class="acts">${j.state === 'running' || j.state === 'trim' ? `<button data-m="cancel" title="${L('إلغاء', 'Cancel')}">${ICON.x}</button>` : ''}
        ${j.state === 'done' && j.file ? `<button data-m="show">${ICON.folder}${L('عرض', 'Show')}</button>` : ''}
        ${bad || j.state === 'cancelled' ? `<button data-m="retry">${ICON.retry}${L('مرة ثانية', 'Retry')}</button>` : ''}</div>
      ${gal ? gallery(j) : ''}</div>`;
  }
  $('mjobs').innerHTML = h;
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
  return h + `</div><div class="galbar"><button data-m="all">${L('تحديد الكل', 'Select all')}</button><button data-m="none">${L('إلغاء التحديد', 'Select none')}</button><span style="flex:1"></span><button class="go" data-m="save">${L('حفظ المحدد', 'Save selected')} (${sel.size})</button></div>`;
}

/* ---------- the link's preview ---------- */
const SITES = { youtube: 'YouTube', youtubetab: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X', facebook: 'Facebook', reddit: 'Reddit',
  vimeo: 'Vimeo', twitch: 'Twitch', twitchvod: 'Twitch', twitchclips: 'Twitch', dailymotion: 'Dailymotion', soundcloud: 'SoundCloud', snapchat: 'Snapchat', pinterest: 'Pinterest', threads: 'Threads' };
function siteName(k, u) {
  k = String(k || '').toLowerCase().replace(/[^a-z]/g, '');
  if (SITES[k]) return SITES[k];
  if (!k || /generic|html5|embed/.test(k)) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  return k.charAt(0).toUpperCase() + k.slice(1);
}
const pv = $('pvv');
function showError(code) {
  $('perr').hidden = !code;
  if (!code) return;
  $('perrT').textContent = explain(code);
  $('perrD').hidden = isCode(code);
  $('perrP').textContent = String(code);
}
async function preview(u) {
  u = String(u || '').trim();
  if (!/^https?:\/\//i.test(u)) { info = null; $('card').hidden = true; resetPlayer(); return draw(); }
  if (info && info.url === u) return;
  const my = ++infoSeq;
  info = { url: u, loading: true };
  cut = { s: 0, e: 0 }; note = ''; noteBad = false;
  resetPlayer();
  $('card').hidden = false; $('card').className = 'card loading';
  $('pm').style.backgroundImage = ''; $('pdur').hidden = $('psite').hidden = true;
  $('ptitle').textContent = 'loading'; $('pby').textContent = 'loading';
  showError('');
  draw();
  const r = await zeus.mediaInfo(u);
  if (my !== infoSeq) return;
  info = Object.assign({ url: u, loading: false }, r || {});
  $('card').className = 'card';
  if (!r || r.error) {
    $('ptitle').textContent = u; $('pby').textContent = '';
    if (isPhotoLink(u) || /no video formats|photo/i.test((r && r.error) || '')) {
      setMode('images');
      $('pby').textContent = L('منشور صور: اضغط «عرض الصور» وتختار منها.', 'A photo post: press "Show photos" and pick from them.');
    } else if (isFeed(u)) showError(L('هذي صفحة تيك توك الرئيسية، مو مقطع. افتح المقطع نفسه، أو شغّله واضغط زر الثعلب وهو قدامك.', 'This is TikTok\'s feed, not a video. Open the video, or press the fox button while it plays.'));
    else showError((r && r.error) || 'no-info');
    return draw();
  }
  if (r.thumbnail) $('pm').style.backgroundImage = `url("${String(r.thumbnail).replace(/"/g, '%22')}")`;
  $('pdur').hidden = !r.duration; $('pdur').textContent = r.duration ? fmtShort(r.duration) : '';
  const site = siteName(r.site, u);
  $('psite').hidden = !site; $('psite').textContent = site;
  $('ptitle').textContent = r.title || u;
  $('pby').textContent = r.uploader || '';
  // only the qualities this video really has
  const hs = r.heights || [];
  for (const o of $('mq').options) if (o.value !== 'best') o.hidden = hs.length ? !hs.some(h => h >= +o.value * 0.9) : false;
  if ($('mq').selectedOptions[0] && $('mq').selectedOptions[0].hidden) $('mq').value = 'best';
  // a light stream to watch the part before downloading (some sites don't allow it: then the picture stays)
  if (r.preview) { pv.src = r.preview; pv.hidden = false; $('pplay').hidden = false; }
  draw();
}
function resetPlayer() { pv.pause(); pv.removeAttribute('src'); pv.load(); pv.hidden = true; $('pplay').hidden = true; $('pm').classList.remove('playing'); $('tph').hidden = true; }
// some sites don't say how long the video is: the preview stream does
pv.addEventListener('loadedmetadata', () => { if (info && !info.loading && !(info.duration > 0) && isFinite(pv.duration) && pv.duration > 0) { info.duration = pv.duration; $('pdur').hidden = false; $('pdur').textContent = fmtShort(pv.duration); draw(); } });
pv.addEventListener('error', () => { if (pv.getAttribute('src')) { pv.hidden = true; $('pplay').hidden = true; } });
// the preview only plays the chosen part
$('pm').onclick = () => {
  if (pv.hidden || !pv.getAttribute('src')) return;
  if (pv.paused) { if (pv.currentTime < cut.s - 0.05 || pv.currentTime >= end() - 0.05) pv.currentTime = cut.s; pv.play().catch(() => {}); }
  else pv.pause();
};
pv.addEventListener('play', () => $('pm').classList.add('playing'));
pv.addEventListener('pause', () => $('pm').classList.remove('playing'));
pv.addEventListener('timeupdate', () => {
  const d = dur(); if (!d) return;
  $('tph').hidden = false; $('tph').style.insetInlineStart = (pv.currentTime / d * 100) + '%';
  if (!pv.paused && pv.currentTime >= end()) { pv.pause(); pv.currentTime = end(); }
});

/* ---------- the timeline ---------- */
const MIN = 0.3;
$('ts').addEventListener('input', () => { const d = dur(); if (!d) return; cut.s = Math.min(+$('ts').value / 1000 * d, end() - MIN); if (cut.s < 0) cut.s = 0; seekTo(cut.s); draw(); });
$('te').addEventListener('input', () => { const d = dur(); if (!d) return; cut.e = Math.min(d, Math.max(+$('te').value / 1000 * d, cut.s + MIN)); seekTo(cut.e); draw(); });
function seekTo(t) { if (!pv.hidden && pv.getAttribute('src') && pv.readyState > 0) { pv.pause(); pv.currentTime = t; } }
const setTime = (which, t) => {
  const d = dur(); if (isNaN(t) || t < 0 || !d) return draw();
  t = Math.min(t, d);
  if (which === 's') cut.s = Math.min(t, end() - MIN); else cut.e = Math.max(t, cut.s + MIN);
  draw();
};
$('tsi').addEventListener('change', () => setTime('s', parseT($('tsi').value)));
$('tei').addEventListener('change', () => setTime('e', parseT($('tei').value)));
$('tsNow').onclick = () => setTime('s', pv.hidden ? NaN : pv.currentTime);
$('teNow').onclick = () => setTime('e', pv.hidden ? NaN : pv.currentTime);
$('cutFull').onclick = () => { cut = { s: 0, e: 0 }; draw(); };
$('mq').onchange = draw;

/* ---------- downloading ---------- */
async function start(url, m) {
  url = (url || '').trim();
  if (!url) { note = L('الصق الرابط أول.', 'Paste a link first.'); noteBad = true; return draw(); }
  if (m === 'video' && isPhotoLink(url)) m = 'images';
  if (starting) return;
  note = ''; noteBad = false; starting = true; draw();
  const o = { url, mode: m, q: $('mq').value };
  if (info && info.url === url && !info.error) {
    o.infoId = info.infoId;   // the page was already read: the download starts right away
    if (m !== 'images' && !isWhole()) { o.start = cut.s; o.end = end(); o.exact = document.querySelector('input[name=cm]:checked').value === 'exact'; }
  }
  const r = await zeus.mediaStart(o);
  starting = false;
  if (r && r.error) { note = explain(r.error); noteBad = true; }
  else if (r && r.id) meta.set(r.id, { thumb: info && info.url === url ? info.thumbnail : '', title: info && info.url === url ? info.title : '' });
  await load();
}
$('mgo').onclick = () => start($('murl').value, mode);
$('murl').addEventListener('keydown', e => { if (e.key === 'Enter') { const u = $('murl').value.trim(); if (info && info.url === u && !info.loading) start(u, mode); else preview(u); } });
$('murl').addEventListener('change', () => preview($('murl').value));
$('murl').addEventListener('input', () => { if (isPhotoLink($('murl').value) && mode !== 'images') setMode('images'); });
$('mpaste').onclick = async () => { try { $('murl').value = (await navigator.clipboard.readText()).trim(); } catch (e) {} preview($('murl').value); };
$('mchg').onclick = async () => { const f = await zeus.mediaFolder(true); if (f) { M.folder = f; draw(); } };
$('mopen').onclick = () => zeus.mediaFolder(false);
$('mupd').onclick = async () => {
  $('mupd').disabled = true; note = L('أحدّث أدوات التحميل…', 'Updating the download tools…'); noteBad = false; draw();
  const r = await zeus.mediaUpdate(); $('mupd').disabled = false;
  if (r && r.error) { note = explain(r.error); noteBad = true; } else note = r ? `yt-dlp: ${r.ytdlp}\ngallery-dl: ${r.gallerydl}` : '';
  draw();
};
$('mjobs').addEventListener('click', async e => {
  const row = e.target.closest('.job'); if (!row) return;
  const j = M.jobs.find(x => x.id === row.dataset.j); if (!j) return;
  const tile = e.target.closest('.tile');
  if (tile) { const s = msel.get(j.id); const i = +tile.dataset.i; s.has(i) ? s.delete(i) : s.add(i); return drawJobs(); }
  const b = e.target.closest('[data-m]'); if (!b) return;
  const c = b.dataset.m;
  if (c === 'cancel') { await zeus.mediaCancel(j.id); return load(); }
  if (c === 'show') return zeus.mediaShow(j.file);
  if (c === 'retry') { $('murl').value = j.url; return start(j.url, j.kind === 'images' ? 'images' : j.mode || 'video'); }
  if (c === 'all') { msel.set(j.id, new Set(j.items.map(x => x.i))); return drawJobs(); }
  if (c === 'none') { msel.set(j.id, new Set()); return drawJobs(); }
  if (c === 'save') {
    const idx = [...(msel.get(j.id) || [])];
    if (!idx.length) { note = L('اختر صورة وحدة على الأقل.', 'Pick at least one.'); noteBad = true; return draw(); }
    const r = await zeus.mediaSave(j.id, idx);
    if (r && r.error) { note = explain(r.error); noteBad = true; } else { note = L(`انحفظ ${r.saved} ✓`, `Saved ${r.saved} ✓`); noteBad = false; }
    draw();
  }
});
async function load() { const d = await zeus.mediaList(); if (d) M = d; draw(); }
const take = u => { if (!u) return; $('murl').value = u; if (isPhotoLink(u)) setMode('images'); window.scrollTo(0, 0); preview(u); };
zeus.onMedia(load);
zeus.onMediaUrl(take);
zeus.mediaTake().then(take);
zeus.getLang().then(l => { lang = l || 'ar'; draw(); });
zeus.onLang(l => { lang = l; draw(); });
setMode('video'); load();
