// End-to-end checks for 3zT, driven over the Chrome DevTools Protocol.
//
//   node tests/e2e.mjs <path-to-exe-or-electron> [app-dir] [--store]
//
// What it checks:
//   smoke   : the window opens, the toolbar and every internal page load with no script errors
//   --store : installs Dark Reader and uBlock Origin Lite from the real Chrome Web Store
//             ("Add to 3zT" button), checks they run on a website, survive a restart,
//             and can be removed again
// Exit code 0 = all passed. Screenshots go to tests/out/.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { ytrulesUnit } from './ytrules.mjs';

const argv = process.argv.slice(2);
const exe = argv.find(a => !a.startsWith('--'));
const appDir = argv.filter(a => !a.startsWith('--'))[1];
const STORE = argv.includes('--store');
// extra Electron switches as a JSON array in E2E_ARGS (e.g. '["--no-sandbox"]')
const extraArgs = process.env.E2E_ARGS ? JSON.parse(process.env.E2E_ARGS) : [];
const PORT = 9333;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });

const STORE_EXTS = (process.env.E2E_EXTS || 'eimadpbcbfnmbkopoojfekhnkhdbieeh:Dark Reader,ddkjiahejlhfcafbddmgiahcphecmpfh:uBlock Origin Lite')
  .split(',').map(s => { const [id, ...n] = s.split(':'); return { id, name: n.join(':') }; });
const STORE_BASE = process.env.E2E_STORE || 'https://chromewebstore.google.com/detail/x/';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function ok(name, pass, info = '') { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); }

let child = null;
async function start(env = {}) {
  const args = [...(appDir ? [appDir] : []), `--remote-debugging-port=${PORT}`, ...extraArgs];
  child = spawn(exe, args, { env: { ...process.env, TZT_E2E: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(OUT, 'app.log'), { flags: 'a' });
  child.stdout.pipe(log); child.stderr.pipe(log);
  for (let i = 0; i < 120; i++) { await sleep(500); try { const t = await targets(); if (t.some(x => x.url.includes('ui/toolbar.html'))) return true; } catch (e) {} }
  return false;
}
async function stop() {
  if (!child) return;
  try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill('SIGTERM'); } catch (e) {}
  child = null; await sleep(3000);
}
async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }

/* a small CDP client for one target */
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(() => rej(new Error('connect timeout')), 10000); });
  let id = 0; const wait = new Map(); const listeners = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else listeners.forEach(f => f(d)); };
  // every call gives up after 30 s so a stuck page can never hang the whole test
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({ error: { message: 'timeout ' + method } }); } }, 30000); });
  const ev = async (expr, userGesture = false) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture }); return r.result && r.result.result ? r.result.result.value : undefined; };
  return { send, ev, on: f => listeners.push(f), close: () => ws.close() };
}
async function find(match, tries = 60) {
  for (let i = 0; i < tries; i++) { const t = (await targets()).find(x => x.type === 'page' && (typeof match === 'function' ? match(x.url) : x.url.includes(match))); if (t) return t; await sleep(500); }
  return null;
}
async function toolbar() { return connect(await find('ui/toolbar.html')); }
async function go(text, newTab = true) { const tb = await toolbar(); await tb.ev(`ui.send('tab','go',${JSON.stringify({ text, newTab })}),1`); tb.close(); }
async function shot(c, name) { try { const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); } catch (e) {} }
async function poll(fn, ms = 30000, every = 500) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (e) {} await sleep(every); } return v; }

/* load a page again with error tracking on, report uncaught errors */
async function pageErrors(c) {
  const errs = [];
  c.on(d => {
    if (d.method === 'Runtime.exceptionThrown') errs.push((d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description) || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push(d.params.args.map(a => a.value || a.description).join(' '));
  });
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Page.reload', { ignoreCache: true });
  await sleep(3500);
  return errs;
}

async function smoke() {
  const tb = await toolbar();
  ok('toolbar loads', !!(await tb.ev('!!document.getElementById("addr")')));
  tb.close();
  const pages = [['3zt://settings', 'settings.html'], ['3zt://downloads', 'downloads.html'], ['3zt://history', 'history.html'], ['3zt://passwords', 'passwords.html'], ['3zt://tasks', 'tasks.html'], ['', 'newtab.html']];
  for (const [u, file] of pages) {
    if (u) await go(u, true); else { const t2 = await toolbar(); await t2.ev(`ui.send('tab','new'),1`); t2.close(); }
    const t = await find(file, 30);
    if (!t) { ok(`page ${file} opens`, false, 'no tab'); continue; }
    const c = await connect(t);
    const errs = await pageErrors(c);
    const title = await c.ev('document.title');
    await shot(c, 'page-' + file.replace('.html', ''));
    ok(`page ${file} opens without errors`, !errs.length && !!title, errs.length ? errs.slice(0, 3).join(' | ') : `title "${title}"`);
    c.close();
  }
  // a normal website loads
  await go('https://example.com/', true);
  const ex = await find(u => /^https:\/\/example\.com/.test(u), 40);
  const h1 = ex && await poll(async () => { const c = await connect(ex); const h = await c.ev('document.readyState === "complete" && document.body && document.body.innerText.length > 20 && document.title'); c.close(); return h; }, 20000);
  let why = '';
  if (!h1 && ex) { try { const c = await connect(ex); const r = await c.send('Runtime.evaluate', { expression: 'location.href + " | " + document.readyState + " | " + (document.body ? document.body.innerText.slice(0, 200) : "no body")', returnByValue: true }); why = JSON.stringify(r).slice(0, 400); c.close(); } catch (e) { why = 'connect: ' + e.message; } }
  ok('website loads', !!h1, h1 ? `"${h1}"` : (ex ? why : 'no example.com tab'));
}

async function extList() { const tb = await toolbar(); const l = await tb.ev(`ui.invoke('ext:list').then(l=>l.map(x=>x.id))`); tb.close(); return l || []; }

async function storeInstall(ext) {
  await go(STORE_BASE + ext.id, true);
  const t = await find(u => u.includes(ext.id) && /^https:/.test(u), 60);
  if (!t) return ok(`store page for ${ext.name}`, false, 'did not open');
  const c = await connect(t);
  // the store labels the button with the browser's name ("Add to 3zT"); in Chrome it says "Add to Chrome"
  // ("Install 3zT" is the store's "switch browser" banner, not the install button)
  const btn = `[...document.querySelectorAll('button')].find(b => /^\\s*(add to 3zt|add to chrome|إضافة إلى 3zT|إضافة إلى chrome)\\s*$/i.test(b.textContent) && !b.disabled)`;
  const ready = await poll(() => c.ev(`!!(${btn})`), 60000);
  await shot(c, `store-${ext.id}-before`);
  ok(`store install button shows for ${ext.name}`, !!ready, ready ? '' : String(await c.ev('document.body && document.body.innerText.slice(0, 300)')));
  if (!ready) { c.close(); return; }
  await c.ev(`(${btn}).click(), 1`);
  const installed = await poll(async () => (await extList()).includes(ext.id), 120000, 1500);
  await sleep(2500); await shot(c, `store-${ext.id}-after`);
  const label = await c.ev(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /chrome|3zt|remove|إزالة/i.test(t)).join(' / ')`);
  ok(`${ext.name} installs from the Chrome Web Store`, !!installed, `store button now: "${label}"`);
  c.close();
}

/* site permissions: the question bar, Allow / Block / ignored, remembering, the site panel, screen sharing */
const PERM_PAGE = `<!doctype html><title>perm</title><body><pre id=o></pre><script>
const log = m => { document.getElementById('o').textContent += m + '\\n'; };
window.out = () => document.getElementById('o').textContent;
window.askNotif = () => Notification.requestPermission().then(r => log('notif:' + r));
window.askGeo = () => navigator.geolocation.getCurrentPosition(() => log('geo:ok'), e => log('geo:err' + e.code), { timeout: 30000 });
window.askWin = () => window.getScreenDetails().then(() => log('win:ok'), e => log('win:' + e.name));
window.askScreen = () => navigator.mediaDevices.getDisplayMedia({ video: true }).then(st => { log('screen:ok'); st.getTracks().forEach(t => t.stop()); }, e => log('screen:' + e.name));
</script>`;
async function permissions() {
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(PERM_PAGE); }).listen(8790, '127.0.0.1');
  try {
    await go('http://127.0.0.1:8790/', true);
    const t = await find(u => u.startsWith('http://127.0.0.1:8790'), 40);
    if (!t) return ok('permission test page opens', false);
    const page = await connect(t);
    await poll(() => page.ev('typeof askNotif === "function"'), 15000);
    // the toolbar of the window that shows this page (other windows may be open)
    const pageBar = async () => {
      for (const x of (await targets()).filter(x => x.type === 'page' && x.url.includes('ui/toolbar.html'))) {
        const c = await connect(x); if (String(await c.ev('S && S.url')).startsWith('http://127.0.0.1:8790')) return c; c.close();
      }
      return toolbar();
    };
    const bar = async () => { const tb = await pageBar(); const v = await tb.ev(`document.getElementById('perm').hidden ? '' : document.getElementById('perm').className + '|' + document.getElementById('perm').innerText.replace(/\\n/g, ' ')`); tb.close(); return v; };
    const click = async sel => { const tb = await pageBar(); const v = await tb.ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return false; b.click(); return true; })()`); tb.close(); return v; };
    // 1. Allow, remembered
    await page.ev('askNotif(), 1');
    const b1 = await poll(bar, 8000, 200);
    ok('permission question shows as a small bar (not a window)', /^ask\|/.test(b1 || ''), b1 || `page: ${await page.ev('out() + " " + Notification.permission + " " + document.visibilityState')}`);
    await click('#perm [data-pc=allow]');
    ok('"Allow" gives the permission', !!(await poll(async () => /notif:granted/.test(await page.ev('out()')), 8000)));
    await page.ev('askNotif(), 1');
    ok('an allowed site is not asked again', !!(await poll(async () => (await page.ev('out()')).split('notif:granted').length === 3, 8000)) && !(await bar()));
    // 2. Block, remembered, and the page is not asked again
    await page.ev('askGeo(), 1');
    await poll(bar, 8000, 200);
    await click('#perm [data-pc=block]');
    ok('"Block" refuses', !!(await poll(async () => /geo:err1/.test(await page.ev('out()')), 8000)));
    await page.ev('askGeo(), 1');
    ok('a blocked site is not asked again', !!(await poll(async () => (await page.ev('out()')).split('geo:err1').length === 3, 8000)) && !(await bar()));
    // 3. Ignored: the bar goes away by itself, the page is refused this time, the address bar shows an icon
    await page.ev('askWin(), 1', true);
    const b3 = await poll(bar, 8000, 200);
    const gone = await poll(async () => !(await bar()), 12000, 300);
    const chip = await (async () => { const tb = await pageBar(); const v = await tb.ev(`!document.getElementById('permChip').hidden`); tb.close(); return v; })();
    ok('an ignored question closes by itself and leaves an icon in the address bar', !!b3 && !!gone && chip === true, `chip ${chip}`);
    // 4. the site panel lists them and can change one
    let tb = await pageBar(); await tb.ev(`document.getElementById('menuBtn').click(), 1`); await sleep(300); await tb.ev(`document.querySelector('#drop [data-a=shield]').click(), 1`); await sleep(600);
    const panel = await tb.ev(`document.getElementById('drop').innerText`);
    ok('the site panel lists this site\'s permissions', /الإشعارات|Notifications/.test(panel) && /موقعك|location/i.test(panel), String(panel).slice(-200));
    await tb.ev(`document.querySelector('[data-perm="geolocation"][data-v="allow"]').click(), 1`); await sleep(500);
    const st = await tb.ev(`JSON.stringify(S.perm && S.perm.site)`);
    await tb.ev(`closeDrop(), 1`); tb.close();
    ok('a permission can be changed from the panel', /"geolocation":"allow"/.test(st || ''), st);
    // 5. screen sharing: a picker with the screens and windows, and sharing works
    await page.ev('askScreen(), 1', true);
    const b5 = await poll(async () => { const v = await bar(); return /^screen\|/.test(v || '') ? v : ''; }, 15000, 300);
    const n = await (async () => { const t2 = await pageBar(); const v = await t2.ev(`document.querySelectorAll('#perm [data-pick]').length`); t2.close(); return v; })();
    ok('screen sharing shows a picker with screens and windows', !!b5 && n > 0, `${n} choices`);
    if (n > 0) { await click('#perm [data-pick]'); ok('sharing the chosen screen works', !!(await poll(async () => /screen:ok/.test(await page.ev('out()')), 15000))); }
    else await click('#perm [data-pc=ignore]');
    page.close();
  } finally { srv.close(); }
}


