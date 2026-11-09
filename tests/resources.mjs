// How much 3zT uses in everyday situations (Windows, GitHub machine: no graphics card, so GPU/VRAM are not measured).
//
//   node tests/resources.mjs <3zT.exe>
//
// For each situation: total of all 3zT processes - working set, private memory, process count, and CPU
// (percent of ONE core, averaged over 20 s). Also a leak check: memory after opening and closing many tabs.
// Writes tests/out/resources.md.
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exe = process.argv[2];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 9444;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SITES = ['https://en.wikipedia.org/wiki/Web_browser', 'https://github.com/electron/electron', 'https://stackoverflow.com/questions',
  'https://www.bbc.com/news', 'https://developer.mozilla.org/en-US/', 'https://www.reddit.com/r/programming/', 'https://news.ycombinator.com/',
  'https://www.cnn.com/', 'https://www.amazon.com/', 'https://www.nytimes.com/'];
const VIDEO = 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v';

function snapshot() {
  const ps = `$p = Get-Process -Name 3zT -ErrorAction SilentlyContinue; '{0} {1} {2}' -f @($p).Count, ($p | Measure-Object WorkingSet64 -Sum).Sum, ($p | Measure-Object PrivateMemorySize64 -Sum).Sum`;
  const cpu = `Get-Process -Name 3zT -ErrorAction SilentlyContinue | ForEach-Object { '{0}:{1}' -f $_.Id, [math]::Round($_.TotalProcessorTime.TotalMilliseconds) }`;
  const [n, ws, priv] = execSync(`powershell -NoProfile -Command "${ps}"`).toString().trim().split(' ').map(Number);
  const cpuMs = new Map(execSync(`powershell -NoProfile -Command "${cpu}"`).toString().trim().split(/\s+/).filter(Boolean).map(x => x.split(':').map(Number)));
  return { n, ws: Math.round(ws / 1048576), priv: Math.round(priv / 1048576), cpuMs };
}
async function measure(label, settle = 15000) {
  await sleep(settle);
  const a = snapshot(); const t = Date.now();
  await sleep(20000);
  const b = snapshot();
  // CPU used during the 20 s by processes alive at both ends (new or ended processes are left out)
  let used = 0; for (const [pid, ms] of b.cpuMs) if (a.cpuMs.has(pid)) used += Math.max(0, ms - a.cpuMs.get(pid));
  const cpu = Math.round((used / (Date.now() - t)) * 1000) / 10;
  const r = { label, processes: b.n, ws: b.ws, priv: b.priv, cpu };
  console.log(JSON.stringify(r));
  return r;
}

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
async function ev(t, expr) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const v = await new Promise(r => { ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) r(d.result && d.result.result ? d.result.result.value : undefined); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); setTimeout(() => r(undefined), 20000); });
  ws.close(); return v;
}
let firstBar = null;
async function bar() { if (firstBar) return firstBar; for (let i = 0; i < 60; i++) { try { const t = (await targets()).find(x => x.url.includes('ui/toolbar.html')); if (t) return (firstBar = t); } catch (e) {} await sleep(500); } return null; }
const send = async js => ev(await bar(), js);

