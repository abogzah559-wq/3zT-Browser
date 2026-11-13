// Diagnosis on real sites (Windows test machine): the same pages in 3zT (as shipped, without the passkey patch,
// without the ad blocker) and in Chrome. Prints what each one shows sites about itself, Cloudflare Turnstile's
// result on photoroom.com, and what happens when an episode is opened on witanime.site.
//   node tests/sites-diag.mjs <3zT exe or electron> [app-dir]
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
const [APP, appDir] = process.argv.slice(2);
let exe = APP;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out'); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const note = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/%/g, '%25').replace(/\r?\n/g, ' | ').slice(0, 3000)}`);
let PORT = 9400, child = null, log = '';
const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(() => rej(new Error('timeout')), 10000); });
  let id = 0; const wait = new Map(), ev = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else ev.push(d); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({}); } }, 30000); });
  return { send, events: ev, ev: async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : (r.result && r.result.exceptionDetails ? 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300) : undefined); }, close: () => ws.close() };
}
async function find(match, tries = 60) { for (let i = 0; i < tries; i++) { try { const t = (await targets()).find(x => x.type === 'page' && match(x.url)); if (t) return t; } catch (e) {} await sleep(500); } return null; }
let kind = '3zt';
async function open(url) {
  if (kind === 'chrome') { await fetch(`http://127.0.0.1:${PORT}/json/new?${url}`, { method: 'PUT' }); return; }
  const tb = await connect(await find(u => u.includes('ui/toolbar.html')));
  await tb.ev(`ui.send('tab','go',${JSON.stringify({ text: url, newTab: true })}),1`); tb.close();
}
async function shot(c, name) { try { const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); } catch (e) {} }

const FP = `(async () => { const o = {};
  try { document.body.appendChild(null); } catch (e) { o.appendStack = String(e.stack).split('\\n').slice(0, 3).join(' / '); }
  try { o.tsAppend = Function.prototype.toString.call(Node.prototype.appendChild); } catch (e) { o.tsAppend = 'throws ' + e.message; }
  try { const f = document.createElement('iframe'); document.body.appendChild(f); const W = f.contentWindow; o.crossRealmToString = W.Function.prototype.toString.call(Function.prototype.toString); o.crossRealmAppend = W.Function.prototype.toString.call(Node.prototype.appendChild); o.sameToString = W.Function.prototype.toString === W.Function.prototype.toString; f.remove(); } catch (e) { o.iframe = 'err ' + e.message; }
  try { o.tsProto = 'prototype' in Function.prototype.toString; o.tsName = Function.prototype.toString.name; } catch (e) {}
  o.webdriver = navigator.webdriver; o.chrome = window.chrome ? Object.keys(window.chrome).join(',') : 'none';
  o.ua = navigator.userAgent; o.brands = navigator.userAgentData ? JSON.stringify(navigator.userAgentData.brands) : 'none';
  try { const h = await navigator.userAgentData.getHighEntropyValues(['fullVersionList', 'platformVersion']); o.fullVersionList = JSON.stringify(h.fullVersionList); o.platformVersion = h.platformVersion; } catch (e) {}
  o.plugins = navigator.plugins.length; o.mimes = navigator.mimeTypes.length; o.pdf = navigator.pdfViewerEnabled; o.languages = navigator.languages.join(',');
  o.notif = window.Notification ? Notification.permission : 'none';
  try { o.permNotif = (await navigator.permissions.query({ name: 'notifications' })).state; } catch (e) {}
  try { const g = document.createElement('canvas').getContext('webgl'); const x = g.getExtension('WEBGL_debug_renderer_info'); o.webgl = g.getParameter(x.UNMASKED_VENDOR_WEBGL) + ' | ' + g.getParameter(x.UNMASKED_RENDERER_WEBGL); } catch (e) { o.webgl = 'none'; }
  o.dark = matchMedia('(prefers-color-scheme: dark)').matches; o.pkc = typeof PublicKeyCredential; o.process = typeof process; o.require = typeof require;
  return JSON.stringify(o); })()`;