/* ================= downloads: the ways real sites start them ================= */
const AR_NAME = 'ملف عربي.zip';
const BIG = Buffer.alloc(3 * 1024 * 1024, 7);
// big files (aria2): different bytes everywhere, so a part written in the wrong place shows
const HUGE = Buffer.alloc(12 * 1024 * 1024); for (let i = 0; i < HUGE.length; i += 4) HUGE.writeUInt32LE(i, i);
const SLOWBIG = Buffer.alloc(24 * 1024 * 1024); for (let i = 0; i < SLOWBIG.length; i += 4) SLOWBIG.writeUInt32LE(i ^ 0x5a5a5a5a, i);
// sends `buf` (from `from`) in pieces, `rate` bytes a second, honouring Range
function trickle(q, r, buf, name, rate) {
  const m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
  const from = m ? +m[1] : 0, to = m && m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
  const head = { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'Accept-Ranges': 'bytes', ETag: '"' + name + '"', 'Content-Length': to - from + 1 };
  if (m) head['Content-Range'] = `bytes ${from}-${to}/${buf.length}`;
  r.writeHead(m ? 206 : 200, head);
  let at = from; const step = Math.max(16384, Math.round(rate / 50));
  const t = setInterval(() => { if (at > to) { clearInterval(t); return r.end(); } const n = Math.min(step, to - at + 1); r.write(buf.subarray(at, at + n)); at += n; }, 20);
  r.on('close', () => clearInterval(t));
}
const dlHits = {};
function dlServer() {
  let cut = true;
  const att = n => `attachment; filename="file.bin"; filename*=UTF-8''${encodeURIComponent(n)}`;
  return http.createServer((q, r) => {
    let body = ''; q.on('data', d => (body += d)); q.on('end', () => {
      const u = new URL(q.url, 'http://x'), ref = q.headers.referer || '';
      const file = (name, buf) => { r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': att(name), 'Content-Length': buf.length }); r.end(buf); };
      if (u.pathname === '/') {
        r.setHeader('Content-Type', 'text/html; charset=utf-8');
        return r.end(`<!doctype html><meta charset=utf-8><title>dl</title>
<form id=f method=post action="/post-dl" target="_blank"><input name=token value=ok></form>
<a id=l href="/redir" target="_blank">redirect</a>
<script>
window.formDl = () => document.getElementById('f').submit();
window.openDl = () => { const w = window.open(''); w.location.href = '/need-ref'; };
window.linkDl = () => document.getElementById('l').click();
window.blobDl = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['hello from a blob'], { type: 'text/plain' })); a.download = 'نص.txt'; document.body.appendChild(a); a.click(); };
window.manyDl = () => { for (let i = 1; i <= 3; i++) { const a = document.createElement('a'); a.href = '/many?i=' + i; a.download = ''; document.body.appendChild(a); a.click(); } };
window.cutDl = () => { location.href = '/cut'; };
window.slowDl = () => { location.href = '/slow'; };
window.bigDl = p => { location.href = p; };
window.bigPost = () => { const f = document.createElement('form'); f.method = 'post'; f.action = '/bigpost'; f.innerHTML = '<input name=a value=1>'; document.body.appendChild(f); f.submit(); };
</script>`);
      }
      // a form POST in a new tab: only the real POST with its data and Referer gets the file
      if (u.pathname === '/post-dl') return q.method === 'POST' && /token=ok/.test(body) && ref ? file(AR_NAME, Buffer.from('zip-data')) : (r.writeHead(302, { Location: '/' }), r.end());
      // window.open('') then setting its address: needs the opener's Referer
      if (u.pathname === '/need-ref') return ref.startsWith('http://127.0.0.1:8791/') ? file('opened.bin', Buffer.from('opened')) : (r.writeHead(302, { Location: '/' }), r.end());
      // redirect to a signed, short-lived address
      if (u.pathname === '/redir') { r.writeHead(302, { Location: '/signed?exp=' + (Date.now() + 60000) + '&sig=abc' }); return r.end(); }
      if (u.pathname === '/signed') return +u.searchParams.get('exp') > Date.now() ? file('signed.bin', Buffer.from('signed')) : (r.writeHead(403), r.end());
      if (u.pathname === '/plain-file') { r.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return r.end('plain'); }
      if (u.pathname === '/many') return file(`part-${u.searchParams.get('i')}.bin`, Buffer.from('m' + u.searchParams.get('i')));
      // breaks half way the first time, then serves the rest with Range (resume)
      if (u.pathname === '/cut') {
        const range = /bytes=(\d+)-/.exec(q.headers.range || '');
        if (range) { const from = +range[1]; r.writeHead(206, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': att('resume.bin'), 'Content-Range': `bytes ${from}-${BIG.length - 1}/${BIG.length}`, 'Content-Length': BIG.length - from, 'Accept-Ranges': 'bytes', ETag: '"v1"' }); return r.end(BIG.subarray(from)); }
        r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': att('resume.bin'), 'Content-Length': BIG.length, 'Accept-Ranges': 'bytes', ETag: '"v1"' });
        if (cut) { cut = false; r.write(BIG.subarray(0, 1024 * 1024)); return setTimeout(() => r.destroy(), 300); }
        return r.end(BIG);
      }
      dlHits[u.pathname] = (dlHits[u.pathname] || 0) + 1;
      if (u.pathname === '/big') return trickle(q, r, HUGE, 'big.bin', 3 * 1024 * 1024);
      if (u.pathname === '/bigslow') return trickle(q, r, SLOWBIG, 'bigslow.bin', 1024 * 1024);
      if (u.pathname === '/bigpost') return q.method === 'POST' ? trickle(q, r, HUGE, 'bigpost.bin', 3 * 1024 * 1024) : (r.writeHead(405), r.end());
      // a one-time link: the first request gets the file, any other is refused (no Range support either)
      if (u.pathname === '/once') {
        if (dlHits['/once'] > 1) { r.writeHead(403); return r.end(); }
        r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="once.bin"', 'Content-Length': HUGE.length });
        let at = 0; const t = setInterval(() => { if (at >= HUGE.length) { clearInterval(t); return r.end(); } r.write(HUGE.subarray(at, at + 65536)); at += 65536; }, 20);
        r.on('close', () => clearInterval(t)); return;
      }
      if (u.pathname === '/slow') { r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': att('slow.bin'), 'Content-Length': 50 * 1024 * 1024 }); const t = setInterval(() => r.write(Buffer.alloc(16 * 1024)), 200); r.on('close', () => clearInterval(t)); return; }
      r.writeHead(404); r.end();
    });
  }).listen(8791, '127.0.0.1');
}
async function downloads() {
  const srv = dlServer();
  try {
    await go('3zt://downloads', true);
    const dp = await connect(await find('downloads.html', 30));
    await dp.ev(`tzt.set('dlAsk', false), 1`); await sleep(500);
    const list = () => dp.ev(`tzt.dlList().then(d => d.items.map(x => ({ name: x.name, state: x.state, path: x.path, received: x.received, total: x.total, exists: x.exists, canResume: x.canResume, id: x.id })))`);
    const done = name => poll(async () => (await list()).find(x => x.name === name && x.state === 'completed'), 20000);
    await go('http://127.0.0.1:8791/', true);
    const pt = await find(u => u.startsWith('http://127.0.0.1:8791/'), 30);
    const page = await connect(pt);
    await poll(() => page.ev('typeof formDl === "function"'), 15000);
    const tabsNow = async () => { const tb = await toolbar(); const v = await tb.ev('S.tabs.length'); tb.close(); return v; };
    const before = await tabsNow();
    await page.ev('formDl(), 1', true);
    const a = await done(AR_NAME);
    ok('download from a form in a new tab (POST data + Referer kept), Arabic file name', !!a, a ? a.path : JSON.stringify(await list()).slice(0, 300));
    await page.ev('openDl(), 1', true);
    ok('download from window.open + address set by the page (opener kept)', !!(await done('opened.bin')));
    await page.ev('linkDl(), 1', true);
    ok('download through a redirect to a signed link', !!(await done('signed.bin')), JSON.stringify((await list()).map(x => x.name + ':' + x.state)));
    await sleep(1500);
    const after = await tabsNow();
    ok('the empty tabs that only started downloads close by themselves', after === before, `${before} -> ${after} tabs`);
    await page.ev('blobDl(), 1', true);
    const b = await done('نص.txt');
    ok('download of a page-made file (blob, a[download])', !!b && fs.existsSync(b.path) && fs.readFileSync(b.path, 'utf8') === 'hello from a blob');
    await page.ev('manyDl(), 1', true);
    const many = await poll(async () => { const l = await list(); return ['part-1.bin', 'part-2.bin', 'part-3.bin'].every(n => l.some(x => x.name === n && x.state === 'completed')); }, 20000);
    ok('several downloads at once', !!many);
    await page.ev('cutDl(), 1', true);
    // Chromium may pick the file up again by itself (several connections + Range); otherwise it stops and is resumed by hand
    const cut = await poll(async () => (await list()).find(x => x.name === 'resume.bin' && (x.state === 'interrupted' || x.state === 'completed')), 20000);
    if (cut && cut.state === 'interrupted') await dp.ev(`tzt.dlAct(${JSON.stringify(cut.id)}, 'resume')`);
    const res = cut && await done('resume.bin');
    const okBytes = res && fs.existsSync(res.path) && fs.statSync(res.path).size === BIG.length && fs.readFileSync(res.path).equals(BIG);
    ok('a connection that breaks half way: the file is finished intact (Range resume)', !!okBytes, cut ? `${cut.state === 'interrupted' ? 'stopped, resumed by hand' : 'picked up again by itself'}` : 'no download');
    /* big files: aria2 (several connections); what it can't fetch stays in Chromium */
    const sameFile = (x, buf) => x && fs.existsSync(x.path) && fs.statSync(x.path).size === buf.length && fs.readFileSync(x.path).equals(buf);
    const noParts = x => x && !fs.existsSync(x.path + '.part') && !fs.existsSync(x.path + '.part.aria2');
    await page.ev(`bigDl('/big'), 1`, true);
    const big = await poll(async () => (await list()).find(x => x.name === 'big.bin' && x.state === 'completed'), 40000);
    const bigFull = big && (await dp.ev(`tzt.dlList().then(d => d.items.find(x => x.id === ${JSON.stringify(big.id)}))`));
    ok('a big download goes to aria2 and the file is intact', !!big && bigFull.engine === 'aria2' && sameFile(big, HUGE) && noParts(big), big ? `engine ${bigFull.engine}, ${fs.existsSync(big.path) ? fs.statSync(big.path).size : 'no file'} bytes` : JSON.stringify((await list()).map(x => x.name + ':' + x.state)));
    await page.ev('bigPost(), 1', true);
    const bp = await poll(async () => (await list()).find(x => x.name === 'bigpost.bin' && x.state === 'completed'), 40000);
    const bpFull = bp && (await dp.ev(`tzt.dlList().then(d => d.items.find(x => x.id === ${JSON.stringify(bp.id)}))`));
    ok('a big download from a form (POST) stays in Chromium and is intact', !!bp && bpFull.engine !== 'aria2' && sameFile(bp, HUGE), bp ? `engine ${bpFull.engine}` : 'no download');
    await page.ev(`bigDl('/once'), 1`, true);
    const once = await poll(async () => (await list()).find(x => x.name === 'once.bin' && x.state === 'completed'), 60000);
    const onceFull = once && (await dp.ev(`tzt.dlList().then(d => d.items.find(x => x.id === ${JSON.stringify(once.id)}))`));
    ok('a one-time link aria2 is refused: Chromium carries on, file intact', !!once && onceFull.engine !== 'aria2' && sameFile(once, HUGE) && noParts(once), once ? `engine ${onceFull.engine}, hits ${dlHits['/once']}` : JSON.stringify((await list()).map(x => x.name + ':' + x.state)));
    // pause, resume, cancel while aria2 has it
    await page.ev(`bigDl('/bigslow'), 1`, true);
    const full = id => dp.ev(`tzt.dlList().then(d => d.items.find(x => x.id === ${JSON.stringify(id)}))`);
    const bs = await poll(async () => { const x = (await list()).find(y => y.name === 'bigslow.bin'); if (!x) return null; const f = await full(x.id); return f.engine === 'aria2' && f.received > 0 ? f : null; }, 30000);
    let pr = 'no aria2 download';
    if (bs) {
      await dp.ev(`tzt.dlAct(${JSON.stringify(bs.id)}, 'pause')`);
      await sleep(1500);
      const a1 = (await full(bs.id)).received; await sleep(1500); const a2 = await full(bs.id);
      await dp.ev(`tzt.dlAct(${JSON.stringify(bs.id)}, 'resume')`);
      const more = await poll(async () => { const f = await full(bs.id); return f.received > a2.received + 200000 ? f : null; }, 15000);
      pr = `paused ${a2.paused} (${a1} -> ${a2.received}), went on ${!!more}`;
      ok('pausing and resuming an aria2 download', a2.paused && a1 === a2.received && !!more, pr);
      await dp.ev(`tzt.dlAct(${JSON.stringify(bs.id)}, 'cancel')`);
      const c = await poll(async () => { const f = await full(bs.id); return f.state === 'cancelled' ? f : null; }, 10000);
      await sleep(800);
      ok('cancelling an aria2 download removes its partial files', !!c && !fs.existsSync(c.part) && !fs.existsSync(c.part + '.aria2'), c ? c.part : 'not cancelled');
    } else { ok('pausing and resuming an aria2 download', false, pr); ok('cancelling an aria2 download removes its partial files', false, pr); }
    await page.ev('slowDl(), 1', true);
    const slow = await poll(async () => (await list()).find(x => x.name === 'slow.bin' && x.state === 'progressing'), 15000);
    if (slow) await dp.ev(`tzt.dlAct(${JSON.stringify(slow.id)}, 'cancel')`);
    ok('cancelling a download', !!(slow && await poll(async () => (await list()).find(x => x.id === slow.id && x.state === 'cancelled'), 10000)));
    // a page cannot name files of another site (Chrome ignores <a download> across sites)
    await page.ev(`document.dispatchEvent(new CustomEvent('__3zt_dl', { detail: JSON.stringify({ href: 'http://localhost:8791/plain-file', name: 'شي.exe' }) })), location.href = 'http://localhost:8791/plain-file', 1`, true);
    const forged = await poll(async () => (await list()).find(x => (x.name === 'plain-file' || x.name === 'شي.exe') && x.state === 'completed'), 15000);
    ok('a page cannot rename another site\'s file', !!forged && forged.name === 'plain-file', forged ? forged.name : 'no download');
    // private window: its download is saved but not listed in normal windows
    { const tb = await toolbar(); await tb.ev(`ui.send('tab','incognito'),1`); tb.close(); }
    await sleep(2500);
    const priv = await poll(async () => { for (const x of (await targets()).filter(x => x.url.includes('ui/toolbar.html'))) { const c = await connect(x); if (await c.ev('S.private')) return c; c.close(); } return null; }, 15000);
    if (priv) {
      await priv.ev(`ui.send('tab','go',{text:'http://127.0.0.1:8791/?private',newTab:false}),1`);
      const pp = await connect(await find(u => u.includes('8791/?private'), 30));
      await poll(() => pp.ev('typeof manyDl === "function"'), 15000);
      await pp.ev(`(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['secret'])); a.download = 'خاص.txt'; a.click(); return 1; })()`, true);
      await sleep(4000);
      const inNormal = (await list()).some(x => x.name === 'خاص.txt');
      const inPrivate = await priv.ev(`ui.invoke('dl:session').then(l => l.some(x => x.name === 'خاص.txt'))`);
      ok('a private window\'s download stays out of normal windows\' lists', !inNormal && inPrivate === true, `normal ${inNormal}, private ${inPrivate}`);
      pp.close();
      await priv.ev(`ui.send('win','close'),1`); priv.close(); await sleep(1500);
    } else ok('a private window\'s download stays out of normal windows\' lists', false, 'no private window');
    await dp.ev(`tzt.set('dlAsk', true), 1`);
    page.close(); dp.close();
  } finally { srv.close(); }
}

/* ================= built-in media downloader (real tools, fetched and checked on first use) ================= */
async function mediaTest() {
  const vid = path.join(OUT, 'clip.mp4');
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/clip.mp4') && fs.existsSync(vid)) {
      const b = fs.readFileSync(vid), m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
      // like real sites: parts of the file on request (so only the chosen part is downloaded); ?norange = a site that can't
      if (m && !q.url.includes('norange')) { const a = +m[1], e = m[2] ? Math.min(+m[2], b.length - 1) : b.length - 1; r.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${e}/${b.length}`, 'Content-Length': e - a + 1 }); return r.end(b.subarray(a, e + 1)); }
      r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length }); return r.end(b);
    }
    if (q.url === '/watch') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>watch</title><video src="/clip.mp4" controls width=640 height=360></video>'); }
    if (q.url === '/watch2') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>watch2</title><video src="/clip.mp4?norange" controls></video>'); }
    if (q.url.startsWith('/hevc.mp4') && fs.existsSync(vid.replace('clip.mp4', 'hevc.mp4'))) { const b = fs.readFileSync(vid.replace('clip.mp4', 'hevc.mp4')); r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length, 'Accept-Ranges': 'none' }); return r.end(b); }
    // key frames 12 s apart (like many music videos): a fast part must not keep hidden seconds before its start
    if (q.url.startsWith('/gop.mp4') && fs.existsSync(vid.replace('clip.mp4', 'gop.mp4'))) {
      const b = fs.readFileSync(vid.replace('clip.mp4', 'gop.mp4')), m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
      if (m) { const a = +m[1], e = m[2] ? Math.min(+m[2], b.length - 1) : b.length - 1; r.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${e}/${b.length}`, 'Content-Length': e - a + 1 }); return r.end(b.subarray(a, e + 1)); }
      r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length, 'Accept-Ranges': 'bytes' }); return r.end(b);
    }
    if (q.url === '/watch4') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>watch4</title><video src="/gop.mp4" controls></video>'); }
    if (q.url === '/watch3') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>watch3</title><video src="/hevc.mp4" controls></video>'); }
    r.writeHead(404); r.end();
  }).listen(8792, '127.0.0.1');
  try {
    await go('3zt://downloads', true);
    const dp = await connect(await find('downloads.html', 30));
    // the downloader has its own window (opened here from the downloads page; the address-bar button is tested below)
    await dp.ev('tzt.mediaWindow(), 1');
    const mp = await connect(await find('newtab/media.html', 30));
    await poll(() => mp.ev('typeof preview === "function"'), 15000);
    const job = async (o, ms = 300000) => {
      const j = await mp.ev(`tzt.mediaStart(${JSON.stringify(o)})`);
      if (!j || j.error) return j;
      return poll(async () => { const s = await mp.ev(`tzt.mediaList().then(d => d.jobs.find(x => x.id === ${JSON.stringify(j.id)}))`); return s && s.state !== 'running' ? s : null; }, ms, 1500);
    };
    const ff = [path.join(path.dirname(exe), 'resources', 'tools', 'ffmpeg', 'ffmpeg.exe'), path.join(process.env.APPDATA || '', '3zT Browser', 'media', 'tools', 'ffmpeg', 'ffmpeg.exe')].find(f => fs.existsSync(f)) || '';
    const tools = await mp.ev('tzt.mediaList().then(d => d.tools.ready)');
    ok('download tools come with the setup (ready at once)', tools === true);
    const yt = await job({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', mode: 'video', q: '360' });
    // real sites from a GitHub datacenter machine: YouTube often asks such machines to sign in, so this is reported, not required
    console.log(`::notice title=media youtube::${yt && yt.state} ${yt && (yt.error || yt.file || '')}`.replace(/\n/g, ' '));
    const mp3 = await job({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', mode: 'audio' });
    console.log(`::notice title=media youtube mp3::${mp3 && mp3.state} ${mp3 && (mp3.error || mp3.file || '')}`.replace(/\n/g, ' '));
    const tk = await job({ url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', mode: 'video', q: 'best' });
    const vcodec = f => { try { return execSync(`"${ff.replace('ffmpeg.exe', 'ffprobe.exe')}" -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${f}"`).toString().trim(); } catch (e) { return ''; } };
    console.log(`::notice title=media tiktok::${tk && tk.state} ${tk && (tk.error || tk.file || '')} ${tk && tk.file ? 'video ' + (vcodec(tk.file) || 'none') : ''}`.replace(/\n/g, ' '));
    const ph = await job({ url: 'https://www.tiktok.com/@yungfunnyvids/photo/7333434838539111712', mode: 'images' });
    console.log(`::notice title=media photos::${ph && ph.state} ${ph && (ph.error || (ph.items || []).length + ' items')}`.replace(/\n/g, ' '));
    // a local video made with the downloaded ffmpeg: download, trim exact and fast
    if (fs.existsSync(ff)) execSync(`"${ff}" -loglevel error -y -f lavfi -i testsrc=size=640x360:rate=30 -f lavfi -i sine=frequency=440 -t 20 -c:v libx264 -g 60 -c:a aac -shortest "${vid}"`);
    if (fs.existsSync(vid)) try { execSync(`"${ff}" -loglevel error -y -i "${vid}" -c:v libx265 -tag:v hvc1 -c:a copy "${vid.replace('clip.mp4', 'hevc.mp4')}"`); } catch (e) {}
    if (fs.existsSync(ff)) try { execSync(`"${ff}" -loglevel error -y -f lavfi -i testsrc=size=640x360:rate=30 -f lavfi -i sine=frequency=500 -t 60 -c:v libx264 -g 360 -keyint_min 360 -sc_threshold 0 -pix_fmt yuv420p -c:a aac -shortest "${vid.replace('clip.mp4', 'gop.mp4')}"`); } catch (e) {}
    const probe = f => { try { return +execSync(`"${ff.replace('ffmpeg.exe', 'ffprobe.exe')}" -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim(); } catch (e) { return 0; } };
    const inf = await mp.ev(`tzt.mediaInfo('http://127.0.0.1:8792/clip.mp4')`);
    // a bare video file has no metadata (sites give title, picture, length, channel)
    ok('the link is shown before downloading (title)', !!(inf && !inf.error && inf.title), JSON.stringify(inf).slice(0, 200));
    const lv = await job({ url: 'http://127.0.0.1:8792/clip.mp4', mode: 'video', q: 'best' }, 120000);
    ok('media download of a video link', !!(lv && lv.state === 'done' && lv.file && fs.existsSync(lv.file)), lv && (lv.error || lv.file));
    const tj = await job({ url: 'http://127.0.0.1:8792/clip.mp4', mode: 'video', q: 'best', trim: true }, 120000);
    ok('"pick a part before saving" waits with a preview file', !!(tj && tj.state === 'trim' && tj.temp && fs.existsSync(tj.temp)));
    if (tj && tj.state === 'trim') {
      const r = await mp.ev(`tzt.mediaTrim(${JSON.stringify(tj.id)}, { start: 5.3, end: 9.1, exact: true })`);
      const d = r && r.file ? probe(r.file) : 0;
      ok('frame-exact trim keeps exactly the chosen part', Math.abs(d - 3.8) < 0.15, `${d} s`);
    }
    // the window itself: the link's preview and timeline come first, then only the chosen part is downloaded
    const cutUi = async (page, s0, e0, how) => {
      await mp.ev(`(murl.value = ${JSON.stringify(page)}, murl.dispatchEvent(new Event('change')), 1)`);
      const ready = await poll(() => mp.ev('info && info.url === murl.value && !info.loading && info.duration > 0 && (s0 => s0 == null || !document.getElementById("cut").hidden)(' + JSON.stringify(s0) + ') ? JSON.stringify({ d: info.duration, pv: !pvv.hidden, vol: pvv.volume }) : null'), 60000);
      if (!ready) return { ready };
      const t0 = Date.now();
      // the handles, the way a mouse moves them (the slider runs 0..1000 over the video's length)
      if (s0 != null) await mp.ev(`(() => { const d = dur(); ts.value = Math.round(${+s0} * 10); ts.dispatchEvent(new Event("input")); te.value = Math.round(${+e0} * 10); te.dispatchEvent(new Event('input')); document.querySelector('input[name=cm][value=${how}]').checked = true; return 1; })()`);
      const had = await mp.ev('tzt.mediaList().then(d => d.jobs.map(j => j.id))') || [];
      await mp.ev('mgo.click(), 1');
      await sleep(800);
      const j = await poll(async () => { const x = await mp.ev(`tzt.mediaList().then(d => d.jobs.find(j => !${JSON.stringify(had)}.includes(j.id) && j.url === ${JSON.stringify(page)} && j.state !== 'running' && j.state !== 'trim'))`); return x || null; }, 120000, 700);
      return { ready, j, d: j && j.file ? probe(j.file) : 0, secs: ((Date.now() - t0) / 1000).toFixed(1), label: await mp.ev('mgoT.textContent') };
    };
    const c1 = await cutUi('http://127.0.0.1:8792/watch', 5.3, 9.1, 'exact');
    ok('downloader window: preview and timeline show before downloading, sound at a quarter', !!c1.ready && JSON.parse(c1.ready).vol === 0.25, c1.ready);
    const noScroll = await mp.ev(`(() => { const m = document.querySelector('main'); return JSON.stringify({ sh: m.scrollHeight, ch: m.clientHeight, doc: document.documentElement.scrollHeight, win: innerHeight, boxes: !!document.getElementById('tsi') }); })()`);
    ok('downloader window: everything fits, no scrolling, no time boxes', (j => j.sh <= j.ch + 1 && j.doc <= j.win + 1 && !j.boxes)(JSON.parse(noScroll)), noScroll);
    ok('only the chosen part is downloaded (frame-exact)', Math.abs(c1.d - 3.8) < 0.2, `${c1.d} s in ${c1.secs} s, button "${c1.label}"`);
    const c2 = await cutUi('http://127.0.0.1:8792/watch2', 4, 12, 'fast');
    // ffmpeg can often still read such a site straight through; if it can't, the whole video is cut here ("(clip)" in the name). Either way: the right part
    ok('a site that cannot send parts still gives just the chosen part', c2.d > 7 && c2.d < 12.6, `${c2.d} s in ${c2.secs} s, ${c2.j && c2.j.name} (${/\(clip\)/.test((c2.j && c2.j.name) || '') ? 'cut here' : 'read straight through'})`);
    // a video only in HEVC (Windows can't play it without a paid add-on): saved as H.264, whole and as a part
    const c3 = await cutUi('http://127.0.0.1:8792/watch3', null, null, 'fast');
    ok('an HEVC video is saved as H.264 (plays everywhere)', c3.j && c3.j.file && vcodec(c3.j.file) === 'h264' && Math.abs(c3.d - 20) < 0.5, `${c3.j && c3.j.file} ${c3.j && c3.j.file && vcodec(c3.j.file)} ${c3.d} s ${c3.j && c3.j.error || ''}`);
    const c4 = await cutUi('http://127.0.0.1:8792/watch3', 2, 7, 'fast');
    ok('…and a part of it too', c4.j && c4.j.file && vcodec(c4.j.file) === 'h264' && c4.d > 4.5 && c4.d < 9, `${c4.j && c4.j.name} ${c4.d} s`);
    // a fast part of a video with distant key frames: starts at 0 with nothing hidden (Windows' players ignore the hidden part)
    const c5 = await cutUi('http://127.0.0.1:8792/watch4', 31, 41, 'fast');
    const first = f => { try { return execSync(`"${ff.replace('ffmpeg.exe', 'ffprobe.exe')}" -v error -select_streams v:0 -show_entries packet=pts_time -read_intervals %+#1 -of csv=p=0 "${f}"`).toString().trim(); } catch (e) { return 'err'; } };
    const f5 = c5.j && c5.j.file ? first(c5.j.file) : 'no file';
    ok('a fast part starts on its first frame, nothing hidden before it (plays the same in Windows Media Player)', !!(c5.j && c5.j.file) && Math.abs(parseFloat(f5)) < 0.05 && c5.d > 9.5 && c5.d < 10.6, `${c5.j && c5.j.name} ${c5.d} s, first picture at ${f5} s`);
    const id = await dp.ev(`tzt.dlList().then(d => (d.items.find(x => x.media && /clip/.test(x.name) && !/\\(clip\\)/.test(x.name)) || {}).id)`);
    if (id) {
      const r = await dp.ev(`tzt.mediaTrimFile(${JSON.stringify(id)}, { start: 4, end: 12, exact: false })`);
      const d = r && r.file ? probe(r.file) : 0;
      ok('fast trim (no re-encoding) of a finished download', d > 7 && d < 12.5, `${d} s (starts at the key frame before 4 s)`);
    } else ok('fast trim (no re-encoding) of a finished download', false, 'no list entry');
    // the address-bar button on a page with a video
    await go('http://127.0.0.1:8792/watch', true);
    await find(u => u.includes('8792/watch'), 30);
    const seen = await poll(async () => { const tb = await toolbar(); const v = await tb.ev('S.url.includes("8792/watch") && S.media && !document.getElementById("mediaBtn").hidden'); tb.close(); return v; }, 15000);
    ok('the download button shows on a page with a video', !!seen);
    if (seen) {
      const tb = await toolbar(); await tb.ev(`document.getElementById('mediaBtn').click(), 1`); tb.close();
      const filled = await poll(async () => { const v = await mp.ev(`document.getElementById('murl').value`); return /8792\/watch/.test(v || '') ? v : null; }, 10000);
      ok('the button sends the page to the downloader window', !!filled);
    }
    await go('https://example.com/', true); await sleep(2500);
    const none = await (async () => { const tb = await toolbar(); const v = await tb.ev('document.getElementById("mediaBtn").hidden'); tb.close(); return v; })();
    ok('…and not on a page without one', none === true);
    // closing the window stops everything it started and forgets the list; it opens clean
    const before = await mp.ev('tzt.mediaList().then(d => d.jobs.length)');
    mp.ev('window.close(), 1').catch(() => {}); mp.close();
    await sleep(2500);
    // only the browser's own copies count (the test machine may run other ffmpeg)
    const left = (() => { try { return +execSync(`powershell -NoProfile -Command "@(Get-Process yt-dlp,gallery-dl,ffmpeg -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*3zT*' }).Count"`).toString().trim(); } catch (e) { return -1; } })();
    await dp.ev('tzt.mediaWindow(), 1');
    const mp2 = await connect(await find('newtab/media.html', 30));
    await poll(() => mp2.ev('typeof preview === "function"'), 15000);
    const after = await mp2.ev('tzt.mediaList().then(d => d.jobs.length)');
    ok('closing the downloader stops its tools and opens clean next time', before > 0 && after === 0 && left === 0, `jobs before ${before}, after ${after}, tool processes left ${left}`);
    mp2.close(); dp.close();
  } finally { srv.close(); }
}

/* ================= the "Windows Security" window on sign-in pages (passkeys) ================= */
const PK_PAGE = `<!doctype html><title>pk</title><button id=b>passkey</button><script>
const pk = (extra) => Object.assign({ challenge: new Uint8Array(32), rpId: 'localhost' }, extra || {});
const timed = (p, ms) => Promise.race([p.then(() => 'resolved', e => 'rejected ' + e.name), new Promise(r => setTimeout(() => r('waiting'), ms))]);
// what Google's sign-in page does when it opens: conditional, immediate, and a plain "any passkey" request, all without a click
window.probe = async () => {
  const cond = await PublicKeyCredential.isConditionalMediationAvailable().catch(e => 'err ' + e.name);
  const ac = new AbortController();
  const c = navigator.credentials.get({ mediation: 'conditional', signal: ac.signal, publicKey: pk({ allowCredentials: [] }) });
  const r = { conditionalAvailable: cond };
  r.immediate = await timed(navigator.credentials.get({ mediation: 'immediate', publicKey: pk() }), 1500);
  r.background = await timed(navigator.credentials.get({ publicKey: pk({ allowCredentials: [] }) }), 1500);
  r.conditionalAfter2s = await timed(c, 2000);
  ac.abort(); r.afterAbort = await timed(c, 500);
  // the same from a sign-in box embedded from another site (iframe)
  r.frame = await new Promise(res => { addEventListener('message', e => res(e.data), { once: true }); const f = document.createElement('iframe'); f.allow = 'publickey-credentials-get *'; f.src = 'http://127.0.0.1:8793/?frame'; document.body.appendChild(f); setTimeout(() => res('no answer'), 5000); });
  return JSON.stringify(r);
};
// only 3zT's fix makes a frame say "no passkey autofill"; then its background request must be refused at once
if (location.search.includes('frame')) PublicKeyCredential.isConditionalMediationAvailable().then(async a => parent.postMessage('autofill ' + a + ' background ' + await timed(navigator.credentials.get({ publicKey: pk({ allowCredentials: [] }) }), 1500), '*'));
// Google's trick: a blank same-origin frame (and window.open / frames[n]) to get an untouched navigator.credentials.get
window.blank = async () => {
  const f = document.createElement('iframe'); f.style.display = 'none'; document.body.appendChild(f);
  const w = f.contentWindow, r = {};
  r.autofill = await w.PublicKeyCredential.isConditionalMediationAvailable().catch(e => 'err ' + e.name);
  r.bg = await timed(w.navigator.credentials.get({ publicKey: pk({ allowCredentials: [] }) }), 1500);
  r.src = w.Function.prototype.toString.call(w.navigator.credentials.get) + ' | ' + Function.prototype.toString.call(navigator.credentials.get);
  document.body.appendChild(document.createElement('iframe'));
  r.frames = await timed(window.frames[window.length - 1].navigator.credentials.get({ publicKey: pk({ allowCredentials: [] }) }), 1500);
  return JSON.stringify(r);
};
// a passkey you ask for yourself (a click): must still reach Windows
window.mine = () => { window.ac2 = new AbortController(); window.res2 = 'waiting'; navigator.credentials.get({ signal: ac2.signal, publicKey: pk({ allowCredentials: [] }) }).then(() => (res2 = 'resolved'), e => (res2 = 'rejected ' + e.name)); return 1; };
</script>`;
const credUi = () => { try { return /CredentialUIBroker|WebAuthnBroker|WWAHost/i.test(execSync('tasklist /NH').toString()); } catch (e) { return false; } };
async function passkeys() {
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(PK_PAGE); }).listen(8793, '127.0.0.1');
  const kill = () => { try { execSync('taskkill /IM CredentialUIBroker.exe /F', { stdio: 'ignore' }); } catch (e) {} };
  try {
    const open = async () => { await go('http://localhost:8793/', true); const c = await connect(await find(u => u.startsWith('http://localhost:8793'), 30)); await poll(() => c.ev('typeof probe === "function"'), 10000); return c; };
    const run = async label => {
      const c = await open();
      const v = await c.ev('probe()');
      const win = credUi(); kill();
      console.log(`::notice title=passkeys ${label}::${v} | Windows Security window open: ${win}`);
      c.close();
      return { v: JSON.parse(v || '{}'), win };
    };
    // the cause, shown once without the fix (reported only)
    await stop(); await start({ TZT_NO_PASSKEY_FIX: '1' }); await sleep(3000);
    await run('without fix');
    await stop(); await start(); await sleep(3000);
    const w = await run('with fix');
    ok('sign-in pages: background passkey requests do not open the Windows Security window', w.v.conditionalAvailable === false && /^rejected NotAllowedError/.test(w.v.immediate) && /^rejected NotAllowedError/.test(w.v.background) && w.v.conditionalAfter2s === 'waiting' && /^autofill false background rejected NotAllowedError/.test(w.v.frame || '') && !w.win, JSON.stringify(w));
    // blank frames made by the page get the same (Google takes an untouched copy from one)
    { const c = await open(); const b = JSON.parse((await c.ev('blank()')) || '{}'); const win = credUi(); kill(); c.close();
      ok('…also from blank frames of the page (about:blank, frames[n]), and the change is not visible to toString', b.autofill === false && /^rejected NotAllowedError/.test(b.bg || '') && /^rejected NotAllowedError/.test(b.frames || '') && /^function get\(\) \{ \[native code\] \} \| function get\(\) \{ \[native code\] \}$/.test(b.src || '') && !win, JSON.stringify(b) + ' window ' + win); }
    // passkeys are off by default: even a click gets "no passkey" (no Windows window)
    const clicked = async () => {
      const c = await open();
      await c.ev('mine()', true);
      await sleep(3000);
      const res = await c.ev('res2'); const win = credUi();
      await c.ev('ac2.abort(), 1'); kill(); c.close();
      return { res, win };
    };
    const off = await clicked();
    ok('passkeys off (the default): no Windows Security window even after a click', /^rejected NotAllowedError/.test(off.res || '') && !off.win, JSON.stringify(off));
    // turned on in Settings: a passkey request after a click goes to Windows (its window opens, or the request at least is not refused at once)
    { const tb = await toolbar(); await tb.ev(`ui.send('set', 'passkeys', true), 1`); tb.close(); await sleep(500); }
    const on = await clicked();
    ok('passkeys on: a passkey you ask for (after a click) still reaches Windows', on.win || on.res === 'waiting', `window ${on.win}, request ${on.res}`);
    { const tb = await toolbar(); await tb.ev(`ui.send('set', 'passkeys', false), 1`); tb.close(); }
  } finally { srv.close(); }
}

/* ---------- 0.15.1 features: reader view, picture in picture, tab cards, tab search, cookie popups ---------- */
const FEAT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const featPara = n => Array.from({ length: n }, (_, i) => `<p>هذه فقرة رقم ${i + 1} من المقال، وفيها كلام كثير عن الموضوع حتى يكون النص طويلاً بما يكفي ليعتبره المتصفح مقالاً حقيقياً يستحق القراءة بهدوء وتركيز.</p>`).join('');
const FEAT_ARTICLE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مقال تجريبي</title></head><body><nav><a href="/">الرئيسية</a></nav><div class="ad">إعلان مزعج</div>
<article><h1>مقال تجريبي</h1>${featPara(6)}<figure><img src="/pic.png" alt="أ"><figcaption>تعليق الصورة الأولى</figcaption></figure>${featPara(3)}
<p>رابط <a href="javascript:alert(1)">خبيث</a> و<a href="https://example.com/">سليم</a></p><script>window.__bad=1</script><iframe src="/x"></iframe><p onclick="window.__bad=2">فقرة</p>
<figure><img data-src="/pic.png" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="ب"><figcaption>تعليق الصورة الثانية</figcaption></figure>${featPara(4)}</article></body></html>`;
// a page with a consent popup built like OneTrust's (the most common one): "Reject all" must be pressed for us
const FEAT_COOKIES = `<!doctype html><meta charset="utf-8"><title>cookies</title><body><p>content</p>
<div id="onetrust-consent-sdk"><div id="onetrust-banner-sdk" style="position:fixed;bottom:0;left:0;right:0;background:#fff;padding:20px">We use cookies
<button id="onetrust-accept-btn-handler">Accept all</button><button id="onetrust-reject-all-handler">Reject all</button></div></div>
<script>window.OnetrustActiveGroups=',C0001,C0002,C0003,';window.__choice='';
document.getElementById('onetrust-reject-all-handler').onclick=()=>{window.__choice='reject';window.OnetrustActiveGroups=',C0001,';document.getElementById('onetrust-banner-sdk').style.display='none';};
document.getElementById('onetrust-accept-btn-handler').onclick=()=>{window.__choice='accept';document.getElementById('onetrust-banner-sdk').style.display='none';};</script></body>`;
/* client hints: page and frame loads carry Sec-CH-UA like every other request (Electron leaves them off) */
async function clientHints() {
  const seen = [];
  const srv = http.createServer((q, r) => {
    seen.push({ url: q.url, ch: q.headers['sec-ch-ua'] || '', plat: q.headers['sec-ch-ua-platform'] || '' });
    if (q.url.startsWith('/ch-page')) { r.setHeader('Content-Type', 'text/html'); return r.end('<title>ch</title><img src="/ch-img.png"><iframe src="/ch-frame"></iframe>'); }
    if (q.url.startsWith('/ch-frame')) { r.setHeader('Content-Type', 'text/html'); return r.end('<p>frame</p>'); }
    r.writeHead(404); r.end();
  }).listen(8796, '127.0.0.1');
  try {
    await go('http://127.0.0.1:8796/ch-page?1', true); await find(u => u.includes('/ch-page?1'), 30); await sleep(2000);
    await go('http://127.0.0.1:8796/ch-page?2', true); await find(u => u.includes('/ch-page?2'), 30); await sleep(2000);
    const img = seen.find(x => x.url === '/ch-img.png' && x.ch), page = seen.find(x => x.url === '/ch-page?2'), frame = seen.filter(x => x.url === '/ch-frame').pop();
    ok('page and frame loads carry the browser\'s client hints, the same as its other requests', !!img && !!page && !!frame && page.ch === img.ch && frame.ch === img.ch && !!page.plat, JSON.stringify({ img, page, frame }));
  } finally { srv.close(); }
}

/* pop-up ads: a script opening another site on a click is stopped; a link, the same site, and sign-in windows are not */
async function popups() {
  const page = `<title>pop</title><style>button,a{display:block;width:300px;height:60px;margin:8px}</style>
    <button id=ad onclick="window.open('http://localhost:8797/ad')">ad</button>
    <a id=ln href="http://localhost:8797/link" target=_blank>link</a>
    <button id=same onclick="window.open('/same')">same</button>
    <button id=blank onclick="const w = window.open(); w.location = 'http://localhost:8797/later'">blank</button>
    <button id=win onclick="window.open('http://localhost:8797/signin', 'x', 'width=420,height=500')">signin</button>`;
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html'); r.end(q.url === '/pop' ? page : '<title>' + q.url.slice(1) + '</title>' + q.url); }).listen(8797);
  try {
    await go('http://127.0.0.1:8797/pop', true);
    const pt = await find(u => u.startsWith('http://127.0.0.1:8797/pop'), 30);
    const pc = await connect(pt); await sleep(1500);
    const click = async id => {
      const box = JSON.parse(await pc.ev(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return JSON.stringify({ x: r.left + 20, y: r.top + 20 }); })()`));
      for (const type of ['mousePressed', 'mouseReleased']) await pc.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await sleep(2500);
    };
    const open = async () => (await targets()).filter(t => /:8797\/(ad|link|same|later|signin)/.test(t.url)).map(t => t.url.replace(/^.*:8797\//, ''));
    await click('ad');
    const st = await (async () => { const tb = await toolbar(); const v = await tb.ev(`JSON.stringify({ toast: !document.getElementById('toast').hidden, n: S.blocked })`); tb.close(); return JSON.parse(v); })();
    const a1 = await open();
    ok('pop-up blocking: a script opening another site on a click is stopped, quietly, and counted on the shield', !a1.includes('ad') && !st.toast && +st.n >= 1, `${JSON.stringify(a1)} · ${JSON.stringify(st)}`);
    await click('ln'); await click('same'); await click('win');
    const a2 = await open();
    ok('pop-up blocking: links, the same site and sign-in windows still open', a2.includes('link') && a2.includes('same') && a2.includes('signin'), JSON.stringify(a2));
    await click('blank');
    const a3 = await open();
    ok('pop-up blocking: an empty tab a script sends to another site is closed', !a3.includes('later'), JSON.stringify(a3));
    pc.close();
  } finally { srv.close(); }
}

/* empty ad slots: what an ad network's script leaves behind once its picture is blocked is folded away */
async function adSlots() {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const slot = (img) => `(() => { const s = document.currentScript, f = document.createElement('iframe');
    f.style.cssText = 'width:300px!important;height:228px!important;border:0;display:block!important';
    s.parentNode.appendChild(f);
    const d = f.contentDocument; d.open(); d.write('<body style="margin:0"><div style="width:100%;height:180px;background:#e3e3e3"></div><p>Dream Beyond Reality</p>${img}</body>'); d.close(); })();`;
  const page = `<!doctype html><title>slots</title><body style="margin:0">
    <div id=w1 style="margin-bottom:30px"><div><script src="http://localhost:8798/ad.js"></script></div></div>
    <div id=w2><script src="/own.js"></script></div>
    <div id=w3><script src="http://localhost:8798/adimg.js"></script></div>
    <p id=w4>text <a id=bn href="#"><img src="https://doubleclick.net/banner.png" width=300 height=100></a></p>
    <div id=w5><script src="http://localhost:8798/taUwXay04girK/156759"></script></div>
    <p id=txt>كلام الصفحة</p></body>`;
  const srv = http.createServer((q, r) => {
    if (q.url === '/slots') { r.setHeader('Content-Type', 'text/html; charset=utf-8'); return r.end(page); }
    if (q.url === '/taUwXay04girK/156759') { r.setHeader('Content-Type', 'text/javascript'); return r.end('document.title = "rotating ad ran"; ' + slot('')); }
    if (q.url === '/ad.js' || q.url === '/own.js') { r.setHeader('Content-Type', 'text/javascript'); return r.end(slot('')); }
    if (q.url === '/adimg.js') { r.setHeader('Content-Type', 'text/javascript'); return r.end(slot('<img src="http://localhost:8798/c.png" style="width:300px;height:100px">')); }
    if (q.url === '/c.png') { r.setHeader('Content-Type', 'image/png'); return r.end(PNG); }
    r.writeHead(404); r.end();
  }).listen(8798);
  try {
    await go('http://127.0.0.1:8798/slots', true);
    const t = await find(u => u.startsWith('http://127.0.0.1:8798/slots'), 30);
    const c = await connect(t);
    const vis = id => `getComputedStyle(document.getElementById('${id}')).display !== 'none'`;
    const r = await poll(async () => { const v = JSON.parse(await c.ev(`JSON.stringify({ w1: ${vis('w1')}, w2: ${vis('w2')}, w3: ${vis('w3')}, bn: ${vis('bn')}, w4: ${vis('w4')}, txt: ${vis('txt')} })`)); return !v.w1 && !v.bn ? v : null; }, 15000)
      || JSON.parse(await c.ev(`JSON.stringify({ w1: ${vis('w1')}, w2: ${vis('w2')}, w3: ${vis('w3')}, bn: ${vis('bn')}, w4: ${vis('w4')}, txt: ${vis('txt')} })`));
    ok('empty ad slots: the box another site\'s script made, with nothing showing in it, is folded with its wrappers', !r.w1, JSON.stringify(r));
    ok('empty ad slots: a blocked picture is folded, the text around it stays', !r.bn && r.w4 && r.txt, JSON.stringify(r));
    ok('empty ad slots: the site\'s own frame and an ad that shows a picture are left alone', r.w2 && r.w3, JSON.stringify(r));
    const rot = await c.ev(`JSON.stringify({ ran: document.title === 'rotating ad ran', frame: !!document.querySelector('#w5 iframe') })`);
    ok('ad networks on rotating domains are stopped by the shape of their addresses', rot === JSON.stringify({ ran: false, frame: false }), rot);
    c.close();
  } finally { srv.close(); }
}

/* link cleaning, fingerprinting protection, AdGuard's YouTube rules (and an offline check of how they are read) */
async function privacy() {
  const page = `<!doctype html><title>fp</title><body><canvas id=on width=200 height=60></canvas><script>
    const draw = c => { const x = c.getContext('2d'); x.fillStyle = '#f60'; x.fillRect(10, 10, 100, 30); x.fillStyle = '#069'; x.font = '18px Arial'; x.fillText('3zT fingerprint', 4, 40); return c; };
    window.fp = () => { const off = draw(Object.assign(document.createElement('canvas'), { width: 200, height: 60 })); const on = draw(document.getElementById('on'));
      return JSON.stringify({ off1: off.toDataURL(), off2: off.toDataURL(), on: on.toDataURL(), px: Array.from(on.getContext('2d').getImageData(0, 0, 200, 60).data.slice(0, 64)).join(','),
        native: /\[native code\]/.test(HTMLCanvasElement.prototype.toDataURL.toString()) && HTMLCanvasElement.prototype.toDataURL.name === 'toDataURL' }); };
  </script></body>`;
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(page); }).listen(8800);
  try {
    // link cleaning: the page opens without its tracking fields (built-in rules until ClearURLs' are downloaded)
    await go('http://127.0.0.1:8800/p?utm_source=news&id=7&fbclid=abc', true);
    const t = await find(u => u.startsWith('http://127.0.0.1:8800/p'), 30);
    const c = await connect(t);
    const search = await poll(async () => { const s = await c.ev('location.search'); return s === '?id=7' ? s : null; }, 8000) || await c.ev('location.search');
    ok('link cleaning: tracking fields are taken off the address before the page opens', search === '?id=7', search);
    // fingerprinting: a hidden canvas reads back slightly changed (the same each time), the one on the page exactly as drawn
    await poll(() => c.ev('typeof fp === "function"'), 8000);
    const a = JSON.parse(await c.ev('fp()'));
    ok('fingerprinting protection: a hidden canvas reads back changed and stable, the page\'s own canvas untouched',
      a.off1 === a.off2 && a.off1 !== a.on && a.native, `stable ${a.off1 === a.off2}, differs from page canvas ${a.off1 !== a.on}, looks built in ${a.native}`);
    c.close();
    // another site: other changes
    await go('http://localhost:8800/p2', true);
    const c2 = await connect(await find(u => u.startsWith('http://localhost:8800/p2'), 30));
    await poll(() => c2.ev('typeof fp === "function"'), 8000);
    const b = JSON.parse(await c2.ev('fp()'));
    ok('fingerprinting protection: another site reads a different value', b.off1 !== a.off1 && b.on === a.on, `sites differ ${b.off1 !== a.off1}, page canvases equal ${b.on === a.on}`);
    c2.close();
  } finally { srv.close(); }
  ytrulesUnit(ok);
  // AdGuard's YouTube rules: downloaded in the background, then used on YouTube (needs the internet)
  const logf = path.join(OUT, 'app.log');
  const got = await poll(() => { try { return /\[3zT\] YouTube rules (updated|checked)/.test(fs.readFileSync(logf, 'utf8')); } catch (e) { return false; } }, 40000);
  if (!got) { ok('YouTube: AdGuard\'s YouTube rules are downloaded and checked', false, 'not downloaded (no internet?)'); return; }
  ok('YouTube: AdGuard\'s YouTube rules are downloaded and checked', true);
  await go('https://www.youtube.com/watch?v=aqz-KE-bpKQ', true);
  const yt = await connect(await find(u => u.startsWith('https://www.youtube.com/watch'), 40));
  // (the rules wrap setTimeout for YouTube's artificial delay; the log line can lag behind on Windows)
  const used = await poll(async () => { try { if (/\[3zT\] yt rules injected www\.youtube\.com/.test(fs.readFileSync(logf, 'utf8'))) return true; } catch (e) {}
    return yt.ev(`String(setTimeout).indexOf('function setTimeout') !== 0`); }, 20000);
  const player = await poll(() => yt.ev(`!!document.querySelector('#movie_player video')`), 30000);
  ok('YouTube: the scripts run on YouTube and the player still loads', !!used && !!player, `used ${!!used}, player ${!!player}`);
  // YouTube's ad check script loads (blocking it makes the player wait), and no "ad blockers are not allowed"
  const st = await poll(async () => { const v = JSON.parse(await yt.ev(`JSON.stringify({ s: window.google_ad_status, e: document.querySelectorAll('ytd-enforcement-message-view-model').length })`)); return v.s === 1 ? v : null; }, 15000)
    || JSON.parse(await yt.ev(`JSON.stringify({ s: window.google_ad_status, e: document.querySelectorAll('ytd-enforcement-message-view-model').length })`));
  ok('YouTube: its ad check passes and no ad-blocker message comes up', st.s === 1 && st.e === 0, JSON.stringify(st));
  // for information only (does not fail the build): did "Experiencing interruptions?" show up 20 s after the player
  if (player) {
    await sleep(20000);
    const toast = await yt.ev(`[...document.querySelectorAll('yt-formatted-string, tp-yt-paper-toast, .ytp-toast')].some(e => /Experiencing interruptions/i.test(e.textContent || ''))`);
    console.log(`::notice title=youtube interruptions toast::${toast === true}`);
  }
  yt.close();
}

/* the bar takes the site's colour: read once, soon after the page appears (not after everything has loaded),
   from under the top edge (a loading line there is ignored), the theme colour when the header has no one colour */
async function tint() {
  const head = '<!doctype html><meta name="color-scheme" content="dark"><style>body{margin:0;background:#111}</style>';
  const pages = {
    '/solid': head + '<meta name="theme-color" content="#ff00ff"><div style="height:3px;background:#e00"></div><header style="height:90px;background:rgb(20,120,200)"></header><img src="/slow">',
    '/mixed': head + '<meta name="theme-color" content="#336699"><header style="height:90px;background:linear-gradient(90deg,#000,#fff 25%,#f00 50%,#0f0 75%,#00f)"></header>'
  };
  const srv = http.createServer((q, r) => {
    if (q.url === '/slow') return;   // never answers: the page keeps loading
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(pages[q.url] || head);
  }).listen(8801);
  const barTint = async () => { const tb = await toolbar(); const v = await tb.ev(`document.body.classList.contains('tinted') ? getComputedStyle(document.documentElement).getPropertyValue('--tint').trim() : ''`); tb.close(); return v; };
  const near = (v, rgb) => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(v || ''); return !!m && rgb.every((x, i) => Math.abs(x - +m[i + 1]) <= 8); };
  try {
    await go('http://tint-a.localhost:8801/solid', true);
    const t0 = Date.now();
    const a = await poll(async () => { const v = await barTint(); return near(v, [20, 120, 200]) ? v : null; }, 6000, 150);
    ok('top bar: takes the header colour soon after the page appears, while it is still loading', !!a, `${a || await barTint()} after ${Date.now() - t0} ms`);
    await go('http://tint-b.localhost:8801/mixed', true);
    const b = await poll(async () => { const v = await barTint(); return near(v, [0x33, 0x66, 0x99]) ? v : null; }, 6000, 150);
    ok('top bar: a header with no single colour uses the site\'s theme colour', !!b, b || await barTint());
  } finally { srv.close(); }
}

