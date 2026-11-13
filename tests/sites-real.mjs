// Real-site check of the browser itself (diagnostic, Windows test machine): the quality TikTok plays at with and
// without "highest quality", and picture in picture on a real YouTube page (previous / next buttons).
//
//   node tests/sites-real.mjs <exe-or-electron> [app-dir]
//
// Every result is printed as a GitHub annotation. Sites can refuse a test machine (sign-in walls, bot checks):
// that is reported as such, never as a pass.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const exe = argv[0], appDir = argv[1];
const PORT = 9335;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out'); fs.mkdirSync(OUT, { recursive: true });
const TT = process.env.TT_URL || 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
const YT = process.env.YT_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const note = (kind, title, msg) => console.log(`::${kind} title=${title}::${String(msg).replace(/%/g, '%25').replace(/\r?\n/g, ' | ').slice(0, 1500)}`);

let child = null;
async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; setTimeout(() => rej(new Error('connect timeout')), 10000); });
  let id = 0; const wait = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({}); } }, 30000); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  return { send, ev, close: () => ws.close() };
}
async function find(match, tries = 60) {
  for (let i = 0; i < tries; i++) { try { const t = (await targets()).find(x => x.type === 'page' && match(x.url)); if (t) return t; } catch (e) {} await sleep(500); }
  return null;
}
const toolbar = async () => connect(await find(u => u.includes('ui/toolbar.html')));
async function go(text) { const tb = await toolbar(); await tb.ev(`ui.send('tab','go',${JSON.stringify({ text, newTab: true })}),1`); tb.close(); }
async function poll(fn, ms = 30000, every = 700) { const end = Date.now() + ms; let v; while (Date.now() < end) { try { v = await fn(); if (v) return v; } catch (e) {} await sleep(every); } return v; }
async function shot(c, name) { try { const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); } catch (e) {} }
const VIDS = `JSON.stringify([...document.querySelectorAll('video')].filter(v => v.readyState > 0 && v.videoHeight > 0).map(v => ({ w: v.videoWidth, h: v.videoHeight, src: (v.currentSrc || '').replace(/\\?.*/, '').slice(-90) })))`;

async function tiktok(label) {
  await go(TT);
  const t = await find(u => /tiktok\.com/.test(u), 40);
  if (!t) return note('warning', `TikTok ${label}`, 'the page did not open');
  const c = await connect(t);
  const vids = await poll(async () => { const v = JSON.parse((await c.ev(VIDS)) || '[]'); return v.length ? v : null; }, 40000);
  await shot(c, 'tiktok-' + label);
  const page = await c.ev('location.href + " | " + document.title');
  if (!vids) note('warning', `TikTok ${label}`, 'no video played on this machine: ' + page);
  else note('notice', `TikTok ${label}`, vids.map(v => `${v.w}x${v.h} ${v.src}`).join(' ; '));
  await c.ev('window.close()').catch(() => {});
  c.close();
  return vids ? Math.max(...vids.map(v => Math.min(v.w, v.h))) : 0;
}

async function youtubePip() {
  await go(YT);
  const t = await find(u => /youtube\.com\/watch/.test(u), 40);
  if (!t) return note('warning', 'YouTube picture in picture', 'the page did not open');
  const c = await connect(t);
  const playing = await poll(() => c.ev(`(() => { const v = document.querySelector('#movie_player video'); return !!v && v.readyState > 2 && !document.querySelector('#movie_player.ad-showing'); })()`), 45000);
  if (!playing) { await shot(c, 'youtube'); c.close(); return note('warning', 'YouTube picture in picture', 'the video did not play on this machine: ' + await c.ev('document.title')); }
  for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: 30, y: 30, button: 'left', clickCount: 1 });
  for (const type of ['rawKeyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, modifiers: 1, key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80, nativeVirtualKeyCode: 80 });
  const pt = await find(u => u.includes('ui/pip.html'), 20);
  if (!pt) { c.close(); return note('error', 'YouTube picture in picture', 'Alt+P did not open the window'); }
  const pc = await connect(pt);
  await sleep(1500);
  const s = await pc.ev('pip.state()');
  const size = await c.ev(`(() => { const v = document.querySelector('video[data-zpip]'); if (!v) return 'no marked video'; const r = v.getBoundingClientRect(); return innerWidth + 'x' + innerHeight + ' video ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' quality ' + (document.getElementById('movie_player').getPlaybackQuality ? document.getElementById('movie_player').getPlaybackQuality() : '?'); })()`);
  const v0 = await c.ev('new URL(location.href).searchParams.get("v")');
  await pc.ev(`document.getElementById('next').click(), 1`);
  const v1 = await poll(async () => { const v = await c.ev('new URL(location.href).searchParams.get("v")'); return v && v !== v0 ? v : null; }, 20000);
  const still = await c.ev(`!!document.querySelector('video[data-zpip]') && document.querySelector('video[data-zpip]').matches(':popover-open')`);
  note(s && s.tracks && v1 && still ? 'notice' : 'error', 'YouTube picture in picture', `state ${JSON.stringify(s)} · ${size} · next: ${v0} -> ${v1 || 'no change'} · still in the window after next: ${still}`);
  await pc.ev(`document.getElementById('back').click(), 1`).catch(() => {});
  pc.close(); c.close();
}

async function main() {
  child = spawn(exe, [...(appDir ? [appDir] : []), `--remote-debugging-port=${PORT}`], { env: { ...process.env, ZEUS_E2E: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(OUT, 'sites-real-app.log')); child.stdout.pipe(log); child.stderr.pipe(log);
  if (!(await find(u => u.includes('ui/toolbar.html'), 120))) { note('error', 'sites', 'the app did not start'); return; }
  await sleep(4000);
  try {
    const hi = await tiktok('highest quality on');
    { const tb = await toolbar(); await tb.ev(`ui.send('set', 'hqVideo', false), 1`); tb.close(); }
    const lo = await tiktok('highest quality off');
    { const tb = await toolbar(); await tb.ev(`ui.send('set', 'hqVideo', true), 1`); tb.close(); }
    if (hi && lo) note(hi >= lo ? 'notice' : 'error', 'TikTok quality', `on ${hi}p, off ${lo}p`);
  } catch (e) { note('warning', 'TikTok', String(e && e.stack || e)); }
  try { await youtubePip(); } catch (e) { note('warning', 'YouTube picture in picture', String(e && e.stack || e)); }
}
setTimeout(() => { note('warning', 'sites', 'stopped after 8 minutes'); process.exit(0); }, 8 * 60 * 1000).unref();
main().catch(e => note('warning', 'sites', String(e && e.stack || e))).finally(async () => {
  try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' }); else child.kill(); } catch (e) {}
  process.exit(0);
});
