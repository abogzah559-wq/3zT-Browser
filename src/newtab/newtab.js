const THEMES = {
  space:'فضاء ونجوم', black:'أسود حقيقي', galaxy:'مجرة ملوّنة', matrix:'ماتريكس',
  aurora:'شفق', sunset:'غروب', ocean:'محيط', fireflies:'يراعات', anime:'أنمي نيون (فيديو)', media:'صورة / فيديو', custom:'لون مخصص'
};
const TEN={space:'Space & stars',black:'True black',galaxy:'Galaxy',matrix:'Matrix',aurora:'Aurora',sunset:'Sunset',ocean:'Ocean',fireflies:'Fireflies',anime:'Anime neon (video)',media:'Image / video',custom:'Custom color'};
const FONTS = {
  def:   {ar:'الافتراضي (طويل)', en:'Default (condensed)', css:'Bahnschrift,"Arial Narrow","Roboto Condensed",Oswald,Impact,sans-serif'},
  tajawal:{ar:'تجوال', en:'Tajawal', css:'Tajawal,Tahoma,sans-serif'},
  kufi:  {ar:'ريم كوفي', en:'Reem Kufi', css:'"Reem Kufi",Tajawal,sans-serif'},
  orbit: {ar:'أوربترون (رقمي)', en:'Orbitron (digital)', css:'Orbitron,Tajawal,sans-serif'},
  mine:  {ar:'خطي المرفوع', en:'My uploaded font', css:'ZeusUserFont,system-ui,sans-serif'},
  sys:   {ar:'خط من جهازي (بالاسم)', en:'Font from my PC (by name)', css:null}
};
/* ---- extra Google fonts (loaded on demand). a = has Arabic glyphs. Latin-only fonts fall back to Tajawal for Arabic text ---- */
(()=>{
  const tail={mine:FONTS.mine,sys:FONTS.sys}; delete FONTS.mine; delete FONTS.sys;
  const add=(name,a)=>{ const k='g_'+name.toLowerCase().replace(/[^a-z0-9]/g,'');
    FONTS[k]={ar:name+(a?' (عربي)':''),en:name+(a?' (Arabic)':''),css:`"${name}",Tajawal,sans-serif`,g:name.replace(/ /g,'+'),w:400}; };
  ['Cairo','Almarai','Changa','El Messiri','Lalezar','Aref Ruqaa','Amiri','Rakkas','Lemonada','Mada','Readex Pro',
   'IBM Plex Sans Arabic','Noto Kufi Arabic','Katibeh','Jomhuria','Harmattan','Marhey','Noto Naskh Arabic'].forEach(n=>add(n,true));
  ['Bebas Neue','Oswald','Rajdhani','Audiowide','Michroma','Share Tech Mono','Poppins','Montserrat','Righteous','Bungee','Syncopate',
   'Teko','Anton','Pacifico','Space Grotesk','Playfair Display','Major Mono Display','Press Start 2P','VT323','Exo 2','Russo One',
   'Monoton','Chakra Petch','Big Shoulders Display','Staatliches','Dancing Script'].forEach(n=>add(n,false));
  Object.assign(FONTS,tail);
})();
const DEF = {theme:'anime',density:160,speed:1,accent:'#8ab4f8',color:'#000000',clockOn:true,searchOn:true,clock:180,h24:false,dim:35,src:'bm',lang:'ar',dateOn:true,
  dateSize:17,shiftX:0,clockFont:'def',dateFont:'def',fontName:'',maxTiles:999,tileSize:40,names:false,hidden:[],mine:[],order:[],aiDest:'gemini',clockOp:100,dateOp:100};
let S = Object.assign({}, DEF);
try { Object.assign(S, JSON.parse(localStorage.getItem('ntp') || '{}')); } catch(e){}
if(S.v!==2){S.clock=180;S.v=2;}
/* v1.7: shortcuts come from the bookmarks bar, all of them; the count slider trims them */
if(S.sc3===undefined){ S.sc3=1; S.src='bm'; S.maxTiles=999; S.hidden=[]; }
if(S.src!=='bm'&&S.src!=='off') S.src='bm'; /* only bookmarks bar / hidden now */
for (const k in DEF) if (S[k]===undefined) S[k]=Array.isArray(DEF[k])?[]:DEF[k];
const save = () => { try { localStorage.setItem('ntp', JSON.stringify(S)); } catch(e){} };
const $ = id => document.getElementById(id);
const en = () => S.lang==='en';

const cv = $('c'), ctx = cv.getContext('2d');
let W, H, raf, items = [], shooters = [];
function resize(){ W = cv.width = innerWidth; H = cv.height = innerHeight; init(); }
addEventListener('resize', resize);