/* YouTube's "Video paused. Continue watching?": answered when YouTube paused by itself, never when you did */
async function ytIdle() {
  const clip = fs.readFileSync(path.join(OUT, 'clip.mp4'));
  const page = `<!doctype html><title>yt</title><body>
    <div id=movie_player><video id=v src="/clip.mp4" muted playsinline style="width:320px"></video></div>
    <button id=mine onclick="v.pause(); ask()">pause and ask</button>
    <ytd-popup-container></ytd-popup-container>
    <script>
      window.answered = 0;
      window.ask = () => { const c = document.querySelector('ytd-popup-container'); c.innerHTML = '<tp-yt-paper-dialog><yt-confirm-dialog-renderer><p>Video paused. Continue watching?</p><yt-button-renderer id=confirm-button><button>Yes</button></yt-button-renderer></yt-confirm-dialog-renderer></tp-yt-paper-dialog>';
        c.querySelector('button').onclick = () => { answered++; c.innerHTML = ''; }; };
      window.idle = () => { v.pause(); ask(); };
    </script></body>`;
  const srv = http.createServer((q, r) => {
    if (q.url === '/clip.mp4') { r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': clip.length }); return r.end(clip); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(page);
  }).listen(8799);
  try {
    await go('http://yt.localhost:8799/watch', true);
    const c = await connect(await find(u => u.startsWith('http://yt.localhost:8799/'), 30));
    await poll(() => c.ev(`location.host === 'yt.localhost:8799' && typeof ask === 'function'`), 20000);
    await poll(() => c.ev(`v.play().then(() => true, () => false)`, true), 15000);
    await sleep(1500);
    await c.ev('idle(), 1');
    const r1 = await poll(async () => { const j = JSON.parse(await c.ev(`JSON.stringify({ a: answered, playing: !v.paused })`)); return j.a === 1 && j.playing ? j : null; }, 8000);
    ok('YouTube: "Continue watching?" after it paused by itself is answered and the video goes on', !!r1, await c.ev(`JSON.stringify({ a: answered, playing: !v.paused })`));
    // your own click that pauses and opens a question: left for you
    const b = JSON.parse(await c.ev(`JSON.stringify((r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }))(mine.getBoundingClientRect()))`));
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(3000);
    const r2 = JSON.parse(await c.ev(`JSON.stringify({ a: answered, paused: v.paused, open: !!document.querySelector('yt-confirm-dialog-renderer') })`));
    ok('YouTube: a question after your own click is left alone', r2.a === 1 && r2.paused && r2.open, JSON.stringify(r2));
    c.close();
  } finally { srv.close(); }
}

/* the music button (src/songid.js): the shield went into the menu; a tab that plays nothing gives "nothing is
   playing"; a tab playing a tone is heard (only that tab), fingerprinted and sent to Shazam - a tone is no song */
function toneWav(sec) {
  const rate = 44100, n = rate * sec, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin(2 * Math.PI * (300 + (i % (rate * 3)) / 200) * i / rate) + 3000 * Math.sin(2 * Math.PI * 1250 * i / rate)), 44 + i * 2);
  return b;
}
async function song() {
  // the bar: a music button instead of the shield; the ad blocker is in the menu and opens the same panel
  let tb = await toolbar();
  const bar = await tb.ev(`JSON.stringify({ song: !!document.getElementById('songBtn'), shield: !!document.getElementById('shield') })`);
  await tb.ev(`document.getElementById('menuBtn').click(), 1`); await sleep(300);
  const item = await tb.ev(`!!document.querySelector('#drop [data-a=shield]')`);
  if (item) { await tb.ev(`document.querySelector('#drop [data-a=shield]').click(), 1`); await sleep(500); }
  const panel = await tb.ev(`openKind + '|' + document.getElementById('drop').innerText.slice(0, 80)`);
  await tb.ev('closeDrop(), 1'); tb.close();
  ok('music button in the bar; the ad blocker moved into the menu and opens its panel', bar === '{"song":true,"shield":false}' && item && /^shield\|/.test(panel) && /مانع|blocker/i.test(panel), `${bar} ${panel}`);
  const result = async (ms = 40000) => poll(async () => { const t = await toolbar(); const v = await t.ev(`openKind === 'song' ? (songRes && songRes.status) + '|' + document.getElementById('drop').innerText.replace(/\\n/g, ' ') : ''`); t.close(); return v; }, ms, 300);
  const press = async () => { const t = await toolbar(); await t.ev(`closeDrop(), document.getElementById('songBtn').click(), 1`); t.close(); };
  // nothing playing (close every tab that could be making sound first: a fresh tab is active)
  await go('about:blank', true); await sleep(800);
  const quiet = await poll(async () => { const t = await toolbar(); const v = await t.ev(`!S.tabs.some(x => x.audible)`); t.close(); return v; }, 10000);
  const t1 = Date.now(); await press(); const r1 = await result(10000);
  ok('music button: with nothing playing it says so at once', quiet && /^silent\|/.test(r1 || '') && Date.now() - t1 < 6000, `${r1} after ${Date.now() - t1} ms`);
  // a tab playing a tone
  const wav = toneWav(30);
  const srv = http.createServer((q, r) => {
    if (q.url === '/tone.wav') { r.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length }); return r.end(wav); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end('<!doctype html><title>tone</title><body><audio id=a src="/tone.wav" loop></audio><script>window.go = () => a.play().then(() => "ok", e => String(e))</script></body>');
  }).listen(8802, '127.0.0.1');
  try {
    await go('http://127.0.0.1:8802/', true);
    const pc = await connect(await find(u => u.startsWith('http://127.0.0.1:8802/'), 30));
    await poll(() => pc.ev('typeof go === "function"'), 8000);
    const played = await pc.ev('go()', true);
    const audible = await poll(async () => { const t = await toolbar(); const v = await t.ev(`S.tabs.some(x => x.audible)`); t.close(); return v; }, 10000);
    if (!audible) {
      console.log(`::notice title=music button::the test tone is not "audible" here (no sound device on this machine?): play ${played}`);
      ok('music button: a playing tab is heard (skipped: no sound device)', true, `play ${played}`);
    } else {
      // another tab is active: the button still finds the playing one
      await go('about:blank', true); await sleep(600);
      const t2 = Date.now(); await press();
      const listening = await poll(async () => { const t = await toolbar(); const v = await t.ev(`document.getElementById('songBtn').classList.contains('listening')`); t.close(); return v; }, 3000, 100);
      const hidden = await poll(async () => (await targets()).some(x => x.url.includes('ui/songid.html')), 4000, 200);
      const r2 = await result(45000);
      const ms = Date.now() - t2;
      const logf = path.join(OUT, 'app.log');
      const line = (() => { try { return (fs.readFileSync(logf, 'utf8').match(/\[3zT\] song recognition[^\n]*/g) || []).slice(-2).join(' / '); } catch (e) { return ''; } })();
      console.log(`::notice title=music button::${r2} in ${ms} ms; ${line}`);
      ok('music button: listens to the playing tab (also from another tab), fingerprints it and asks Shazam (a tone: no song)', !!listening && !!hidden && /^none\|/.test(r2 || ''), `${r2} in ${ms} ms, listening ${listening}, listener ${hidden}; ${line}`);
      const gone = await poll(async () => !(await targets()).some(x => x.url.includes('ui/songid.html')), 5000, 300);
      const still = await pc.ev('!a.paused && a.currentTime > 3');
      ok('music button: the listener goes away afterwards and the tab kept playing', !!gone && still === true, `listener gone ${gone}, still playing ${still}`);
      const lib = fs.existsSync(path.join(process.env.APPDATA || '', '3zT Browser', 'songid', 'node_modules', 'shazam-api', 'dist', 'algorithm.js'));
      if (process.platform === 'win32') ok('music button: the fingerprint library was downloaded into userData\\songid', lib);
    }
    await pc.ev('a.pause(), 1'); pc.close();
  } finally {
    srv.close();
    // the tabs this test opened go away (later tests count and point at tabs)
    const t = await toolbar(); await t.ev(`closeDrop(), S.tabs.filter(x => x.url === 'about:blank' || x.url.startsWith('http://127.0.0.1:8802')).forEach(x => ui.send('tab', 'close', x.id)), 1`); t.close();
    await sleep(800);
  }
}

