// End-to-end checks for 3zT, driven over the Chrome DevTools Protocol.
//
//   node tests/e2e.mjs <path-to-exe-or-electron> [app-dir] [--store]
//
// What it checks:
//   smoke   : the window opens, the toolbar and every internal page load with no script errors
//   --store : installs Dark Reader and uBlock Origin Lite from the real Chrome Web Store
//             ("Add to Chrome" button), checks they run on a website, survive a restart,
//             and can be removed again
// Exit code 0 = all passed. Screenshots go to tests/out/.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
async function start() {
  const args = [...(appDir ? [appDir] : []), `--remote-debugging-port=${PORT}`, ...extraArgs];
  child = spawn(exe, args, { env: { ...process.env, ZEUS_E2E: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
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
  ok(`"Add to Chrome" button shows for ${ext.name}`, !!ready, ready ? '' : String(await c.ev('document.body && document.body.innerText.slice(0, 300)')));
  if (!ready) { c.close(); return; }
  await c.ev(`(${btn}).click(), 1`);
  const installed = await poll(async () => (await extList()).includes(ext.id), 120000, 1500);
  await sleep(2500); await shot(c, `store-${ext.id}-after`);
  const label = await c.ev(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /chrome|3zt|remove|إزالة/i.test(t)).join(' / ')`);
  ok(`${ext.name} installs from the Chrome Web Store`, !!installed, `store button now: "${label}"`);
  c.close();
}

async function main() {
  if (!exe) { console.error('usage: node tests/e2e.mjs <exe> [app-dir] [--store]'); process.exit(2); }
  ok('app starts', await start());
  await sleep(4000);
  await smoke();
  if (STORE) {
    for (const ext of STORE_EXTS) await storeInstall(ext);
    // Dark Reader really runs on websites
    if (STORE_EXTS.some(e => e.id === 'eimadpbcbfnmbkopoojfekhnkhdbieeh')) {
      await go('https://example.com/?dr', true);
      const t = await find(u => u.includes('example.com/?dr'), 40);
      const dark = t && await poll(async () => { const c = await connect(t); const v = await c.ev(`!!document.querySelector('style.darkreader, .darkreader')`); c.close(); return v; }, 30000);
      if (t) { const c = await connect(t); await shot(c, 'darkreader-on-example'); c.close(); }
      ok('Dark Reader works on a website', !!dark);
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