function init(){
  items = []; shooters = [];
  const n = S.density;
  if (S.theme==='space' || S.theme==='galaxy')
    for (let i=0;i<n;i++) items.push({x:Math.random()*W,y:Math.random()*H,z:Math.random()*.9+.1,t:Math.random()*6.28,
      h: S.theme==='galaxy' ? Math.random()*360 : 210});
  if (S.theme==='fireflies')
    for (let i=0;i<n/3;i++) items.push({x:Math.random()*W,y:Math.random()*H,a:Math.random()*6.28,t:Math.random()*6.28,r:Math.random()*2+1});
  if (S.theme==='matrix'){
    const cols = Math.floor(W/16);
    for (let i=0;i<cols;i++) items.push({y:Math.random()*H/16,s:Math.random()*.5+.5});
  }
}

function frame(){
  const sp = +S.speed;
  if (S.theme==='space' || S.theme==='galaxy'){
    ctx.fillStyle = S.theme==='galaxy' ? '#05010f' : '#000'; ctx.fillRect(0,0,W,H);
    if (S.theme==='galaxy'){
      const g = ctx.createRadialGradient(W*.7,H*.4,0,W*.7,H*.4,W*.5);
      g.addColorStop(0,'rgba(120,40,200,.35)'); g.addColorStop(.5,'rgba(30,60,200,.15)'); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    }
    for (const s of items){
      s.x -= s.z*sp*.4; if (s.x<0){ s.x = W; s.y = Math.random()*H; }
      s.t += .03*sp+.01;
      const a = .4+.6*Math.abs(Math.sin(s.t));
      ctx.fillStyle = S.theme==='galaxy' ? `hsla(${s.h},90%,75%,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.z*1.6,0,6.28); ctx.fill();
    }
    if (sp>0 && Math.random()<.008*sp) shooters.push({x:Math.random()*W,y:Math.random()*H*.5,l:0});
    shooters = shooters.filter(s=>s.l<40);
    for (const s of shooters){
      s.x += 14; s.y += 7; s.l++;
      const gr = ctx.createLinearGradient(s.x,s.y,s.x-90,s.y-45);
      gr.addColorStop(0,'rgba(255,255,255,.9)'); gr.addColorStop(1,'transparent');
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-90,s.y-45); ctx.stroke();
    }
  } else if (S.theme==='matrix'){
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0,0,W,H);
    ctx.font = '16px monospace';
    items.forEach((c,i)=>{
      const ch = String.fromCharCode(0x30A0+Math.random()*96);
      ctx.fillStyle = S.accent; ctx.fillText(ch,i*16,c.y*16);
      c.y += c.s*sp; if (c.y*16>H && Math.random()>.975) c.y = 0;
    });
  } else if (S.theme==='fireflies'){
    ctx.fillStyle = '#050a08'; ctx.fillRect(0,0,W,H);
    for (const f of items){
      f.a += (Math.random()-.5)*.2; f.x += Math.cos(f.a)*sp*.6; f.y += Math.sin(f.a)*sp*.6; f.t += .03;
      if (f.x<0) f.x=W; if (f.x>W) f.x=0; if (f.y<0) f.y=H; if (f.y>H) f.y=0;
      const a = .2+.8*Math.abs(Math.sin(f.t));
      const g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*8);
      g.addColorStop(0,`rgba(220,255,120,${a})`); g.addColorStop(1,'transparent');
      ctx.fillStyle = g; ctx.fillRect(f.x-f.r*8,f.y-f.r*8,f.r*16,f.r*16);
    }
  }
  raf = requestAnimationFrame(frame);
}

function apply(){
  cancelAnimationFrame(raf);
  document.body.className = ['aurora','sunset','ocean'].includes(S.theme) ? S.theme : '';
  fs();
  document.documentElement.style.setProperty('--accent', S.accent); extraApply();
  const canvasThemes = ['space','galaxy','matrix','fireflies'];
  cv.style.display = canvasThemes.includes(S.theme) ? 'block' : 'none';
  document.body.style.background = S.theme==='black' ? '#000' : S.theme==='custom' ? S.color : '';
  $('clock').style.display = S.clockOn ? '' : 'none';
  $('search').style.display = S.searchOn ? '' : 'none';
  if (canvasThemes.includes(S.theme)){ init(); frame(); }
  buildThemes(); save();
}

function buildThemes(){
  const box = $('themes'); box.innerHTML = '';
  for (const k in THEMES){
    const b = document.createElement('button'); b.textContent = (en()?TEN:THEMES)[k];
    if (k===S.theme) b.className = 'on';
    b.onclick = () => { S.theme = k; apply(); };
    box.appendChild(b);
  }
}

$('density').value = S.density; $('speed').value = S.speed; $('accent').value = S.accent;
$('color').value = S.color; $('clockOn').checked = S.clockOn; $('searchOn').checked = S.searchOn;
$('density').oninput = e => { S.density = +e.target.value; initF(); saveSoon(); };
$('speed').oninput = e => { S.speed = +e.target.value; saveSoon(); };
$('accent').oninput = e => { S.accent = e.target.value; apply(); };
$('color').oninput = e => { S.color = e.target.value; apply(); };
$('clockOn').onchange = e => { S.clockOn = e.target.checked; apply(); };
$('searchOn').onchange = e => { S.searchOn = e.target.checked; apply(); };
$('gear').onclick = () => { $('panel').hidden = !$('panel').hidden; };
$('reset').onclick = () => {
  const keepLang=S.lang; S = Object.assign({}, DEF, {hidden:[],mine:[],order:[],lang:keepLang,v:2,sc3:1}); lastSrc=null; apply();
  $('density').value = S.density; $('speed').value = S.speed; $('accent').value = S.accent;
  $('color').value = S.color; $('clockOn').checked = true; $('searchOn').checked = true;
};

/* ---- search + AI mode ---- */
const looksUrl = t => /^(https?:\/\/|www\.)\S+$/i.test(t) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t);
/* ---- AI Mode state: toggle button, paste an image, Enter ---- */
let aiMode=false, aiImg=null, aiThumbURL=null;
function updPh(){
  $('q').placeholder = aiImg ? (en()?'Image ready: press Enter, then Ctrl+V in AI Mode':'الصورة جاهزة: اضغط Enter ثم الصقها (Ctrl+V) في وضع AI')
    : aiMode ? (en()?'Ask Google AI Mode':'اسأل وضع AI من Google')
    : (en()?'Search Google or type a URL':'ابحث في Google أو اكتب رابط');
}
function clearImg(){ aiImg=null; if(aiThumbURL){ URL.revokeObjectURL(aiThumbURL); aiThumbURL=null; } $('thumb').hidden=true; $('search').classList.remove('hasImg'); updPh(); }
function attach(f){ clearImg(); aiImg=f; aiThumbURL=URL.createObjectURL(f); $('thumbImg').src=aiThumbURL; $('thumb').hidden=false; $('search').classList.add('hasImg'); updPh(); }
function setAI(on){
  aiMode=on; if(!on) clearImg(); $('search').classList.toggle('ai',on); updPh(); sugSel=-1;
  $('q').focus(); loadRecent().then(updateSug);
}
async function toPng(f){ if(f.type==='image/png') return f; const bm=await createImageBitmap(f); const c=document.createElement('canvas'); c.width=bm.width; c.height=bm.height; c.getContext('2d').drawImage(bm,0,0); return new Promise(r=>c.toBlob(r,'image/png')); }
/* destination of the AI button: Gemini or Google AI Mode (only Google AI Mode can carry typed text in the link) */
const aiUrl=t=> S.aiDest==='gemini' ? 'https://gemini.google.com/app'
  : (t ? 'https://www.google.com/search?udm=50&q='+encodeURIComponent(t) : 'https://www.google.com/ai');
async function runAI(t,fromBtn){
  t=(t||'').trim();
  if(aiImg){ /* a link can't carry an image: copy it, open the AI page, then you press Ctrl+V there */
    try{ const png=await toPng(aiImg); await navigator.clipboard.write([new ClipboardItem({'image/png':png})]); }catch(e){}
    location.href=aiUrl(''); return;
  }
  /* Enter / Ctrl+Enter with text always searches Google AI Mode; the button itself goes to the chosen destination */
  location.href = (!fromBtn && t) ? 'https://www.google.com/search?udm=50&q='+encodeURIComponent(t) : aiUrl(t);
}
function go(t){
  t=(t||'').trim();
  if (aiMode||aiImg) return runAI(t);
  if (!t) return;
  if (looksUrl(t)) { location.href = /^https?:/i.test(t) ? t : 'https://'+t; return; }
  /* always Google, never the browser's default engine (which can change by itself) */
  location.href='https://www.google.com/search?q='+encodeURIComponent(t);
}
$('search').onsubmit = e => { e.preventDefault(); go($('q').value); };
/* AI Mode = Google AI Mode (udm=50). Works with or without text */
$('ai').addEventListener('mousedown',e=>e.preventDefault());
$('ai').onclick = () => runAI($('q').value,true);
$('thumbX').onclick = () => { clearImg(); setAI(false); };
$('q').addEventListener('paste',e=>{
  const its=(e.clipboardData&&e.clipboardData.items)||[];
  for(const it of its){ if(it.type&&it.type.startsWith('image/')){ const f=it.getAsFile(); if(f){ e.preventDefault(); attach(f); if(!aiMode) setAI(true); return; } } }
});
$('q').addEventListener('keydown', e => { if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); runAI($('q').value); } });

/* ---- suggestions: your previous Google searches (browser history) + live Google suggestions ---- */
const sug=$('sug'); let sugItems=[], sugSel=-1, recent=[], recentAI=[], sugSeq=0, sugTimer=0;
/* a history entry -> {q, ai}: ai=true when it is an AI Mode conversation (udm=50), otherwise a normal search */
const parseG=it=>{ try{ const x=new URL(it.url); if(!/(^|\.)google\.[a-z.]+$/i.test(x.hostname)||x.pathname!=='/search') return null;
  const ai=x.searchParams.get('udm')==='50'; let q=(x.searchParams.get('q')||'').trim();
  if(!q&&ai) q=(it.title||'').replace(/^\s*(Google Search|بحث Google)\s*[-–—]\s*/i,'').replace(/\s*[-–—]\s*(Google Search|بحث Google)\s*$/i,'').trim();
  if(!q||/^(Google Search|بحث Google)$/i.test(q)) return null; return {q,ai}; }catch(e){ return null; } };
const pool=()=>aiMode?recentAI:recent;
async function loadRecent(){
  try{
    const a=await zeus.searchHistory('google.',900), b=[];
    const sS=new Set(), sA=new Set(); recent=[]; recentAI=[];
    for(const it of [...a,...b].sort((x,y)=>(y.lastVisitTime||0)-(x.lastVisitTime||0))){
      const p=parseG(it); if(!p) continue; const L=p.ai?recentAI:recent, SS=p.ai?sA:sS, k=p.q.toLowerCase();
      if(SS.has(k)||L.length>=40) continue; SS.add(k); L.push(p.q);
    }
  }catch(e){ recent=[]; recentAI=[]; }
}
async function fetchSug(q){
  try{ return (await zeus.suggest(q,en()?'en':'ar'))||[]; }catch(e){ return []; }
}
function renderSug(){
  sug.innerHTML='';
  if(!sugItems.length){ sug.hidden=true; return; }
  sugItems.forEach((it,i)=>{
    const d=document.createElement('div'); d.className='sg'+(i===sugSel?' on':'');
    const ic=document.createElement('i'); ic.textContent=it.h?(aiMode?'\u2726':'\u27F2'):'\u2315';
    const t=document.createElement('span'); t.textContent=it.t; d.append(ic,t);
    d.onmousedown=e=>{ e.preventDefault(); go(it.t); };
    sug.appendChild(d);
  });
  sug.hidden=false;
}
async function updateSug(){
  const q=$('q').value.trim(), my=++sugSeq;
  if(!q){ sugItems=pool().slice(0,8).map(t=>({t,h:1})); sugSel=-1; renderSug(); return; }
  const lq=q.toLowerCase();
  const hist=pool().filter(t=>t.toLowerCase().includes(lq)&&t.toLowerCase()!==lq).slice(0,3).map(t=>({t,h:1}));
  sugItems=hist; sugSel=-1; renderSug();
  const live=await fetchSug(q); if(my!==sugSeq) return;
  const have=new Set(hist.map(x=>x.t.toLowerCase()));
  sugItems=hist.concat(live.filter(t=>!have.has(t.toLowerCase())).slice(0,7).map(t=>({t,h:0})));
  sugSel=-1; renderSug();
}
$('q').addEventListener('focus',()=>{ loadRecent().then(updateSug); });
$('q').addEventListener('click',()=>{ if(sug.hidden) loadRecent().then(updateSug); });
$('q').addEventListener('input',()=>{ clearTimeout(sugTimer); sugTimer=setTimeout(updateSug,60); });
$('q').addEventListener('blur',()=>{ sug.hidden=true; });
$('q').addEventListener('keydown',e=>{
  if(e.key==='Escape'){ sug.hidden=true; return; }
  if(!sugItems.length||sug.hidden) return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault(); const n=sugItems.length;
    sugSel=e.key==='ArrowDown'?(sugSel+1)%n:(sugSel<=0?n-1:sugSel-1); renderSug();
  } else if(e.key==='Enter'&&!e.ctrlKey&&!e.metaKey&&sugSel>=0){ e.preventDefault(); go(sugItems[sugSel].t); }
});

function tick(){const d=new Date(),p=n=>String(n).padStart(2,'0');let h=d.getHours();if(!S.h24)h=h%12||12;
  $('clock').textContent=(S.h24?p(h):h)+':'+p(d.getMinutes());
  $('date').textContent=d.toLocaleDateString(en()?'en-GB':'ar-SA-u-ca-gregory-nu-latn',{weekday:'long',day:'numeric',month:'long'});}
setInterval(tick,1000); tick();

/* ---- storage for uploaded media + font ---- */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('ntp',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
async function put(key,f){const d=await idb();return new Promise(r=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(f,key);t.oncomplete=r;});}
async function get(key){const d=await idb();return new Promise(r=>{const q=d.transaction('f').objectStore('f').get(key);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});}

/* ---- background media (uploaded or the built-in anime video) ---- */
const bgi=$('bgi'),bgv=$('bgv'),box=$('tiles');
box.addEventListener('wheel',e=>{box.scrollLeft-=e.deltaY;},{passive:true});
let shownMedia=null,mediaURL,lastSrc=null;
function playVideo(src){ bgi.style.display='none'; bgv.src=src; bgv.style.display='block'; bgv.play().catch(()=>{}); }
async function showMedia(kind){
  if(kind==='anime'){ playVideo('media/anime.mp4'); return; }
  const b=await get('bg'); if(!b) return;
  if(mediaURL) URL.revokeObjectURL(mediaURL); mediaURL=URL.createObjectURL(b);
  if(b.type.startsWith('video')) playVideo(mediaURL);
  else{bgv.pause();bgv.removeAttribute('src');bgv.style.display='none';bgi.src=mediaURL;bgi.style.display='block';}
}

/* ---- fonts ---- */
let userFontLoaded=false;
async function loadUserFont(){
  if(userFontLoaded) return; const b=await get('font'); if(!b) return;
  try{ const ff=new FontFace('ZeusUserFont',await b.arrayBuffer()); await ff.load(); document.fonts.add(ff); userFontLoaded=true; }catch(e){ console.warn('font',e); }
}
const fontCss=k=>{ if(k==='sys') return S.fontName?`"${S.fontName.replace(/"/g,'')}",system-ui,sans-serif`:FONTS.def.css; return (FONTS[k]||FONTS.def).css; };
/* Google fonts: one <link> per font, injected only when used (or when a font menu is opened, to preview them) */
const gLoaded=new Set();
function loadG(k){ const f=FONTS[k]; if(!f||!f.g||gLoaded.has(k)) return; gLoaded.add(k);
  const l=document.createElement('link'); l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family='+f.g+'&display=swap'; document.head.appendChild(l); }
document.querySelectorAll('.fontSel').forEach(sel=>{ const all=()=>Object.keys(FONTS).forEach(loadG); sel.addEventListener('mousedown',all); sel.addEventListener('focus',all); });
function buildFontSelects(){
  document.querySelectorAll('.fontSel').forEach(sel=>{ const v=S[sel.id]; sel.innerHTML='';
    for(const k in FONTS){ const o=document.createElement('option'); o.value=k; o.textContent=FONTS[k][en()?'en':'ar']; if(k!=='sys'&&k!=='mine') o.style.fontFamily=FONTS[k].css; sel.appendChild(o); }
    sel.value=v; });
}
function applyFonts(){
  if(S.clockFont==='mine'||S.dateFont==='mine') loadUserFont();
  loadG(S.clockFont); loadG(S.dateFont);
  const R=document.documentElement.style;
  const w=k=>(FONTS[k]&&FONTS[k].w)||'';
  R.setProperty('--clockW',w(S.clockFont)); R.setProperty('--dateW',w(S.dateFont));
  R.setProperty('--clockFont',fontCss(S.clockFont)); R.setProperty('--dateFont',fontCss(S.dateFont));
  document.body.classList.toggle('plainClock',S.clockFont!=='def');
}

/* ---- shortcuts ---- */
const norm=u=>{ try{ const x=new URL(u); return x.origin+x.pathname.replace(/\/$/,'')+x.search; }catch(e){ return u; } };
const isHidden=u=>S.hidden.includes(norm(u));
const fav=u=>'https://www.google.com/s2/favicons?sz=64&domain_url='+encodeURIComponent(u);
function hideUrl(u){ const n=norm(u); const i=S.mine.findIndex(m=>norm(m.url)===n);
  if(i>=0) S.mine.splice(i,1); else if(!S.hidden.includes(n)) S.hidden.push(n);
  save(); loadTiles(); }
function tile(title,url,fn,glyph,removable){
  const a=document.createElement('a'); a.className='tile'; a.href=url||'#';
  const i=document.createElement('i');
  if(url){const im=document.createElement('img');im.src=fav(url);im.alt='';im.draggable=false;
    /* icon could not load (offline, blocked): show the site's first letter instead */
    im.onerror=()=>{ let h=''; try{ h=new URL(url).hostname.replace(/^www\./,''); }catch(e){} i.textContent=(title||h||'?').trim().charAt(0).toUpperCase(); i.classList.add('letter'); };
    i.appendChild(im);} else i.textContent=glyph;
  /* drag-to-reorder: every real shortcut / folder has a key; the "Back" tile has none and stays first */
  const key=url?norm(url):(glyph==='📁'?'f:'+title:''); if(key){ a.dataset.key=key; a.draggable=true; }
  const sp=document.createElement('span'); sp.textContent=title||url; a.title=(title||'')+(url?'\n'+url:''); a.append(i,sp);
  if(fn) a.onclick=e=>{e.preventDefault();fn();};
  /* small hover X to remove a shortcut from the bar (the bookmark itself is untouched) */
  if(url&&removable!==false){ const x=document.createElement('b'); x.className='x'; x.textContent='✕'; x.title=en()?'Remove':'حذف'; x.draggable=false;
    x.onclick=e=>{e.preventDefault();e.stopPropagation();hideUrl(url);}; a.appendChild(x); }
  return a;
}
/* apply the saved order (S.order = list of keys). Keys not in the list keep their natural order after the known ones */
function orderTiles(){
  const idx=k=>{ const i=S.order.indexOf(k); return i<0?1e9:i; };
  const els=[...box.children], fixed=els.filter(e=>!e.dataset.key), mv=els.filter(e=>e.dataset.key);
  mv.sort((a,b)=>idx(a.dataset.key)-idx(b.dataset.key));
  box.replaceChildren(...fixed,...mv);
}
let dragEl=null;
box.addEventListener('dragstart',e=>{
  const t=e.target.closest&&e.target.closest('.tile');
  if(!t||!t.dataset.key){ e.preventDefault(); return; }
  dragEl=t; e.dataTransfer.effectAllowed='move'; try{ e.dataTransfer.setData('text/plain',t.dataset.key); }catch(err){}
  setTimeout(()=>t.classList.add('drag'),0);
});
box.addEventListener('dragover',e=>{
  if(!dragEl) return; e.preventDefault(); e.dataTransfer.dropEffect='move';
  const t=e.target.closest&&e.target.closest('.tile'); if(!t||t===dragEl||!t.dataset.key) return;
  const r=t.getBoundingClientRect(), rtl=getComputedStyle(box).direction==='rtl', mid=r.left+r.width/2;
  const before=rtl?e.clientX>mid:e.clientX<mid;
  box.insertBefore(dragEl,before?t:t.nextSibling);
});
box.addEventListener('dragend',()=>{
  if(!dragEl) return; dragEl.classList.remove('drag'); dragEl=null;
  const vis=[...box.querySelectorAll('.tile[data-key]')].map(t=>t.dataset.key);
  S.order=vis.concat(S.order.filter(k=>!vis.includes(k))); save();
});
/* never let a dropped tile navigate the page */
document.addEventListener('dragover',e=>{ if(dragEl) e.preventDefault(); });
document.addEventListener('drop',e=>{ if(dragEl) e.preventDefault(); });
let bmNode=null,bmStack=[];
function showBM(node,stack){
  bmNode=node; bmStack=stack; box.innerHTML='';
  if(stack.length) box.append(tile(en()?'Back':'رجوع',null,()=>showBM(stack[stack.length-1],stack.slice(0,-1)),'↩'));
  else S.mine.forEach(m=>box.append(tile(m.title,m.url)));
  let n=0;
  for(const c of (node.children||[])){ if(n>=S.maxTiles) break;
    if(c.url){ if(isHidden(c.url)) continue; box.append(tile(c.title,c.url)); n++; }
    else { box.append(tile(c.title,null,()=>showBM(c,[...stack,node]),'📁')); n++; } }
  orderTiles();
}
async function sourceList(){
  try{
    if(S.src==='bm'){ const bar=await zeus.getBookmarks();
      return {node:bar,list:(bar.children||[]).filter(c=>c.url).map(c=>({title:c.title,url:c.url}))}; }
  }catch(e){}
  return [];
}
/* renderTiles = cheap (no browser calls, no panel list): used while dragging the count slider */
let srcCache=null, tseq=0;
function syncCount(r){ const el=$('maxTiles'); const total=r&&r.node?(r.node.children||[]).length:(Array.isArray(r)?r.length:0);
  el.max=Math.max(1,total); el.value=Math.min(S.maxTiles,+el.max); }
function renderTiles(r){
  box.innerHTML='';
  if(S.src==='bm'&&r.node){ showBM(r.node,[]); return; }
  const list=Array.isArray(r)?r:[];
  S.mine.forEach(m=>box.append(tile(m.title,m.url)));
  list.filter(x=>!isHidden(x.url)).slice(0,S.maxTiles).forEach(x=>box.append(tile(x.title,x.url)));
  orderTiles();
}
async function loadTiles(){
  const my=++tseq; box.innerHTML=''; buildList([]); srcCache=null;
  if(S.src==='off') return;
  const r=await sourceList(); if(my!==tseq) return;
  srcCache=r; syncCount(r); renderTiles(r);
  buildList(S.src==='bm'&&r.node?r.list:(Array.isArray(r)?r:[]));
}
/* the old shortcut manager list is gone; only the 'restore removed' button remains */
function buildList(){
  const b=$('scRestore'); if(!b) return;
  b.textContent=(en()?'Restore removed':'إرجاع المحذوفة')+' ('+S.hidden.length+')'; b.disabled=!S.hidden.length;
}
$('scRestore').onclick=()=>{ S.hidden=[]; save(); loadTiles(); };

function extraApply(){
  const R=document.documentElement.style;
  R.setProperty('--clock',S.clock+'px'); R.setProperty('--date',S.dateSize+'px'); R.setProperty('--tile',S.tileSize+'px'); R.setProperty('--shiftX',S.shiftX+'px');
  $('shiftX').value=S.shiftX; $('clockOp').value=S.clockOp; $('dateOp').value=S.dateOp;
  $('clockSize').value=S.clock; $('dateSize').value=S.dateSize; $('lang').value=S.lang; $('dateOn').checked=S.dateOn;
  $('date').style.display=S.dateOn?'':'none'; $('h24').checked=S.h24; $('dimR').value=S.dim; $('src').value=S.src;
  $('maxTiles').value=S.maxTiles; $('tileSize').value=S.tileSize; $('names').checked=S.names; $('fontName').value=S.fontName; $('aiDest').value=S.aiDest;
  box.classList.toggle('names',S.names);
  setLang(); buildFontSelects(); applyFonts();
  const kind=S.theme==='media'?'media':S.theme==='anime'?'anime':null;
  $('bgm').style.display=kind?'block':'none'; $('dim').style.opacity=(kind==='anime'?Math.min(S.dim,60):S.dim)/100;
  if(kind&&shownMedia!==kind){ shownMedia=kind; showMedia(kind); }
  if(!kind&&shownMedia){ shownMedia=null; bgv.pause(); }
  if(S.src!==lastSrc){ lastSrc=S.src; loadTiles(); }
}
/* sliders: only touch what changed (one update per frame, save a moment later) instead of rebuilding the whole page */
let _saveT=0; const saveSoon=()=>{ clearTimeout(_saveT); _saveT=setTimeout(save,250); };
addEventListener('pagehide',save); document.addEventListener('visibilitychange',()=>{ if(document.hidden) save(); });
const perFrame=fn=>{ let r=0; return ()=>{ if(r) return; r=requestAnimationFrame(()=>{ r=0; fn(); }); }; };
function cssVars(){
  const R=document.documentElement.style;
  R.setProperty('--clock',S.clock+'px'); R.setProperty('--date',S.dateSize+'px'); R.setProperty('--tile',S.tileSize+'px'); R.setProperty('--shiftX',S.shiftX+'px');
  R.setProperty('--clockOp',S.clockOp/100); R.setProperty('--dateOp',S.dateOp/100);
  const kind=S.theme==='media'?'media':S.theme==='anime'?'anime':null;
  $('dim').style.opacity=(kind==='anime'?Math.min(S.dim,60):S.dim)/100;
}
const cssVarsF=perFrame(cssVars), tilesF=perFrame(()=>{ if(srcCache&&S.src!=='off') renderTiles(srcCache); else loadTiles(); }), initF=perFrame(init);
$('clockSize').oninput=e=>{S.clock=+e.target.value;cssVarsF();saveSoon();};
$('dateSize').oninput=e=>{S.dateSize=+e.target.value;cssVarsF();saveSoon();};
$('shiftX').oninput=e=>{S.shiftX=+e.target.value;cssVarsF();saveSoon();};
$('clockFont').onchange=e=>{S.clockFont=e.target.value;apply();};
$('dateFont').onchange=e=>{S.dateFont=e.target.value;apply();};
$('fontName').onchange=e=>{S.fontName=e.target.value.trim(); if(S.fontName){ if(S.clockFont!=='sys'&&S.dateFont!=='sys'){S.clockFont='sys';S.dateFont='sys';} } apply();};
$('fontFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;await put('font',f);userFontLoaded=false;
  try{ document.fonts.forEach(ff=>{ if(ff.family==='ZeusUserFont') document.fonts.delete(ff); }); }catch(err){}
  S.clockFont='mine';S.dateFont='mine';apply();};
$('h24').onchange=e=>{S.h24=e.target.checked;apply();tick();};
$('clockOp').oninput=e=>{S.clockOp=+e.target.value;cssVarsF();saveSoon();};
$('dateOp').oninput=e=>{S.dateOp=+e.target.value;cssVarsF();saveSoon();};
$('dimR').oninput=e=>{S.dim=+e.target.value;cssVarsF();saveSoon();};
$('src').onchange=e=>{S.src=e.target.value;apply();};
$('aiDest').onchange=e=>{S.aiDest=e.target.value;apply();};
$('maxTiles').oninput=e=>{S.maxTiles=(+e.target.value>=+e.target.max)?999:+e.target.value;tilesF();saveSoon();};
$('tileSize').oninput=e=>{S.tileSize=+e.target.value;cssVarsF();saveSoon();};
$('names').onchange=e=>{S.names=e.target.checked;apply();};
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;await put('bg',f);S.theme='media';shownMedia=null;apply();};

const EN={'الثيم':'Theme','⬆ ارفع صورة أو فيديو متحرك':'⬆ Upload animated image / video','تعتيم الصورة':'Background dim','عدد النجوم / الكثافة':'Stars / density','السرعة':'Speed','حجم الساعة':'Clock size','لون التمييز':'Accent color','لون الخلفية (لون مخصص)':'Background (custom color)','الاختصارات':'Shortcuts','الأكثر زيارة':'Most visited','شريط المفضلة':'Bookmarks bar','إخفاء':'Hidden','إظهار الساعة':'Show clock','إظهار التاريخ':'Show date','نظام 24 ساعة':'24-hour clock','إظهار البحث':'Show search','إعادة الضبط':'Reset',
 'الساعة والتاريخ':'Clock & date','حجم التاريخ':'Date size','شفافية الساعة':'Clock opacity','شفافية التاريخ':'Date opacity','إزاحة أفقية (محاذاة مع البار العلوي)':'Horizontal offset (align with top bar)','خط الساعة':'Clock font','خط التاريخ':'Date font','⬆ ارفع خطك (TTF / OTF / WOFF)':'⬆ Upload your font (TTF / OTF / WOFF)','أو اكتب اسم خط من جهازك':'Or type a font installed on your PC',
 'المصدر':'Source','اختصاراتي فقط':'My shortcuts only','عدد الاختصارات':'Number of shortcuts','حجم الأيقونات':'Icon size','إظهار الأسماء':'Show names',
 'وجهة زر AI':'AI button goes to','جمناي (Gemini)':'Gemini','وضع AI من Google':'Google AI Mode',
 'فعّل أو ألغِ أي اختصار من القائمة، أو مرّر الماوس على الأيقونة واضغط ✕ لحذفها. اسحب الأيقونات في الشريط العلوي لترتيبها.':'Tick or untick any shortcut in the list, or hover an icon and press ✕ to remove it. Drag the icons in the top bar to reorder them.'};
function setLang(){
  const w=document.createTreeWalker($('panel'),NodeFilter.SHOW_TEXT);
  for(let n;n=w.nextNode();){ if(n.parentNode.closest('#themes,.fontSel,#scRestore'))continue; if(!n.nodeValue.trim())continue; if(n._ar===undefined)n._ar=n.nodeValue; const a=n._ar.trim(); n.nodeValue=en()?n._ar.replace(a,EN[a]||a):n._ar; }
  $('panel').dir=en()?'ltr':'rtl'; updPh();
  const gem=S.aiDest==='gemini';
  $('ai').textContent=gem?'✦ Gemini':(en()?'✦ AI Mode':'✦ وضع AI');
  $('ai').title=gem?(en()?'Open Gemini':'افتح Gemini'):(en()?'Google AI Mode (Ctrl+Enter)':'وضع AI من Google (Ctrl+Enter)');
  $('fontName').placeholder='Segoe UI';
  document.documentElement.lang=S.lang; document.documentElement.dir=en()?'ltr':'rtl'; tick();
}
function fs(){}
addEventListener('resize',fs);
$('lang').onchange=e=>{S.lang=e.target.value;try{zeus.setLang(S.lang);}catch(err){}apply();if(S.src!=='off')loadTiles();};
/* the browser keeps one language for the toolbar and this page */
try{ zeus.onLang(l=>{ if(l!==S.lang){ S.lang=l; apply(); } }); }catch(e){}
$('dateOn').onchange=e=>{S.dateOn=e.target.checked;apply();};

resize(); apply();
try{ zeus.getLang().then(l=>{ if(l&&l!==S.lang){ S.lang=l; apply(); } }); }catch(e){}
/* the new tab gets a fresh page each time; refresh shortcuts when you come back to it */
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&S.src!=='off') loadTiles(); });