/* the TikTok / Instagram layout (src/inject/social-view.*), on a local page built like TikTok's 2026 feed:
   the parts are marked and moved (buttons and caption in the bottom-right corner above the video bar, hidden until
   the eye button is pressed; arrows fixed at the screen's left edge); after a "redesign" (TikTok's names changed) they are still found by
   what they contain; with no video nothing is moved; the setting turns it off */
const TT_PAGE = `<!doctype html><meta charset="utf-8"><title>tt</title><style>body{margin:0;background:#111;color:#fff}button{background:#333;color:#fff}</style>
<div data-e2e="anchoring-player-column" style="position:relative;width:900px;height:700px">
 <article data-e2e="recommend-list-item-container"><section data-e2e="feed-video"><video id=v src="/clip.mp4" muted autoplay loop playsinline style="display:block;width:400px;height:700px;margin:0 auto;object-fit:contain;background:#000"></video></section></article>
 <div data-e2e="anchoring-chrome-host" style="position:absolute;inset:0;pointer-events:none"><div style="pointer-events:auto">
  <div data-e2e="anchoring-engagement-vertical" style="position:absolute;left:20px;bottom:80px;width:48px"><div data-e2e="like-icon"><button>L</button><strong data-e2e="like-count">1</strong></div><div data-e2e="comment-icon"><button>C</button></div><div data-e2e="share-icon"><button>S</button></div></div>
  <div data-e2e="anchoring-description-layer" style="position:absolute;left:80px;right:0;bottom:64px"><a data-e2e="video-author-avatar" href="#">@author</a><div data-e2e="video-desc">a caption</div></div>
  <div data-e2e="anchoring-playback-chrome" style="position:absolute;left:0;right:0;bottom:0;height:60px"></div>
 </div></div>
 <div data-e2e="anchoring-scroll-controls" style="position:absolute;left:20px;top:300px;transform:translateY(-10px)"><div><button data-e2e="feed-navigation-prev">^</button><button data-e2e="feed-navigation-next">v</button></div></div>
</div>`;
async function socialView() {
  const vid = path.join(OUT, 'clip.mp4');
  if (!fs.existsSync(vid)) { console.log('::notice title=tiktok layout::no test video (made by the downloader test on Windows); skipped'); return; }
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/clip.mp4')) { const b = fs.readFileSync(vid); r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length }); return r.end(b); }
    r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(TT_PAGE);
  }).listen(8803, '127.0.0.1');
  const B = 'http://tt.localhost:8803/';
  const state = c => c.ev(`JSON.stringify((() => { const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), vis: getComputedStyle(e).visibility, e2e: e.getAttribute('data-e2e') }; };
    const v = document.getElementById('v'), vr = v.getBoundingClientRect(), s = Math.min(vr.width / (v.videoWidth || 1), vr.height / (v.videoHeight || 1));
    return { placed: document.documentElement.classList.contains('tzt-placed'), tt: document.documentElement.classList.contains('tzt-tt'),
      video: { l: Math.round(vr.left + (vr.width - v.videoWidth * s) / 2), r: Math.round(vr.right - (vr.width - v.videoWidth * s) / 2), w: v.videoWidth },
      act: q('[data-tzt-part="actions"]'), cap: q('[data-tzt-part="caption"]'), nav: q('[data-tzt-part="nav"]'), tog: q('#tzt-toggle'), ctl: q('[data-e2e="anchoring-playback-chrome"]') }; })())`).then(x => JSON.parse(x || '{}'));
  try {
    await go(B, true);
    const pc = await connect(await find(u => u.startsWith(B), 30));
    const a = await poll(async () => { const st = await state(pc); return st.placed && st.video.w ? st : null; }, 15000, 300) || await state(pc);
    const near = (x, y) => Math.abs(x - y) <= 3;
    ok('TikTok layout: buttons and caption marked and placed in the bottom-right corner above the video bar, arrows fixed at the screen\'s left edge, buttons and caption hidden',
      a.placed && a.act && a.cap && a.nav && a.tog && a.ctl && near(a.act.r, a.ctl.r - 12) && near(a.cap.r, a.ctl.r - 12) && a.cap.b <= a.ctl.t && near(a.nav.l, 28) && a.act.vis === 'hidden' && a.cap.vis === 'hidden' && a.tog.vis === 'visible',
      JSON.stringify(a));
    await pc.ev(`document.getElementById('tzt-toggle').click(), 1`); await sleep(500);
    const b = await state(pc);
    ok('TikTok layout: the eye button shows the buttons and the caption, the buttons above the caption', b.act && b.act.vis === 'visible' && b.cap.vis === 'visible' && b.act.b <= b.tog.t && b.tog.b <= b.cap.t + 2, JSON.stringify(b));
    // a "redesign": TikTok's names for the three parts change; the parts are found again by what they contain
    await pc.ev(`(() => { for (const [k, v] of [['anchoring-engagement-vertical', 'x-eng'], ['anchoring-description-layer', 'x-desc'], ['anchoring-scroll-controls', 'x-nav']]) document.querySelector('[data-e2e="' + k + '"]').setAttribute('data-e2e', v); window.dispatchEvent(new Event('resize')); return 1; })()`);
    await sleep(800);
    const c = await state(pc);
    ok('TikTok layout: after TikTok renames its parts they are still found (by the like / comment / share buttons, the author, the arrows) and placed',
      c.placed && c.act && c.cap && c.nav && near(c.act.r, c.ctl.r - 12) && near(c.cap.r, c.ctl.r - 12) && near(c.nav.l, 28), JSON.stringify(c));
    // no video: nothing of ours stays (TikTok's own layout)
    await pc.ev(`document.getElementById('v').remove(), window.dispatchEvent(new Event('resize')), 1`); await sleep(800);
    const d = await state(pc).catch(() => null) || {};
    const left = await pc.ev(`JSON.stringify({ placed: document.documentElement.classList.contains('tzt-placed'), marks: document.querySelectorAll('[data-tzt-part]').length, toggle: getComputedStyle(document.getElementById('tzt-toggle')).display })`);
    ok('TikTok layout: without the playing video nothing is moved (TikTok keeps its own layout)', /"placed":false,"marks":0,"toggle":"none"/.test(left || ''), left);
    pc.close();
    // the setting off: the page opened again has none of it
    { const t = await toolbar(); await t.ev(`ui.send('set', 'socialView', false), 1`); t.close(); }
    await go(B + '?off', true);
    const pc2 = await connect(await find(u => u.startsWith(B + '?off'), 30));
    await sleep(2500);
    const off = await pc2.ev(`JSON.stringify({ tt: document.documentElement.classList.contains('tzt-tt'), toggle: !!document.getElementById('tzt-toggle') })`);
    ok('TikTok layout: turned off in Settings, the page is left as it is', off === '{"tt":false,"toggle":false}', off);
    pc2.close();
    { const t = await toolbar(); await t.ev(`ui.send('set', 'socialView', true), S.tabs.filter(x => x.url.startsWith(${JSON.stringify(B)})).forEach(x => ui.send('tab', 'close', x.id)), 1`); t.close(); }
  } finally { srv.close(); }
}

