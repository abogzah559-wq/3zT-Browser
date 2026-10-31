// Silent-update test (Windows, run by CI after the installed-app tests).
//
//   node tests/update-test.mjs <installed 3zT.exe> <newer setup.exe> <newer version>
//
// 1. a fake "latest release" (with the newer setup and its SHA-256) is served on 127.0.0.1
// 2. the installed 3zT finds it while running and downloads + verifies it in the background
// 3. 3zT is closed normally; the setup must then run silently and replace the installed version
// 4. 3zT is opened again *while* the update is still installing: it must wait and open by itself
// 5. the new version shows the green "updated" note with the release notes behind "Details"
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [exe, nextSetup, nextVer] = process.argv.slice(2);
const UD = path.join(process.env.APPDATA, '3zT Browser');
const UPD = path.join(UD, 'update');
const LOG = path.join(process.env.RUNNER_TEMP || '.', 'update-app.log');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
async function until(fn, ms, every = 500) { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(every); } return null; }

/* fake GitHub "latest release" */
const setup = fs.readFileSync(nextSetup);
const digest = crypto.createHash('sha256').update(setup).digest('hex');
// a throw-away signing key for this test (the real key lives only in the GitHub secret)
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const SIG = crypto.sign(null, Buffer.from(`3zT-Browser-Setup.exe\n${nextVer}\n${digest}`), privateKey).toString('base64');
const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const section = changelog.split(/^## /m).find(s => /^\d/.test(s)) || '';
const body = 'Test release.\n\n## ' + section;
let served = 0;
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/latest.json')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ tag_name: 'v' + nextVer, body, assets: [{ name: '3zT-Browser-Setup.exe', browser_download_url: 'http://127.0.0.1:8777/setup.exe', digest: 'sha256:' + digest }, { name: '3zT-Browser-Setup.exe.sig', browser_download_url: 'http://127.0.0.1:8777/setup.sig' }] }));
  } else if (req.url.startsWith('/setup.sig')) { res.end(SIG); }
  else if (req.url.startsWith('/setup.exe')) { served++; res.setHeader('Content-Length', setup.length); res.end(setup); }
  else { res.statusCode = 404; res.end(); }
}).listen(8777, '127.0.0.1');

async function cdp(port, match, expr) {
  try { return await cdpRaw(port, match, expr); } catch (e) { return undefined; }
}
async function cdpRaw(port, match, expr) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const t = list.find(x => x.type === 'page' && x.url.includes(match)); if (!t) return undefined;
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('timeout')), 8000); });
  const v = await new Promise(r => { ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) r(d.result && d.result.result ? d.result.result.value : undefined); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); setTimeout(() => r(undefined), 15000); });
  ws.close(); return v;
}
const fileVersion = f => { try { return execSync(`powershell -NoProfile -Command "(Get-Item '${f}').VersionInfo.ProductVersion"`).toString().trim(); } catch (e) { return ''; } };
const appVersion = () => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(exe), 'resources', 'app', 'package.json'), 'utf8')).version; } catch (e) { return ''; } };
const running = () => { try { return execSync('tasklist /FI "IMAGENAME eq 3zT.exe" /NH').toString().includes('3zT.exe'); } catch (e) { return false; } };