async function run(label) {
  log = '';
  if (kind === 'chrome') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-diag-'));
    child = spawn(exe, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    await sleep(5000);
  } else {
    child = spawn(exe, [...(appDir ? [appDir] : []), `--remote-debugging-port=${PORT}`], { env: { ...process.env, ZEUS_E2E: '1', ZEUS_LOG_BLOCKED: '1', ...(label.includes('no passkey') ? { ZEUS_NO_PASSKEY_FIX: '1' } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
    await find(u => u.includes('ui/toolbar.html'), 120); await sleep(4000);
    if (label.includes('no ad blocker')) { const tb = await connect(await find(u => u.includes('ui/toolbar.html'))); await tb.ev(`ui.send('set','adblock',false),1`); tb.close(); }
  }
  // 1. what the browser shows about itself
  await open('https://example.com/');
  let t = await find(u => u.startsWith('https://example.com'), 40);
  if (t) { const c = await connect(t); await sleep(2000); note(`${label}: fingerprint`, await c.ev(FP)); c.close(); }
  if (process.env.DIAG_FP_ONLY) { try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill(); } catch (e) {} await sleep(4000); PORT++; return; }
  // 2. Cloudflare Turnstile on photoroom
  await open('https://www.photoroom.com/tools/background-remover');
  t = await find(u => /photoroom\.com/.test(u), 40);
  if (t) {
    const c = await connect(t); await sleep(25000);
    const r = await c.ev(`JSON.stringify({ title: document.title, tokens: [...document.querySelectorAll('[name="cf-turnstile-response"]')].map(i => (i.value || '').length), frames: [...document.querySelectorAll('iframe')].map(f => (f.src || '').slice(0, 90)).filter(s => /cloudflare|turnstile/.test(s)), cfText: /verify you are human|تحقق من أنك إنسان/i.test(document.body.innerText) })`);
    await shot(c, `diag-photoroom-${label.replace(/\W+/g, '-')}`);
    note(`${label}: photoroom turnstile`, r); c.close();
  }
  // 3. witanime: the newest episode page
  await open('https://witanime.site/');
  t = await find(u => /witanime/.test(u), 40);
  if (t) {
    const c = await connect(t); await sleep(8000);
    const ep = await c.ev(`(() => { const a = [...document.querySelectorAll('a[href*="/watch/"], a[href*="/episode/"]')][0]; return a ? a.href : ''; })()`);
    note(`${label}: witanime home`, (await c.ev('location.href + " | " + document.title')) + ' | episode link ' + ep);
    c.close();
    if (ep) {
      const before = (await targets()).filter(x => x.type === 'page').map(x => x.url);
      await open(ep);
      const et = await find(u => u === ep || u.startsWith(ep.split('?')[0]), 40);
      if (et) {
        const c2 = await connect(et); await c2.send('Runtime.enable'); await c2.send('Page.enable'); await sleep(4000);
        // a click on the player, as a person would to start it
        const box = JSON.parse(await c2.ev(`(() => { const f = document.querySelector('iframe'); const r = (f || document.body).getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`) || '{"x":400,"y":300}');
        for (const type of ['mousePressed', 'mouseReleased']) await c2.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
        await sleep(15000);
        const r = await c2.ev(`JSON.stringify({ url: location.href, text: (document.querySelector('iframe') ? '' : '') + document.body.innerText.slice(0, 0), player: [...document.querySelectorAll('iframe')].map(f => (f.src || '').slice(0, 100)), msg: (document.body.innerText.match(/[^\\n]*(انتهت|الجلسة|expired|session|خطأ|error)[^\\n]*/i) || [''])[0].slice(0, 160) })`);
        const after = (await targets()).filter(x => x.type === 'page').map(x => x.url).filter(u => !before.includes(u) && u !== et.url);
        const errs = c2.events.filter(d => d.method === 'Runtime.exceptionThrown' || (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error')).map(d => d.method === 'Runtime.exceptionThrown' ? (d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text) : d.params.args.map(a => a.value || a.description).join(' ')).map(s => String(s).slice(0, 160)).slice(0, 8);
        const navs = c2.events.filter(d => d.method === 'Page.frameNavigated').map(d => d.params.frame.url.slice(0, 100)).slice(0, 10);
        await shot(c2, `diag-witanime-${label.replace(/\W+/g, '-')}`);
        note(`${label}: witanime episode`, `${r} | new tabs: ${JSON.stringify(after)} | frames: ${JSON.stringify(navs)} | errors: ${JSON.stringify(errs)}`);
        c2.close();
      } else note(`${label}: witanime episode`, 'did not open ' + ep);
    }
  }
  if (kind !== 'chrome') {
    const bl = log.split(/\r?\n/).filter(l => l.includes('[3zT] blocked') && /witanime|photoroom/.test(l)).map(l => l.replace(/.*\[3zT\] blocked /, ''));
    note(`${label}: blocked on these sites (${bl.length})`, bl.slice(0, 45).join('\n'));
  }
  try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill(); } catch (e) {}
  await sleep(4000); PORT++;
}
setTimeout(() => { note('diag', 'stopped after 14 minutes'); process.exit(0); }, 14 * 60 * 1000).unref();
(async () => {
  for (const label of ['3zT as shipped', '3zT no passkey patch', '3zT no ad blocker']) { try { await run(label); } catch (e) { note(label, 'error ' + (e && e.stack || e)); } }
  const chrome = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(f => fs.existsSync(f));
  if (chrome) { kind = 'chrome'; exe = chrome; try { await run('Chrome'); } catch (e) { note('Chrome', 'error ' + (e && e.stack || e)); } }
  else note('Chrome', 'not installed on this machine');
  process.exit(0);
})();
