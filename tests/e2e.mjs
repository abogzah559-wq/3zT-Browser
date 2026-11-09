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
  child = spawn(exe, args, { env: { ...process.env, ZEUS_E2E: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const pages = [['zeus://settings', 'settings.html'], ['zeus://downloads', 'downloads.html'], ['zeus://history', 'history.html'], ['zeus://passwords', 'passwords.html'], ['zeus://tasks', 'tasks.html'], ['', 'newtab.html']];
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
    let tb = await pageBar(); await tb.ev(`document.getElementById('shield').click(), 1`); await sleep(600);
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
      if (u.pathname === '/slow') { r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': att('slow.bin'), 'Content-Length': 50 * 1024 * 1024 }); const t = setInterval(() => r.write(Buffer.alloc(16 * 1024)), 200); r.on('close', () => clearInterval(t)); return; }
      r.writeHead(404); r.end();
    });
  }).listen(8791, '127.0.0.1');
}
async function downloads() {
  const srv = dlServer();
  try {
    await go('zeus://downloads', true);
    const dp = await connect(await find('downloads.html', 30));
    await dp.ev(`zeus.set('dlAsk', false), 1`); await sleep(500);
    const list = () => dp.ev(`zeus.dlList().then(d => d.items.map(x => ({ name: x.name, state: x.state, path: x.path, received: x.received, total: x.total, exists: x.exists, canResume: x.canResume, id: x.id })))`);
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
    if (cut && cut.state === 'interrupted') await dp.ev(`zeus.dlAct(${JSON.stringify(cut.id)}, 'resume')`);
    const res = cut && await done('resume.bin');
    const okBytes = res && fs.existsSync(res.path) && fs.statSync(res.path).size === BIG.length && fs.readFileSync(res.path).equals(BIG);
    ok('a connection that breaks half way: the file is finished intact (Range resume)', !!okBytes, cut ? `${cut.state === 'interrupted' ? 'stopped, resumed by hand' : 'picked up again by itself'}` : 'no download');
    await page.ev('slowDl(), 1', true);
    const slow = await poll(async () => (await list()).find(x => x.name === 'slow.bin' && x.state === 'progressing'), 15000);
    if (slow) await dp.ev(`zeus.dlAct(${JSON.stringify(slow.id)}, 'cancel')`);
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
    await dp.ev(`zeus.set('dlAsk', true), 1`);
    page.close(); dp.close();
  } finally { srv.close(); }
}