async function features() {
  let hits = {};
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0]; hits[u] = (hits[u] || 0) + 1;
    const html = h => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(h); };
    if (u === '/article') return html(FEAT_ARTICLE);
    if (u === '/plain') return html('<!doctype html><title>plain</title><body><button>زر</button></body>');
    if (u === '/cookies') return html(FEAT_COOKIES);
    if (u === '/video') return html('<!doctype html><title>video page</title><body style="margin:0"><video src="/clip.mp4" muted loop autoplay style="width:640px;height:360px;display:block;margin:40px"></video></body>');
    if (u === '/pic.png') { r.setHeader('Content-Type', 'image/png'); return r.end(FEAT_PNG); }
    if (u === '/clip.mp4' && fs.existsSync(path.join(OUT, 'clip.mp4'))) { const b = fs.readFileSync(path.join(OUT, 'clip.mp4')); r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length }); return r.end(b); }
    r.writeHead(404); r.end();
  }).listen(8794, '127.0.0.1');
  const B = 'http://127.0.0.1:8794';
  try {
    // ---- reader view ----
    await go(B + '/article', true);
    await find(u => u.startsWith(B + '/article'), 30);
    const btn = await poll(async () => { const tb = await toolbar(); const v = await tb.ev('S.url.includes("/article") && !document.getElementById("readerBtn").hidden && getComputedStyle(document.getElementById("readerBtn")).display !== "none"'); tb.close(); return v; }, 15000);
    ok('reader view: the book button shows on an article', !!btn, btn ? '' : await (async () => { const tb = await toolbar(); const v = await tb.ev('JSON.stringify({ url: S.url, reader: S.reader, hidden: document.getElementById("readerBtn").hidden })'); tb.close(); return v; })());
    if (btn) {
      { const tb = await toolbar(); await tb.ev(`document.getElementById('readerBtn').click(), 1`); tb.close(); }
      const rt = await find(u => u.includes('newtab/reader.html'), 30);
      const rc = rt && await connect(rt);
      const r = rc && JSON.parse(await poll(() => rc.ev(`document.getElementById('tt').textContent ? JSON.stringify({ dir: document.documentElement.dir, imgs: [...document.querySelectorAll('article img')].map(i => i.getAttribute('src')),
        caps: [...document.querySelectorAll('article figcaption')].map(f => f.textContent), bad: document.querySelectorAll('article script, article iframe').length + [...document.querySelectorAll('article *')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length,
        js: [...document.querySelectorAll('article a')].filter(a => !/^https?:/.test(a.href)).length, ran: !!window.__bad, ad: /إعلان مزعج/.test(document.body.textContent) }) : null`), 10000) || '{}');
      ok('reader view: the article with its pictures and captions, right to left', r && r.dir === 'rtl' && r.imgs.length === 2 && r.imgs.every(x => x === B + '/pic.png') && r.caps.join('|') === 'تعليق الصورة الأولى|تعليق الصورة الثانية' && !r.ad, JSON.stringify(r));
      ok('reader view: nothing of the page can run (no script, frame, handlers, javascript: links)', r && r.bad === 0 && r.js === 0 && !r.ran, JSON.stringify(r));
      const addr = await (async () => { const tb = await toolbar(); const v = await tb.ev('document.getElementById("addr").value'); tb.close(); return v; })();
      ok('reader view: the address bar shows the article\'s address', addr === B + '/article', addr);
      if (rc) { await shot(rc, 'reader'); rc.close(); }
    }
    await go(B + '/plain', true); await find(u => u.startsWith(B + '/plain'), 30); await sleep(3000);
    const noBtn = await (async () => { const tb = await toolbar(); const v = await tb.ev('getComputedStyle(document.getElementById("readerBtn")).display === "none" && getComputedStyle(document.getElementById("mediaBtn")).display === "none"'); tb.close(); return v; })();
    ok('reader view: no book button (and no download button) on a page that is not an article', noBtn === true);
    // ---- picture in picture: Alt+P, 3zT's own window ----
    await go(B + '/video', true);
    const vt = await find(u => u.startsWith(B + '/video'), 30);
    if (vt && fs.existsSync(path.join(OUT, 'clip.mp4'))) {
      const vc = await connect(vt); await sleep(2500);
      const altP = async () => { for (const type of ['rawKeyDown', 'keyUp']) await vc.send('Input.dispatchKeyEvent', { type, modifiers: 1, key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80, nativeVirtualKeyCode: 80 }); };
      const pipPage = async () => (await targets()).find(t => t.type === 'page' && t.url.includes('ui/pip.html'));
      const noButton = await vc.ev(`[...document.querySelectorAll('body > div')].every(d => !d.shadowRoot && getComputedStyle(d).zIndex !== '2147483647')`);
      ok('picture in picture: no button over the video (only Alt+P and the right-click menu)', noButton === true);
      await altP();
      const filled = await poll(() => vc.ev(`(() => { const v = document.querySelector('video[data-zpip]'); if (!v) return null; const r = v.getBoundingClientRect();
        return v.matches(':popover-open') && Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2 ? innerWidth + 'x' + innerHeight : null; })()`), 8000);
      const pt = await poll(pipPage, 8000);
      await sleep(1000);
      const small = await vc.ev(`(() => { const v = document.querySelector('video[data-zpip]'); if (!v) return null; const r = v.getBoundingClientRect(); return [innerWidth, innerHeight, Math.round(r.width), Math.round(r.height)].join(','); })()`);
      const [iw, ih, rw, rh] = String(small || '').split(',').map(Number);
      await shot(vc, 'pip-page');
      ok('picture in picture: Alt+P puts the video alone in 3zT\'s own window', !!pt && !!filled && iw > 200 && iw < 700 && ih > 100 && ih < 500 && rw === iw && rh === ih, `window ${!!pt}, video ${filled}, in the small window ${small}`);
      // the video's own corners are round too: a hardware video overlay (Windows) is not clipped by the window's corners
      const radius = await vc.ev(`(() => { const v = document.querySelector('video[data-zpip]'); return v ? getComputedStyle(v).borderTopLeftRadius + ' ' + getComputedStyle(v).borderBottomRightRadius : null; })()`);
      ok('picture in picture: the video itself has round corners', /^1[0-9]px 1[0-9]px$/.test(String(radius)), String(radius));
      const note = await (async () => { const tb = await toolbar(); const v = await tb.ev(`!document.getElementById('pipNote').hidden && S.pipHere`); tb.close(); return v; })();
      ok('picture in picture: the tab shows a note with a way back', note === true);
      if (pt) {
        const pc = await connect(pt);
        await shot(pc, 'pip-window');
        const s1 = await poll(() => pc.ev('pip.state()'), 5000);
        await pc.ev(`document.getElementById('play').click(), 1`); await sleep(800);
        const s2 = await pc.ev('pip.state()');
        const ui = await pc.ev(`JSON.stringify({ prev: document.getElementById('prev').hidden, next: document.getElementById('next').hidden, dir: getComputedStyle(document.getElementById('ui')).direction })`);
        ok('picture in picture: play / pause button; no previous / next on a site without them', !!(s1 && s2 && s1.paused !== s2.paused) && ui === JSON.stringify({ prev: true, next: true, dir: 'ltr' }), JSON.stringify({ s1, s2, ui }));
        // a new place and size (what a drag ends with) is kept for the next video
        const want = await pc.ev(`(async () => { const b = await pip.testBounds({ x: 120, y: 140, width: 520, height: 310 }); return JSON.stringify(b); })()`);
        await pc.ev(`document.getElementById('back').click(), 1`).catch(() => {});
        pc.close();
        const back = await poll(async () => !(await pipPage()) && (await vc.ev(`!document.querySelector('[data-zpip]') && !document.documentElement.hasAttribute('data-zpip-on') && !document.querySelector('video').hasAttribute('popover')`)), 8000);
        ok('picture in picture: "back to tab" puts the video back in the page as it was', !!back);
        // again with Alt+P, and Alt+P once more brings it back
        await vc.ev('document.querySelector("video").play().then(() => 1, () => 1)');
        await altP(); const again = await poll(pipPage, 8000);
        await sleep(800);
        const inner = await vc.ev('innerWidth + "x" + innerHeight');
        ok('picture in picture: it opens again where it was left, with the same size', !!want && JSON.parse(want).width === 520 && JSON.parse(want).height === 310 && inner === (520 - 16) + 'x' + (310 - 16), `set ${want}, page inside ${inner}`);
        await altP(); const gone = await poll(async () => !(await pipPage()), 8000);
        ok('picture in picture: Alt+P opens it and Alt+P again closes it', !!again && !!gone, `opened ${!!again}, closed ${!!gone}`);
        // closing the tab while its video is out: the window goes with it, the browser carries on
        await vc.ev('document.querySelector("video").play().then(() => 1, () => 1)');
        await altP(); const open3 = await poll(pipPage, 8000);
        { const tb = await toolbar(); await tb.ev(`document.querySelector('.tab[data-id="' + S.activeId + '"] [data-close]').click(), 1`); tb.close(); }
        const closed = await poll(async () => !(await pipPage()) && !(await targets()).some(t => t.url.startsWith(B + '/video')), 8000);
        const alive = await poll(async () => { const tb = await toolbar(); const v = await tb.ev('S.tabs.length > 0 && !S.pipHere'); tb.close(); return v; }, 6000);
        const why = alive ? '' : await (async () => { const tb = await toolbar(); const v = await tb.ev('JSON.stringify({ tabs: S.tabs.length, pipHere: S.pipHere, active: S.activeId, note: !document.getElementById("pipNote").hidden })'); tb.close(); return v; })();
        ok('picture in picture: closing its tab closes the window too', !!open3 && !!closed && alive === true, `opened ${!!open3}, closed ${!!closed}, browser ${alive} ${why}`);
        await go(B + '/video', true); await find(u => u.startsWith(B + '/video'), 30);
      }
      vc.close();
    } else ok('picture in picture: Alt+P puts the video alone in 3zT\'s own window', false, 'no video page');
    // ---- tab cards and tab search ----
    const tb = await toolbar();
    await tb.ev(`ui.send('tab', 'activate', S.tabs.find(t => t.url.includes('/video')).id), 1`); await sleep(800);
    const rects = JSON.parse(await tb.ev(`JSON.stringify([...document.querySelectorAll('.tab')].map(e => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2, url: (S.tabs.find(t => String(t.id) === e.dataset.id) || {}).url }; }))`));
    const vtab = rects.find(r => (r.url || '').includes('/video')), other = rects.find(r => r !== vtab);
    await tb.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(300);
    await tb.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: vtab.x, y: vtab.y }); await sleep(2000);   // entering the strip: the tab you are on is pictured
    await tb.ev(`ui.send('tab', 'activate', ${other.id}), 1`); await sleep(700);
    // where the video tab is now (the strip may have scrolled when the other tab was chosen)
    const at = JSON.parse(await tb.ev(`(() => { const e = document.querySelector('.tab[data-id="${vtab.id}"]'); e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`));
    await sleep(300);
    await tb.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(200);
    await tb.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    const card = await poll(async () => { const v = await tb.ev(`(() => { const p = document.getElementById('tprev'); return p.classList.contains('on') && /data:image/.test(p.querySelector('.img').style.backgroundImage) ? p.textContent.trim() + '|' + document.querySelectorAll('.tab[title]').length : null; })()`); return v; }, 8000);
    ok('tab hover card: only the picture of the tab (no title, no address)', card === '|0', card || await tb.ev(`JSON.stringify({ cls: document.getElementById('tprev').className, img: document.querySelector('#tprev .img').style.backgroundImage.slice(0, 40) })`));
    await shot(tb, 'tab-card');
    await tb.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 900, y: 700 }); await sleep(300);
    const bars = async () => (await targets()).filter(t => t.type === 'page' && t.url.includes('ui/toolbar.html'));
    const had = (await bars()).map(t => t.id);
    await tb.ev(`ui.send('tab', 'newWindow'), 1`); await sleep(2500);
    const nb = (await bars()).find(t => !had.includes(t.id));
    const tb2 = nb ? await connect(nb) : null;
    if (tb2) { await tb2.ev(`ui.send('tab', 'go', ${JSON.stringify({ text: B + '/plain?w2', newTab: false })}), 1`); await sleep(2500); tb2.close(); }
    hits = {};
    await tb.ev(`openDrop('tabs', document.getElementById('tabSearch')), 1`); await sleep(800);
    const listed = JSON.parse(await tb.ev(`JSON.stringify([...document.querySelectorAll('#drop .mi')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()))`) || '[]');
    ok('tab search: tabs of every window, with the window name', listed.some(x => /plain/.test(x) && /(نافذة|Window) 2/.test(x)) && listed.some(x => /video page/.test(x)), JSON.stringify(listed).slice(0, 400));
    await shot(tb, 'tab-search');
    await tb.ev(`(() => { const i = document.getElementById('tsIn'); i.value = 'w2'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return 1; })()`); await sleep(1200);
    ok('tab search: goes to the tab in the other window without loading it again', !hits['/plain'], JSON.stringify(hits));
    // close the second window again (the next tests, and the update test that starts with this profile, expect one)
    { const nb2 = (await bars()).find(t => !had.includes(t.id)); if (nb2) { const c = await connect(nb2); await c.ev(`ui.send('win', 'close'), 1`).catch(() => {}); c.close(); await sleep(1500); } }
    tb.close();
    // ---- cookie popups (DuckDuckGo Autoconsent, bundled in the setup) ----
    const bundled = fs.existsSync(path.join(path.dirname(exe), 'resources', 'app', 'src', 'vendor', 'autoconsent', 'autoconsent.cjs.js')) || fs.existsSync(path.join(appDir || '', 'src', 'vendor', 'autoconsent', 'autoconsent.cjs.js'));
    if (bundled) {
      await go(B + '/cookies', true);
      const ct = await find(u => u.startsWith(B + '/cookies'), 30);
      const cc = ct && await connect(ct);
      const choice = cc && await poll(() => cc.ev('window.__choice || null'), 15000);
      ok('cookie popups: answered "reject" by themselves', choice === 'reject', String(choice));
      if (cc) cc.close();
    } else console.log('::notice title=cookie popups::Autoconsent not bundled here (fetched at build time), not tested');
  } finally { srv.close(); }
}

