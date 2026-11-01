// Page-load speed: 3zT vs Google Chrome vs Brave (Windows CI).
//   node tests/speed.mjs <3zT.exe> [chrome.exe] [brave.exe]
// Each browser starts with a new profile and opens the same websites one after another,
// first with an empty cache (cold) and then again (warm). Times come from the page itself
// (Navigation Timing): when the page is usable (DOMContentLoaded) and fully loaded (load event).
// Two passes in opposite browser order; medians are reported. Writes tests/out/speed.md.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [zt, chrome, brave] = process.argv.slice(2);
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });
const SITES = ['https://en.wikipedia.org/wiki/Web_browser', 'https://github.com/microsoft/vscode', 'https://stackoverflow.com/questions',
  'https://www.bbc.com/news', 'https://www.cnn.com/', 'https://www.amazon.com/'];
const PORT = 9400;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { const s = a.filter(x => x > 0).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('timeout')), 10000); });
  let id = 0; const wait = new Map(); const ev = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else ev.forEach(f => f(d)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({}); } }, 45000); });
  return { send, on: f => ev.push(f), close: () => ws.close() };
}
const procName = exe => path.basename(exe, '.exe');
function kill(exe) { try { execSync(`taskkill /IM ${procName(exe)}.exe /T /F`, { stdio: 'ignore' }); } catch (e) {} }

async function run(label, exe) {
  if (!exe || !fs.existsSync(exe)) return null;
  kill(exe); await sleep(1500);
  const is3zt = label === '3zT';
  let args = [`--remote-debugging-port=${PORT}`];
  if (is3zt) { try { fs.rmSync(path.join(process.env.APPDATA, '3zT Browser'), { recursive: true, force: true }); } catch (e) {} }
  else args.push('--no-first-run', '--no-default-browser-check', '--disable-sync', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'spd-'))}`, 'about:blank');
  spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(500);
    try { const t = await targets(); page = t.find(x => x.type === 'page' && (is3zt ? x.url.includes('newtab.html') : !x.url.startsWith('chrome') && !x.url.startsWith('devtools'))); } catch (e) {}
  }
  if (!page) { kill(exe); return null; }
  await sleep(3000);   // let the browser settle
  const c = await connect(page);
  await c.send('Page.enable');
  const rows = [];
  for (const round of ['cold', 'warm']) {
    for (const url of SITES) {
      const loaded = new Promise(r => { const f = d => { if (d.method === 'Page.loadEventFired') r(); }; c.on(f); setTimeout(r, 30000); });
      await c.send('Page.navigate', { url });
      await loaded; await sleep(800);
      const r = await c.send('Runtime.evaluate', { expression: `(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? [Math.round(n.responseStart), Math.round(n.domContentLoadedEventEnd), Math.round(n.loadEventEnd), location.host] : null; })()`, returnByValue: true });
      const v = r.result && r.result.result && r.result.result.value;
      rows.push({ round, url, ttfb: v ? v[0] : 0, dcl: v ? v[1] : 0, load: v ? v[2] : 0 });
    }
  }
  c.close(); kill(exe); await sleep(2000);
  return { label, rows };
}

const all = [];
const order = [['3zT', zt], ['Google Chrome', chrome], ['Brave', brave]];
for (const pass of [order, [...order].reverse()]) for (const [l, e] of pass) { const r = await run(l, e); if (r) all.push(r); }
const by = {};
for (const r of all) (by[r.label] = by[r.label] || []).push(...r.rows);
let md = '| Browser | Usable, empty cache | Fully loaded, empty cache | Usable, cached | Fully loaded, cached |\n|---|---|---|---|---|\n';
const res = [];
for (const [label, rows] of Object.entries(by)) {
  const pick = (round, k) => median(rows.filter(x => x.round === round).map(x => x[k]));
  const o = { label, coldDcl: pick('cold', 'dcl'), coldLoad: pick('cold', 'load'), warmDcl: pick('warm', 'dcl'), warmLoad: pick('warm', 'load') };
  res.push(o);
  md += `| ${label} | ${o.coldDcl} ms | ${o.coldLoad} ms | ${o.warmDcl} ms | ${o.warmLoad} ms |\n`;
}
md += `\nMedian over ${SITES.length} websites × 2 passes (${SITES.map(u => new URL(u).host).join(', ')}).\n`;
fs.writeFileSync(path.join(OUT, 'speed.md'), md);
fs.writeFileSync(path.join(OUT, 'speed.json'), JSON.stringify({ res, all }, null, 1));
console.log(md);
if (process.env.GITHUB_ACTIONS) console.log('::notice title=speed::' + md.replace(/%/g, '%25').replace(/\n/g, '%0A'));