/* ================= built-in media downloader (real tools, fetched and checked on first use) ================= */
async function mediaTest() {
  const vid = path.join(OUT, 'clip.mp4');
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/clip.mp4') && fs.existsSync(vid)) { const b = fs.readFileSync(vid); r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length }); return r.end(b); }
    if (q.url === '/watch') { r.setHeader('Content-Type', 'text/html'); return r.end('<title>watch</title><video src="/clip.mp4" controls width=640 height=360></video>'); }
    r.writeHead(404); r.end();
  }).listen(8792, '127.0.0.1');
  try {
    await go('zeus://downloads', true);
    const dp = await connect(await find('downloads.html', 30));
    // the downloader has its own window (opened here from the downloads page; the address-bar button is tested below)
    await dp.ev('zeus.mediaWindow(), 1');
    const mp = await connect(await find('newtab/media.html', 30));
    await poll(() => mp.ev('typeof mstart === "function"'), 15000);
    const job = async (o, ms = 300000) => {
      const j = await mp.ev(`zeus.mediaStart(${JSON.stringify(o)})`);
      if (!j || j.error) return j;
      return poll(async () => { const s = await mp.ev(`zeus.mediaList().then(d => d.jobs.find(x => x.id === ${JSON.stringify(j.id)}))`); return s && s.state !== 'running' ? s : null; }, ms, 1500);
    };
    const tools = await mp.ev('zeus.mediaList().then(d => d.tools.ready)');
    ok('download tools come with the setup (ready at once)', tools === true);
    const yt = await job({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', mode: 'video', q: '360' });
    // real sites from a GitHub datacenter machine: YouTube often asks such machines to sign in, so this is reported, not required
    console.log(`::notice title=media youtube::${yt && yt.state} ${yt && (yt.error || yt.file || '')}`.replace(/\n/g, ' '));
    const mp3 = await job({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', mode: 'audio' });
    console.log(`::notice title=media youtube mp3::${mp3 && mp3.state} ${mp3 && (mp3.error || mp3.file || '')}`.replace(/\n/g, ' '));
    const tk = await job({ url: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', mode: 'video', q: 'best' });
    console.log(`::notice title=media tiktok::${tk && tk.state} ${tk && (tk.error || tk.file || '')}`.replace(/\n/g, ' '));
    const ph = await job({ url: 'https://www.tiktok.com/@yungfunnyvids/photo/7333434838539111712', mode: 'images' });
    console.log(`::notice title=media photos::${ph && ph.state} ${ph && (ph.error || (ph.items || []).length + ' items')}`.replace(/\n/g, ' '));
    // a local video made with the downloaded ffmpeg: download, trim exact and fast
    const ff = [path.join(path.dirname(exe), 'resources', 'tools', 'ffmpeg', 'ffmpeg.exe'), path.join(process.env.APPDATA || '', '3zT Browser', 'media', 'tools', 'ffmpeg', 'ffmpeg.exe')].find(f => fs.existsSync(f)) || '';
    if (fs.existsSync(ff)) execSync(`"${ff}" -loglevel error -y -f lavfi -i testsrc=size=640x360:rate=30 -f lavfi -i sine=frequency=440 -t 20 -c:v libx264 -g 60 -c:a aac -shortest "${vid}"`);
    const probe = f => { try { return +execSync(`"${ff.replace('ffmpeg.exe', 'ffprobe.exe')}" -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim(); } catch (e) { return 0; } };
    const inf = await mp.ev(`zeus.mediaInfo('http://127.0.0.1:8792/clip.mp4')`);
    ok('the link is shown before downloading (title, length)', !!(inf && !inf.error && inf.title && inf.duration > 19), JSON.stringify(inf).slice(0, 200));
    const lv = await job({ url: 'http://127.0.0.1:8792/clip.mp4', mode: 'video', q: 'best' }, 120000);
    ok('media download of a video link', !!(lv && lv.state === 'done' && lv.file && fs.existsSync(lv.file)), lv && (lv.error || lv.file));
    const tj = await job({ url: 'http://127.0.0.1:8792/clip.mp4', mode: 'video', q: 'best', trim: true }, 120000);
    ok('"pick a part before saving" waits with a preview file', !!(tj && tj.state === 'trim' && tj.temp && fs.existsSync(tj.temp)));
    if (tj && tj.state === 'trim') {
      const r = await mp.ev(`zeus.mediaTrim(${JSON.stringify(tj.id)}, { start: 5.3, end: 9.1, exact: true })`);
      const d = r && r.file ? probe(r.file) : 0;
      ok('frame-exact trim keeps exactly the chosen part', Math.abs(d - 3.8) < 0.15, `${d} s`);
    }
    const id = await dp.ev(`zeus.dlList().then(d => (d.items.find(x => x.media && /clip/.test(x.name) && !/\\(clip\\)/.test(x.name)) || {}).id)`);
    if (id) {
      const r = await dp.ev(`zeus.mediaTrimFile(${JSON.stringify(id)}, { start: 4, end: 12, exact: false })`);
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
    mp.close(); dp.close();
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
  r.frame = await new Promise(res => { addEventListener('message', e => res(e.data), { once: true }); const f = document.createElement('iframe'); f.src = 'http://127.0.0.1:8793/?frame'; document.body.appendChild(f); setTimeout(() => res('no answer'), 5000); });
  return JSON.stringify(r);
};
if (location.search.includes('frame')) timed(navigator.credentials.get({ publicKey: pk({ allowCredentials: [] }) }), 1500).then(v => parent.postMessage('background ' + v, '*'));
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
    await stop(); await start({ ZEUS_NO_PASSKEY_FIX: '1' }); await sleep(3000);
    await run('without fix');
    await stop(); await start(); await sleep(3000);
    const w = await run('with fix');
    ok('sign-in pages: background passkey requests do not open the Windows Security window', w.v.conditionalAvailable === false && /^rejected NotAllowedError/.test(w.v.immediate) && /^rejected NotAllowedError/.test(w.v.background) && w.v.conditionalAfter2s === 'waiting' && /rejected NotAllowedError/.test(w.v.frame || '') && !w.win, JSON.stringify(w));
    // a passkey request after a click still goes to Windows (its window opens, or the request at least is not refused at once)
    const c = await open();
    await c.ev('mine()', true);
    await sleep(3000);
    const res = await c.ev('res2'); const win = credUi();
    await c.ev('ac2.abort(), 1'); kill(); c.close();
    ok('a passkey you ask for (after a click) still reaches Windows', win || res === 'waiting', `window ${win}, request ${res}`);
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
    const dlBefore = (await (async () => { const d = await connect(await find('downloads.html', 5) || pt); const v = await d.ev('window.zeus ? zeus.dlList().then(d => d.items.length) : -1'); d.close(); return v; })());
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
  if (only) { await stop(); report(); process.exit(results.some(r => !r.pass) ? 1 : 0); }
  if (process.platform === 'win32') { await mediaTest(); await arablocn(); await passkeys(); }
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
    console.log(`::${failed.length ? 'error' : 'notice'} title=e2e ${results.length - failed.length}/${results.length}::` + esc(results.map(r => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.info ? ' - ' + r.info : ''}`).join('\n')));
  }
}
// the whole run may take at most 20 minutes
setTimeout(async () => { ok('finished in time', false, 'stopped after 20 minutes'); report(); await stop(); process.exit(1); }, 20 * 60 * 1000).unref();
main().catch(async e => { ok('no crash in the test itself', false, String(e && e.stack || e)); report(); await stop(); process.exit(1); });
