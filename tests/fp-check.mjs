// What a website can read about the browser (the things bot checks compare with a real Chrome), for 3zT and for
// Google Chrome on the same machine, so a difference that gives 3zT away can be found.
//   node tests/fp-check.mjs <label> <browser.exe>
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [label, exe] = process.argv.slice(2);
const PORT = 9420, is3zt = /^3zt$/i.test(label);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = () => { try { execSync(`taskkill /IM ${path.basename(exe)} /T /F`, { stdio: 'ignore' }); } catch (e) {} };
const targets = async () => (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map(), ev = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else ev.forEach(f => f(d)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({}); } }, 30000); });
  return { send, on: f => ev.push(f) };
}
const FP = `(async () => {
  const o = {};
  const t = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = 'ERR ' + e.message; } };
  t('ua', () => navigator.userAgent);
  t('brands', () => JSON.stringify(navigator.userAgentData && navigator.userAgentData.brands));
  try { o.high = JSON.stringify(await navigator.userAgentData.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model', 'fullVersionList', 'uaFullVersion', 'wow64', 'formFactors'])); } catch (e) { o.high = 'ERR ' + e.message; }
  t('webdriver', () => navigator.webdriver);
  t('languages', () => navigator.languages.join(','));
  t('plugins', () => [...navigator.plugins].map(p => p.name).join('|'));
  t('mimeTypes', () => navigator.mimeTypes.length);
  t('pdfViewerEnabled', () => navigator.pdfViewerEnabled);
  t('hardwareConcurrency', () => navigator.hardwareConcurrency);
  t('deviceMemory', () => navigator.deviceMemory);
  t('vendor', () => navigator.vendor);
  t('platform', () => navigator.platform);
  t('doNotTrack', () => navigator.doNotTrack);
  t('globalPrivacyControl', () => navigator.globalPrivacyControl);
  t('chromeKeys', () => typeof window.chrome + ' ' + (window.chrome ? Object.keys(window.chrome).sort().join(',') : ''));
  t('chromeApp', () => window.chrome && window.chrome.app ? Object.keys(window.chrome.app).join(',') : 'none');
  t('chromeRuntime', () => window.chrome && window.chrome.runtime ? Object.keys(window.chrome.runtime).length : 'none');
  t('csi', () => window.chrome && typeof window.chrome.csi);
  t('loadTimes', () => window.chrome && typeof window.chrome.loadTimes);
  t('process', () => typeof window.process + ' ' + typeof window.require + ' ' + typeof window.module);
  t('notification', () => typeof Notification !== 'undefined' ? Notification.permission : 'none');
  try { o.permNotif = (await navigator.permissions.query({ name: 'notifications' })).state; } catch (e) { o.permNotif = 'ERR ' + e.message; }
  t('fnToString', () => Function.prototype.toString.toString() + ' / ' + HTMLCanvasElement.prototype.toDataURL.toString());
  t('screen', () => [screen.width, screen.height, screen.availWidth, screen.availHeight, screen.colorDepth, devicePixelRatio, outerWidth, outerHeight, innerWidth, innerHeight].join(','));
  t('webgl', () => { const g = document.createElement('canvas').getContext('webgl'); const d = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(d.UNMASKED_VENDOR_WEBGL) + ' | ' + g.getParameter(d.UNMASKED_RENDERER_WEBGL); });
  t('connection', () => navigator.connection ? navigator.connection.effectiveType + ' ' + navigator.connection.rtt : 'none');
  t('speech', () => typeof speechSynthesis);
  t('mediaDevices', () => typeof navigator.mediaDevices);
  t('getBattery', () => typeof navigator.getBattery);
  t('bluetooth', () => typeof navigator.bluetooth + ' ' + typeof navigator.usb + ' ' + typeof navigator.hid + ' ' + typeof navigator.serial);
  t('share', () => typeof navigator.share + ' ' + typeof navigator.contacts);
  t('intl', () => Intl.DateTimeFormat().resolvedOptions().timeZone + ' ' + Intl.DateTimeFormat().resolvedOptions().locale);
  t('windowKeys', () => Object.getOwnPropertyNames(window).filter(k => !/^on/.test(k)).length);
  t('extraGlobals', () => Object.getOwnPropertyNames(window).filter(k => /^(__|tzt|electron|process|require|Buffer|global)/i.test(k)).join(','));
  t('docKeys', () => Object.keys(document).join(','));
  t('stackLen', () => { let d = 0; const f = () => { d++; f(); }; try { f(); } catch (e) {} return d; });
  return o;
})()`;
async function main() {
  kill(); await sleep(1000);
  const args = [`--remote-debugging-port=${PORT}`];
  if (is3zt) { try { fs.rmSync(path.join(process.env.APPDATA, '3zT Browser'), { recursive: true, force: true }); } catch (e) {} }
  else args.push('--no-first-run', '--no-default-browser-check', '--window-size=1366,860', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'))}`, 'about:blank');
  spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
  let page = null;
  for (let i = 0; i < 80 && !page; i++) { await sleep(500); try { page = (await targets()).find(x => x.type === 'page' && (is3zt ? x.url.includes('newtab.html') : !x.url.startsWith('chrome') && !x.url.startsWith('devtools'))); } catch (e) {} }
  await sleep(8000);
  const c = await connect(page);
  await c.send('Page.enable');
  const heads = [];
  await c.send('Network.enable');
  c.on(d => { if (d.method === 'Network.requestWillBeSentExtraInfo' && heads.length < 1) heads.push(d.params.headers); });
  await c.send('Page.navigate', { url: 'https://www.example.com/' });
  await sleep(5000);
  const r = await c.send('Runtime.evaluate', { expression: FP, awaitPromise: true, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  console.log('FPJSON ' + JSON.stringify({ label, fp: v, headers: heads[0] || null }));
  kill();
}
main().catch(e => { console.log('::error::' + e.stack); kill(); process.exit(1); });