async function main() {
  const rows = [];
  try { execSync('taskkill /IM 3zT.exe /T /F', { stdio: 'ignore' }); } catch (e) {}
  // a fresh profile, tabs not restored
  const prof = path.join(process.env.APPDATA, '3zT Browser');
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(prof, { recursive: true });
  fs.writeFileSync(path.join(prof, 'settings.json'), JSON.stringify({ restoreTabs: false, bookmarksImported: true, favImported: true, ntpImported: true, extImported: true, dlAsk: false }));
  const t0 = Date.now();
  spawn(exe, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref();
  await bar();
  const startMs = Date.now() - t0;
  rows.push(Object.assign(await measure('Just started (new tab page)'), { note: `toolbar ready after ${startMs} ms` }));
  await send(`ui.send('tab','go',{text:${JSON.stringify(SITES[0])},newTab:false}),1`);
  rows.push(await measure('1 website'));
  for (const s of SITES.slice(1, 5)) { await send(`ui.send('tab','go',{text:${JSON.stringify(s)},newTab:true}),1`); await sleep(1500); }
  rows.push(await measure('5 websites'));
  for (const s of SITES.slice(5)) { await send(`ui.send('tab','go',{text:${JSON.stringify(s)},newTab:true}),1`); await sleep(1500); }
  rows.push(await measure('10 websites'));
  // a video playing (in one more tab)
  await send(`ui.send('tab','go',{text:${JSON.stringify(VIDEO)},newTab:true}),1`);
  await sleep(4000);
  const vt = (await targets()).find(x => x.url.includes('bigbuckbunny'));
  if (vt) await ev(vt, `(() => { const v = document.querySelector('video'); if (v) { v.muted = true; v.play(); } return !!v; })()`);
  rows.push(Object.assign(await measure('10 websites + a playing video', 5000), { note: 'video 640x360 H.264' }));
  // a second window
  await send(`ui.send('tab','newWindow'),1`); await sleep(2000);
  rows.push(await measure('+ a second window'));
  // a download running (100 MB from a local server, saved to the temp folder)
  const big = Buffer.alloc(1024 * 1024, 1);
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="big.bin"', 'Content-Length': 100 * big.length }); let i = 0; const w = () => { while (i < 100) { i++; if (!r.write(big)) return r.once('drain', w); } r.end(); }; w(); }).listen(8794, '127.0.0.1');
  await send(`ui.send('tab','go',{text:'http://127.0.0.1:8794/big.bin',newTab:true}),1`);
  rows.push(Object.assign(await measure('+ a 100 MB download', 1000), { note: 'local server, finishes during the measurement' }));
  srv.close();
  // leak check: close everything but one tab, open and close 40 tabs, compare
  // back to one tab in one window
  for (const x of (await targets()).filter(x => x.url.includes('ui/toolbar.html') && x.id !== firstBar.id)) await ev(x, `ui.send('win','close'),1`);
  await send(`(() => { for (const t of S.tabs.slice(1)) ui.send('tab','close',t.id); return 1; })()`);
  const before = await measure('Back to 1 tab, 1 window (before the leak check)', 20000);
  rows.push(before);
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 10; i++) { await send(`ui.send('tab','go',{text:'https://example.com/?n=${k * 10 + i}',newTab:true}),1`); await sleep(700); }
    await sleep(3000);
    await send(`(() => { const keep = S.tabs[0].id; for (const t of S.tabs.slice(1)) ui.send('tab','close',t.id); return 1; })()`);
    await sleep(2000);
  }
  const after = await measure('After opening and closing 40 tabs', 20000);
  rows.push(Object.assign(after, { note: `private memory ${after.priv - before.priv >= 0 ? '+' : ''}${after.priv - before.priv} MB vs before` }));
  try { execSync('taskkill /IM 3zT.exe /T /F', { stdio: 'ignore' }); } catch (e) {}

  let md = '| Situation | Processes | Memory (working set) | Memory (private) | CPU (% of one core) | Note |\n|---|---|---|---|---|---|\n';
  for (const r of rows) md += `| ${r.label} | ${r.processes} | ${r.ws} MB | ${r.priv} MB | ${r.cpu}% | ${r.note || ''} |\n`;
  fs.writeFileSync(path.join(OUT, 'resources.md'), md);
  console.log(md);
  if (process.env.GITHUB_ACTIONS) console.log('::notice title=resources::' + md.replace(/%/g, '%25').replace(/\n/g, '%0A'));
}
main().catch(e => { console.error(e); try { execSync('taskkill /IM 3zT.exe /T /F', { stdio: 'ignore' }); } catch (x) {} process.exit(0); });
