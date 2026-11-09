'use strict';
/* 3zt://downloads - the built-in download manager */
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
  if (r.state === 'completed') return (r.exists !== false && /\.(mp4|webm|mov|m4v|mkv)$/i.test(r.name || '') ? b('trim', L('قص', 'Trim')) : '') + b('show', L('عرض في المجلد', 'Show in folder')) + b('remove', '✕', 'x');
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
    h += `<div class="it${r.state === 'completed' && r.exists === false ? ' gone' : ''}" data-id="${esc(r.id)}"${r.state === 'completed' && r.exists !== false ? ` draggable="true" title="${esc(L('اسحبه إلى موقع أو مجلد', 'Drag it onto a website or a folder'))}"` : ''}>
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
  if (b.dataset.c === 'trim') { const r = D.items.find(x => x.id === id); if (r) openTrim({ file: r.path, listId: id }); return; }
  await zeus.dlAct(id, b.dataset.c); load();
});
$('q').addEventListener('input', draw);
$('clear').onclick = async () => { await zeus.dlClear(); load(); };
$('open').onclick = () => zeus.dlFolder();
$('ask').onclick = () => { zeus.set('dlAsk', !D.ask); setTimeout(load, 150); };
zeus.onDl(load);
zeus.getLang().then(l => { lang = l || 'ar'; load(); });
zeus.onLang(l => { lang = l; draw(); mdraw(); });

$('list').addEventListener('dragstart', e => {
  const it = e.target.closest && e.target.closest('.it[draggable=true]'); if (!it) return;
  e.preventDefault(); zeus.dlDrag(it.dataset.id);
});

/* ================= built-in media downloader ================= */
let starting = false, mode = 'video', M = { jobs: [], tools: { ready: false }, folder: '' }, msel = new Map(), mErr = '';
const fileUrl = p => 'file:///' + String(p).replace(/\\/g, '/').split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
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
  $('mT').textContent = L('تحميل فيديو أو صوت أو صور من رابط', 'Download a video, audio or photos from a link');
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
  $('mnote').textContent = mErr || (M.tools.ready ? '' : L('أول تحميل يجهّز أدوات التحميل (yt-dlp و gallery-dl و ffmpeg، تقريباً 100 م.ب) من مصادرها الرسمية ويتأكد من سلامتها. بعدها كل شي فوري.', 'The first download sets up the tools (yt-dlp, gallery-dl and ffmpeg, about 100 MB) from their official releases and checks them. After that it is instant.'));
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
$('murl').addEventListener('keydown', e => { if (e.key === 'Enter') mstart($('murl').value, mode); });
$('murl').addEventListener('input', () => { if (isPhotoLink($('murl').value) && mode !== 'images') setMode('images'); });
$('mpaste').onclick = async () => { try { $('murl').value = (await navigator.clipboard.readText()).trim(); } catch (e) {} $('murl').focus(); };
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
zeus.onMediaUrl(u => { $('murl').value = u; if (isPhotoLink(u)) setMode('images'); $('murl').focus(); window.scrollTo(0, 0); });
zeus.mediaTake().then(u => { if (u) { $('murl').value = u; if (isPhotoLink(u)) setMode('images'); } });
setMode('video'); mload();

/* ================= trimming ================= */
let T = null;   // { file, jobId | listId, dur }
const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + x.toFixed(1).padStart(4, '0'); };
const parse = t => { const p = String(t).trim().split(':').map(Number); if (p.some(isNaN)) return NaN; return p.reduce((a, v) => a * 60 + v, 0); };
// the chosen times in seconds are the real state; the sliders only show them
function tval() { return { s: T.s || 0, e: T.e != null ? T.e : (T.dur || 0) }; }
function tsync() { if (!T.dur) return; $('ts').value = Math.round(T.s / T.dur * 1000); $('te').value = Math.round((T.e != null ? T.e : T.dur) / T.dur * 1000); }
function tpaint() {
  tsync();
  const { s, e } = tval();
  $('tsel').style.insetInlineStart = (+$('ts').value / 10) + '%';
  $('tsel').style.width = Math.max(0, (+$('te').value - +$('ts').value) / 10) + '%';
  if (document.activeElement !== $('tsi')) $('tsi').value = fmt(s);
  if (document.activeElement !== $('tei')) $('tei').value = fmt(e);
  $('tlen').textContent = fmt(e - s);
}
function openTrim(o) {
  if (!o.file) return;
  T = Object.assign({ dur: 0, s: 0, e: null, busy: false }, o);
  $('tsL').textContent = L('البداية', 'Start'); $('teL').textContent = L('النهاية', 'End'); $('tlenL').textContent = L('المدة:', 'Length:');
  $('tsNow').textContent = L('من الوقت الحالي', 'Set to current'); $('teNow').textContent = L('من الوقت الحالي', 'Set to current');
  $('tmF').textContent = L('سريع وبنفس الجودة', 'Fast, same quality');
  $('tmFs').textContent = L('ما يعيد ترميز الفيديو، فالجودة ما تتغير. القص يبدأ من أقرب إطار مفتاحي قبل البداية، يعني ممكن يبدأ قبلها بثواني قليلة.', 'The video is not re-encoded, so quality stays the same. The cut starts at the nearest key frame before your start, so it may begin a few seconds early.');
  $('tmE').textContent = L('دقيق على الإطار', 'Frame-exact');
  $('tmEs').textContent = L('يعيد ترميز الفيديو بجودة عالية عشان يقص بالضبط. أبطأ، والملف يطلع MP4.', 'Re-encodes the video at high quality to cut exactly. Slower; the result is MP4.');
  $('tplay').textContent = L('▶ تشغيل المقطع', '▶ Play the part');
  $('tcancel').textContent = L('إلغاء', 'Cancel');
  $('twhole').textContent = L('حفظ الفيديو كامل', 'Save the whole video'); $('twhole').hidden = !T.jobId;
  $('tsave').textContent = L('حفظ الجزء المحدد', 'Save this part');
  $('tnote').textContent = ''; $('tnote').className = 'mnote';
  $('ts').value = 0; $('te').value = 1000;
  $('tv').src = fileUrl(T.file);
  $('trim').hidden = false;
}
$('tv').addEventListener('loadedmetadata', () => { if (T) { T.dur = $('tv').duration || 0; if (T.e == null || T.e > T.dur) T.e = T.dur; tpaint(); } });
$('tv').addEventListener('error', () => { if (T) { $('tnote').className = 'mnote bad'; $('tnote').textContent = L('ما قدرت أعرض هذا الفيديو هنا، لكن تقدر تقصه بكتابة الأوقات.', 'This video cannot be previewed here, but you can still type the times.'); } });
$('ts').addEventListener('input', () => { if (!T || !T.dur) return; T.s = Math.min(+$('ts').value / 1000 * T.dur, tval().e - 0.1); tpaint(); $('tv').currentTime = T.s; });
$('te').addEventListener('input', () => { if (!T || !T.dur) return; T.e = Math.max(+$('te').value / 1000 * T.dur, T.s + 0.1); tpaint(); $('tv').currentTime = T.e; });
// typed or "current time": exact seconds, also when the video cannot be previewed (length unknown)
const setBy = (which, sec) => {
  if (!T || isNaN(sec) || sec < 0) return;
  if (T.dur) sec = Math.min(sec, T.dur);
  if (which === 'ts') T.s = sec; else T.e = sec;
  tpaint();
  if (T.dur) $('tv').currentTime = sec;
};
$('tsi').addEventListener('change', () => setBy('ts', parse($('tsi').value)));
$('tei').addEventListener('change', () => setBy('te', parse($('tei').value)));
$('tsNow').onclick = () => setBy('ts', $('tv').currentTime);
$('teNow').onclick = () => setBy('te', $('tv').currentTime);
let stopAt = null;
$('tplay').onclick = () => { const { s, e } = tval(); stopAt = e; $('tv').currentTime = s; $('tv').play(); };
$('tv').addEventListener('timeupdate', () => { if (stopAt != null && $('tv').currentTime >= stopAt) { $('tv').pause(); stopAt = null; } });
const closeTrim = () => { $('tv').pause(); $('tv').removeAttribute('src'); $('tv').load(); $('trim').hidden = true; T = null; };
$('tcancel').onclick = async () => {
  if (T && T.busy) { if (T.jobId) await zeus.mediaCancel(T.jobId); else await zeus.mediaTrimCancel(T.listId); }
  closeTrim(); mload();
};
$('twhole').onclick = async () => { if (!T || !T.jobId) return; const id = T.jobId; closeTrim(); await zeus.mediaTrim(id, { whole: true }); mload(); };
$('tsave').onclick = async () => {
  if (!T) return;
  const { s, e } = tval(), exact = document.querySelector('input[name=tm]:checked').value === 'exact';
  if (!(e - s > 0.2)) { $('tnote').className = 'mnote bad'; $('tnote').textContent = L('اختر جزء أطول', 'Pick a longer part'); return; }
  $('tsave').disabled = true; $('twhole').disabled = true; $('tnote').className = 'mnote'; $('tnote').textContent = L('أقص المقطع…', 'Trimming…');
  T.busy = true; const cur = T;
  const r = T.jobId ? await zeus.mediaTrim(T.jobId, { start: s, end: e, exact }) : await zeus.mediaTrimFile(T.listId, { start: s, end: e, exact });
  cur.busy = false; $('tsave').disabled = false; $('twhole').disabled = false;
  if (T !== cur) return;   // cancelled meanwhile
  if (r && r.error) { $('tnote').className = 'mnote bad'; $('tnote').textContent = ERR(r.error); return; }
  closeTrim(); mload(); load();
};
zeus.onTrimPct((id, pc) => { if (T && T.listId === id) $('tnote').textContent = L('أقص المقطع… ', 'Trimming… ') + Math.round(pc) + '%'; });
