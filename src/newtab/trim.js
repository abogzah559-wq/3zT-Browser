'use strict';
/* the trimming window, shared by the downloads page and the video downloader window.
   Pages set trimHooks.done (refresh after saving) and trimHooks.err (error text). */
const trimHooks = Object.assign({ done: () => {}, err: e => String(e || '') }, window.trimHooks || {});   // the page sets window.trimHooks before loading this file
const fileUrl = p => 'file:///' + String(p).replace(/\\/g, '/').split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
(() => {
  const st = document.createElement('style'); st.textContent = `/* trimming */
#trim{position:fixed;inset:0;background:rgba(0,0,0,.72);display:grid;place-items:center;z-index:10}
#trim[hidden]{display:none}
.tbox{width:min(760px,94vw);background:#121218;border:1px solid var(--line);border-radius:16px;padding:16px}
.tbox video{width:100%;max-height:52vh;background:#000;border-radius:10px;display:block}
.tl{position:relative;height:34px;margin:14px 6px 4px}
.tl .track{position:absolute;inset:14px 0;height:6px;border-radius:3px;background:rgba(255,255,255,.12)}
.tl .sel{position:absolute;top:14px;height:6px;background:var(--acc);border-radius:3px}
.tl input{position:absolute;inset:0;width:100%;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none;height:34px}
.tl input::-webkit-slider-thumb{pointer-events:auto;-webkit-appearance:none;width:16px;height:26px;border-radius:5px;background:#fff;cursor:ew-resize;border:2px solid var(--acc)}
.tl input::-webkit-slider-runnable-track{background:none}
.ttm{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;margin-top:6px}
.ttm input[type=text]{width:92px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font:inherit;direction:ltr;text-align:center}
.ttm .len{color:var(--acc);font-weight:600}
.mnote{font-size:12.5px;color:rgba(255,255,255,.55);margin-top:10px;line-height:1.7}
.mnote.bad{color:#ff8a80}
.tacts .go{background:#8ab4f8;color:#0b0b0f;border-color:transparent;font-weight:600}
.tacts .go:disabled{opacity:.5;cursor:default}
.tmode{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:13px}
.tmode label{display:flex;gap:8px;align-items:flex-start;cursor:pointer;color:#ddd}
.tmode small{display:block;color:var(--muted);font-size:12px}
.tacts{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
`; document.head.appendChild(st);
  document.body.insertAdjacentHTML('beforeend', `<div id="trim" hidden><div class="tbox">
  <video id="tv" controls preload="metadata"></video>
  <div class="tl"><div class="track"></div><div class="sel" id="tsel"></div><input type="range" id="ts" min="0" max="1000" value="0" step="1"><input type="range" id="te" min="0" max="1000" value="1000" step="1"></div>
  <div class="ttm"><span id="tsL"></span><input type="text" id="tsi"><button id="tsNow"></button><span id="teL"></span><input type="text" id="tei"><button id="teNow"></button><span style="flex:1"></span><span id="tlenL"></span><span class="len" id="tlen"></span></div>
  <div class="tmode">
    <label><input type="radio" name="tm" value="fast" checked><span><span id="tmF"></span><small id="tmFs"></small></span></label>
    <label><input type="radio" name="tm" value="exact"><span><span id="tmE"></span><small id="tmEs"></small></span></label>
  </div>
  <div class="mnote" id="tnote"></div>
  <div class="tacts"><button id="tplay"></button><span style="flex:1"></span><button id="tcancel"></button><button id="twhole"></button><button class="go" id="tsave"></button></div>
</div></div>`);
})();
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
$('tv').addEventListener('loadedmetadata', () => { if (T) { const d = $('tv').duration; T.dur = isFinite(d) && d > 0 ? d : 0; if (T.e == null || T.e > T.dur) T.e = T.dur; tpaint(); } });
$('tv').addEventListener('error', () => { if (T) { $('tnote').className = 'mnote bad'; $('tnote').textContent = L('ما قدرت أعرض هذا الفيديو هنا، لكن تقدر تقصه بكتابة الأوقات.', 'This video cannot be previewed here, but you can still type the times.'); } });
$('ts').addEventListener('input', () => { if (!T || !T.dur) return; T.s = Math.min(+$('ts').value / 1000 * T.dur, tval().e - 0.1); tpaint(); $('tv').currentTime = T.s; });
$('te').addEventListener('input', () => { if (!T || !T.dur) return; T.e = Math.min(T.dur, Math.max(+$('te').value / 1000 * T.dur, T.s + 0.1)); tpaint(); $('tv').currentTime = T.e; });
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
/* the preview only ever plays the chosen part: playing starts at its start, stops at its end,
   and seeking outside it (also with the video's own controls) is brought back inside */
const inPart = () => T && (T.dur || $('tv').duration);
$('tplay').onclick = () => { if (!T) return; $('tv').currentTime = tval().s; $('tv').play(); };
$('tv').addEventListener('play', () => {
  if (!inPart()) return;
  const { s, e } = tval(), t = $('tv').currentTime;
  if (t < s - 0.05 || t >= e - 0.05) $('tv').currentTime = s;
});
$('tv').addEventListener('timeupdate', () => {
  if (!inPart()) return;
  const { e } = tval();
  if (!$('tv').paused && $('tv').currentTime >= e) { $('tv').pause(); $('tv').currentTime = e; }
});
$('tv').addEventListener('seeking', () => {
  if (!inPart() || $('tv').paused) return;   // paused: move anywhere, e.g. to pick a new start with "Set to current"
  const { s, e } = tval(), t = $('tv').currentTime;
  if (t < s - 0.05) $('tv').currentTime = s; else if (t > e + 0.05) $('tv').currentTime = e;
});
const closeTrim = () => { $('tv').pause(); $('tv').removeAttribute('src'); $('tv').load(); $('trim').hidden = true; T = null; };
$('tcancel').onclick = async () => {
  if (T && T.busy) { if (T.jobId) await zeus.mediaCancel(T.jobId); else await zeus.mediaTrimCancel(T.listId); }
  closeTrim(); trimHooks.done();
};
$('twhole').onclick = async () => { if (!T || !T.jobId) return; const id = T.jobId; closeTrim(); await zeus.mediaTrim(id, { whole: true }); trimHooks.done(); };
$('tsave').onclick = async () => {
  if (!T) return;
  const { s, e } = tval(), exact = document.querySelector('input[name=tm]:checked').value === 'exact';
  if (!(e - s > 0.2)) { $('tnote').className = 'mnote bad'; $('tnote').textContent = L('اختر جزء أطول', 'Pick a longer part'); return; }
  $('tsave').disabled = true; $('twhole').disabled = true; $('tnote').className = 'mnote'; $('tnote').textContent = L('أقص المقطع…', 'Trimming…');
  T.busy = true; const cur = T;
  const r = T.jobId ? await zeus.mediaTrim(T.jobId, { start: s, end: e, exact }) : await zeus.mediaTrimFile(T.listId, { start: s, end: e, exact });
  cur.busy = false; $('tsave').disabled = false; $('twhole').disabled = false;
  if (T !== cur) return;   // cancelled meanwhile
  if (r && r.error) { $('tnote').className = 'mnote bad'; $('tnote').textContent = trimHooks.err(r.error); return; }
  closeTrim(); trimHooks.done();
};
zeus.onTrimPct((id, pc) => { if (T && T.listId === id) $('tnote').textContent = L('أقص المقطع… ', 'Trimming… ') + Math.round(pc) + '%'; });