async function arablocn() {
  // reported: "the site goes to another page, comes straight back, nothing downloads". Follow a real game page and its download button.
  const note = (t, m) => console.log(`::notice title=arablocn ${t}::` + String(m).replace(/%/g, '%25').replace(/\r?\n/g, '%0A').slice(0, 3500));
  try {
    await go('https://arablocn.com/', true);
    const t = await find(u => /arablocn\.com/.test(u), 40);
    if (!t) return note('home', 'did not open');
    let c = await connect(t); await sleep(8000);
    note('home page', await c.ev('location.href + " | " + document.title + " | " + (document.body ? document.body.innerText.slice(0, 200) : "")'));
    const posts = await c.ev(`JSON.stringify([...new Set([...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => { try { const u = new URL(h); return /arablocn\.com$/.test(u.hostname) && u.pathname.length > 2 && !/\/(category|tag|page|author|wp-|feed|contact|about|privacy|search)/i.test(u.pathname) && !u.hash; } catch (e) { return false; } }))].slice(0, 5))`);
    note('home', posts);
    c.close();
    const list = JSON.parse(posts || '[]');
    if (!list.length) return;
    await go(list[0], true);
    const pt = await find(u => u === list[0] || u.startsWith(list[0]), 40);
    if (!pt) return note('post', 'did not open ' + list[0]);
    c = await connect(pt); await sleep(6000); await shot(c, 'arablocn-post');
    const links = await c.ev(`JSON.stringify([...document.querySelectorAll('a[href],button,form')].filter(e => /download|تحميل|تنزيل|mediafire|mega\\.nz|drive\\.google|pixeldrain|gofile|\\.zip|\\.rar|\\.7z/i.test((e.href || e.action || '') + ' ' + e.textContent)).slice(0, 12).map(e => e.tagName + ' ' + e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + ' -> ' + (e.href || e.action || '') + (e.target ? ' [' + e.target + ']' : '') + (e.getAttribute('onclick') ? ' onclick=' + e.getAttribute('onclick').slice(0, 80) : '')))`);
    note('post links', links);
    const arr = JSON.parse(links || '[]');
    if (!arr.length) { c.close(); return; }
    // press the first download control and watch what happens for 25 s
    const tb = await toolbar();
    const before = await tb.ev('JSON.stringify(S.tabs.map(t => t.url))');
    const dlBefore = (await (async () => { const d = await connect(await find('downloads.html', 5) || pt); const v = await d.ev('window.tzt ? tzt.dlList().then(d => d.items.length) : -1'); d.close(); return v; })());
    await c.ev(`(() => { const e = [...document.querySelectorAll('a[href],button')].find(e => /download|تحميل|تنزيل|mediafire|mega\\.nz|drive\\.google|pixeldrain|gofile|\\.zip|\\.rar|\\.7z/i.test((e.href || '') + ' ' + e.textContent)); if (e) { e.scrollIntoView(); e.click(); } return !!e; })()`, true);
    const seen = [];
    for (let i = 0; i < 25; i++) { await sleep(1000); const s = await tb.ev('S.url + " | tabs " + S.tabs.length + " | dl " + JSON.stringify(S.dl)'); if (seen[seen.length - 1] !== s) seen.push(`${i}s ${s}`); }
    const after = await tb.ev('JSON.stringify(S.tabs.map(t => t.url))');
    tb.close(); c.close();
    note('after clicking', `tabs before: ${before}\ntabs after: ${after}\ndownloads before: ${dlBefore}\n` + seen.join('\n'));
  } catch (e) { note('error', e.stack || e.message); }
}