async function main() {
  const before = appVersion();
  ok('installed version before', !!before && before !== nextVer, before);
  try { fs.rmSync(UPD, { recursive: true, force: true }); } catch (e) {}

  // 1-2. run, find and download the update in the background
  const env = { ...process.env, ZEUS_UPDATE_URL: 'http://127.0.0.1:8777/latest.json', ZEUS_UPDATE_DELAY: '3000', ZEUS_UPDATE_PUBKEY: PUB };
  const logFd = fs.openSync(LOG, 'w');
  spawn(exe, ['--remote-debugging-port=9334', '--enable-logging=stderr'], { env, detached: true, stdio: ['ignore', logFd, logFd] }).unref();
  const up = await until(() => cdp(9334, 'ui/toolbar.html', '!!document.getElementById("addr")'), 60000);
  ok('browser starts', !!up);
  const pend = await until(() => { try { return JSON.parse(fs.readFileSync(path.join(UPD, 'pending.json'), 'utf8')); } catch (e) { return null; } }, 120000);
  ok('update found, downloaded and verified in the background', !!pend && pend.version === nextVer && fs.existsSync(pend.file), pend ? `${pend.version} (${served} download)` : 'no pending.json');
  ok('nothing was shown while browsing', (await cdp(9334, 'ui/toolbar.html', 'document.getElementById("toast").hidden')) !== false);

  // 3. close normally
  await cdp(9334, 'ui/toolbar.html', `ui.send('win','close'), 1`);
  const exited = await until(() => !running(), 30000);
  ok('browser closes normally', !!exited);

  // 4. open again right away, while the setup is still running
  const lockSeen = fs.existsSync(path.join(UPD, 'installing.lock'));
  spawn(exe, ['--remote-debugging-port=9335'], { detached: true, stdio: 'ignore' }).unref();
  const lockGone = await until(() => !fs.existsSync(path.join(UPD, 'installing.lock')), 180000);
  ok('silent install ran and finished', lockSeen && !!lockGone, `lock seen: ${lockSeen}`);
  const after = await until(() => (appVersion() === nextVer ? appVersion() : null), 30000);
  ok('installed version is the new one', after === nextVer, `app ${appVersion()}, exe ${fileVersion(exe)}`);

  // 5. it opened by itself after the install and shows the green note
  const up2 = await until(() => cdp(9335, 'ui/toolbar.html', 'typeof updateInfo !== "undefined" && updateInfo ? JSON.stringify(updateInfo) : ""'), 90000, 300);
  let info = null; try { info = JSON.parse(up2); } catch (e) {}
  ok('opened by itself after installing, green "updated" note received', !!info && info.to === nextVer, up2 || 'no note');
  const green = await cdp(9335, 'ui/toolbar.html', 'document.getElementById("toast").classList.contains("ok") + " | " + document.getElementById("toast").innerText');
  ok('note is green with a Details button', /^true/.test(String(green)) && /التفاصيل|Details/.test(String(green)), String(green));
  const notes = await cdp(9335, 'ui/toolbar.html', `openDrop('notes', document.getElementById('menuBtn')), document.getElementById('drop').innerText`);
  ok('Details lists what changed', !!notes && info && info.notes && info.notes.length > 0 && String(notes).includes(nextVer), String(notes).slice(0, 300));
  await sleep(4000);
  const hidden = await cdp(9335, 'ui/toolbar.html', 'document.getElementById("toast").hidden');
  ok('note goes away by itself', hidden === true);
  ok('update files cleaned up', !fs.existsSync(path.join(UPD, 'pending.json')) && !fs.readdirSync(UPD).some(n => n.endsWith('.exe')), fs.existsSync(UPD) ? fs.readdirSync(UPD).join(', ') : '');

  finish();
}
function finish(extra = '') {
  try { execSync('taskkill /IM 3zT.exe /T /F', { stdio: 'ignore' }); } catch (e) {}
  try { srv.close(); } catch (e) {}
  const failed = results.filter(r => !r.pass);
  let ilog = ''; try { ilog = fs.readFileSync(path.join(UPD, 'install.log'), 'utf8'); } catch (e) { ilog = '(no install.log)'; }
  extra = (extra ? extra + '\n' : '') + '--- install.log ---\n' + ilog;
  let log = ''; if (failed.length || extra) { try { log = fs.readFileSync(LOG, 'utf8').split('\n').filter(l => /\[3zT\]/.test(l)).slice(-12).join('\n'); } catch (e) {} }
  const esc = t => String(t).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  const text = results.map(r => `${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.info ? ' - ' + r.info : ''}`).join('\n') + (extra ? '\n' + extra : '') + (log ? '\n--- app log ---\n' + log : '');
  console.log(text);
  if (process.env.GITHUB_ACTIONS) console.log(`::${failed.length ? 'error' : 'notice'} title=update ${results.length - failed.length}/${results.length}::` + esc(text));
  process.exit(failed.length ? 1 : 0);
}
setTimeout(() => { ok('finished in time', false, '15 minutes'); finish(); }, 15 * 60 * 1000).unref();
main().catch(e => { ok('no crash in the test', false, String(e && e.stack || e)); finish(); });