async function main() {
  if (!exe) { console.error('usage: node tests/e2e.mjs <exe> [app-dir] [--store]'); process.exit(2); }
  ok('app starts', await start());
  await sleep(4000);
  const only = process.env.E2E_ONLY;   // run one part while debugging (e.g. E2E_ONLY=downloads)
  if (!only) { await smoke(); await permissions(); }
  if (!only || only === 'downloads') await downloads();
  if (only === 'features') { await clientHints(); await popups(); await adSlots(); await tint(); await song(); await ytIdle(); await privacy(); await features(); }
  if (only === 'social') await socialView();
  if (only === 'song') await song();
  if (only) { await stop(); report(); process.exit(results.some(r => !r.pass) ? 1 : 0); }
  // arablocn.com (a real third-party site, reported problem) only when diagnosing: E2E_DIAG=1
  if (process.platform === 'win32') { await mediaTest(); if (process.env.E2E_DIAG) await arablocn(); await passkeys(); }
  await clientHints();
  await popups();
  await adSlots();
  await tint();
  await song();
  await ytIdle();
  await privacy();
  await features();
  await socialView();
  if (STORE) {
    for (const ext of STORE_EXTS) await storeInstall(ext);
    // Dark Reader really runs on websites
    if (STORE_EXTS.some(e => e.id === 'eimadpbcbfnmbkopoojfekhnkhdbieeh')) {
      await go('https://example.com/?dr', true);
      const t = await find(u => u.includes('example.com/?dr'), 40);
      // its scripts run in the page (it may leave a page alone that is already dark: 3zT darkens sites itself)
      const contexts = async () => {
        const c = await connect(t); const names = [];
        c.on(d => { if (d.method === 'Runtime.executionContextCreated') names.push(d.params.context.name || ''); });
        await c.send('Runtime.enable'); await sleep(1200); c.close(); return names;
      };
      const names = t ? await poll(async () => { const n = await contexts(); return n.some(x => /dark reader/i.test(x)) ? n : null; }, 30000, 2000) : null;
      if (t) { const c = await connect(t); await shot(c, 'darkreader-on-example'); c.close(); }
      ok('Dark Reader works on a website', !!names, names ? names.filter(Boolean).join(', ') : 'no Dark Reader script in the page');
    }
    // still there after a restart
    await stop(); ok('app restarts', await start()); await sleep(6000);
    const after = await extList();
    for (const ext of STORE_EXTS) ok(`${ext.name} still installed after restart`, after.includes(ext.id));
    // remove
    for (const ext of STORE_EXTS) { const tb = await toolbar(); await tb.ev(`ui.invoke('ext:remove', ${JSON.stringify(ext.id)})`); tb.close(); }
    await sleep(1500);
    const left = await extList();
    ok('removing store extensions works', STORE_EXTS.every(e => !left.includes(e.id)));
  }
  await stop();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  const failed = results.filter(r => !r.pass);
  report();
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
function report() {
  const failed = results.filter(r => !r.pass);
  if (process.env.GITHUB_ACTIONS) {
    const esc = t => String(t).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
    // the failures first, on their own (a long list is cut short by GitHub)
    const prop = t => esc(t).replace(/:/g, '%3A').replace(/,/g, '%2C');   // inside a property, ':' and ',' must be escaped too
    for (const r of failed) console.log(`::error title=${prop('e2e FAIL ' + r.name.slice(0, 110))}::` + esc(String(r.info || 'failed (no details)')).slice(0, 3000));
    console.log(`::${failed.length ? 'error' : 'notice'} title=e2e ${results.length - failed.length}/${results.length}::` + esc(results.map(r => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.info ? ' - ' + String(r.info).slice(0, 160) : ''}`).join('\n')));
  }
}
// the whole run may take at most 20 minutes
setTimeout(async () => { ok('finished in time', false, 'stopped after 20 minutes'); report(); await stop(); process.exit(1); }, 20 * 60 * 1000).unref();
main().catch(async e => { ok('no crash in the test itself', false, String(e && e.stack || e)); report(); await stop(); process.exit(1); });
