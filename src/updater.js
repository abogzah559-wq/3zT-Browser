'use strict';
/*
 * Silent updates (Windows, installed copies only).
 *  - while you browse: checks GitHub for a newer release (shortly after start, then every few hours),
 *    downloads the setup in the background and checks its SHA-256 against GitHub's
 *  - when the browser closes: runs the setup silently (no windows, no questions)
 *  - next start: the bar shows a short green "Updated" note with a "Details" button (release notes)
 * Portable copies and development runs never update themselves.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, net } = require('electron');

const REPO = 'abogzah559-wq/3zT-Browser';
const API = process.env.ZEUS_UPDATE_URL || `https://api.github.com/repos/${REPO}/releases/latest`;
const ASSET = '3zT-Browser-Setup.exe';
// the project's update-signing public key (Ed25519). Releases carry 3zT-Browser-Setup.exe.sig, made in CI with
// the private key that only GitHub Actions holds (secret UPDATE_SIGNING_KEY). No valid signature, no update.
const PUBLIC_KEY = 'MCowBQYDK2VwAyEAVz6B4sGbgoTfKFrZZ/1Yr08tgxYQc879WRlYKxCY+s4=';
// automated tests point the browser at a fake release (ZEUS_UPDATE_URL); only then may they bring their own key
const KEY = crypto.createPublicKey({ key: Buffer.from(process.env.ZEUS_UPDATE_URL && process.env.ZEUS_UPDATE_PUBKEY || PUBLIC_KEY, 'base64'), format: 'der', type: 'spki' });
// what is signed: the file name, the version and the file's SHA-256
const signedText = (ver, sha) => `${ASSET}\n${ver}\n${sha}`;
const FIRST_CHECK_MS = +(process.env.ZEUS_UPDATE_DELAY || 60 * 1000);
const EVERY_MS = 4 * 3600 * 1000;

const dir = () => path.join(app.getPath('userData'), 'update');
const pendingFile = () => path.join(dir(), 'pending.json');
const lockFile = () => path.join(dir(), 'installing.lock');

/* only a copy installed by our setup updates itself (the uninstaller sits next to the exe) */
function installed() {
  if (process.platform !== 'win32' || !app.isPackaged) return false;
  return fs.existsSync(path.join(path.dirname(process.execPath), 'unins000.exe'));
}

function newer(a, b) {   // is version a newer than b?
  const p = v => String(v).replace(/^v/, '').split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function sha256File(f) {
  return new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
}

/* release notes: the "### العربية" / "### English" parts of the release text */
function notesFor(body, lang) {
  const text = String(body || '').replace(/\r/g, '');
  const part = name => { const m = text.match(new RegExp('^###\\s*' + name + '\\s*\\n([\\s\\S]*?)(?=^###\\s|^##\\s|<!--\\s*end notes\\s*-->|$(?![\\s\\S]))', 'm')); return m ? m[1].trim() : ''; };
  const lines = s => s.split('\n').map(l => l.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim()).filter(Boolean);
  const ar = lines(part('العربية')), en = lines(part('English'));
  return lang === 'en' ? (en.length ? en : ar) : (ar.length ? ar : en);
}

let busy = false, timer = null, log = () => {};

async function check() {
  if (busy) return; busy = true;
  try {
    const r = await net.fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': '3zT-updater' } });
    if (!r.ok) return log('update check', r.status);
    const rel = await r.json();
    const ver = String(rel.tag_name || '').replace(/^v/, '');
    if (!ver || !newer(ver, app.getVersion())) return;
    const asset = (rel.assets || []).find(a => a.name === ASSET);
    if (!asset) return;
    // already downloaded and verified?
    const pend = readJson(pendingFile());
    if (pend && pend.version === ver && fs.existsSync(pend.file)) return;
    // the expected checksum: GitHub's own digest of the file, or the .sha256 file next to it
    let want = String(asset.digest || '').replace(/^sha256:/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(want)) {
      const sh = (rel.assets || []).find(a => a.name === ASSET + '.sha256');
      if (sh) { const t = await (await net.fetch(sh.browser_download_url)).text(); want = (t.match(/[0-9a-f]{64}/i) || [''])[0].toLowerCase(); }
    }
    if (!/^[0-9a-f]{64}$/.test(want)) return log('update: no checksum, skipped');
    // the signature must match this version and checksum before anything is downloaded
    const sigAsset = (rel.assets || []).find(a => a.name === ASSET + '.sig');
    if (!sigAsset) return log('update: not signed, skipped');
    let sigOk = false;
    try {
      const sig = Buffer.from((await (await net.fetch(sigAsset.browser_download_url)).text()).trim(), 'base64');
      sigOk = sig.length === 64 && crypto.verify(null, Buffer.from(signedText(ver, want)), KEY, sig);
    } catch (e) {}
    if (!sigOk) return log('update: bad signature, skipped');
    fs.mkdirSync(dir(), { recursive: true });
    const file = path.join(dir(), `3zT-Setup-${ver}.exe`), part = file + '.part';
    const d = await net.fetch(asset.browser_download_url);
    if (!d.ok || !d.body) return log('update download', d.status);
    const out = fs.createWriteStream(part);
    const reader = d.body.getReader();
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      if (!out.write(Buffer.from(value))) await new Promise(r2 => out.once('drain', r2));
    }
    await new Promise((r2, j) => out.end(e => (e ? j(e) : r2())));
    const got = await sha256File(part);
    if (got !== want) { try { fs.unlinkSync(part); } catch (e) {} return log('update: checksum mismatch'); }
    // keep only this setup
    for (const n of fs.readdirSync(dir())) if (/^3zT-Setup-.*\.exe$/.test(n) && n !== path.basename(file)) { try { fs.unlinkSync(path.join(dir(), n)); } catch (e) {} }
    fs.renameSync(part, file);
    fs.writeFileSync(pendingFile(), JSON.stringify({ version: ver, file, body: String(rel.body || '').slice(0, 20000), at: Date.now() }));
    log('update ready', ver);
  } catch (e) { log('update failed', e && e.message); }
  finally { busy = false; }
}

/* called when the browser is closing for good: install the waiting update silently */
function installOnQuit() {
  if (!installed()) return false;
  const pend = readJson(pendingFile());
  if (!pend || !pend.file || !fs.existsSync(pend.file) || !newer(pend.version, app.getVersion())) return false;
  try {
    // the setup removes this lock when it has finished copying (installer/3zT.iss)
    fs.writeFileSync(lockFile(), String(Date.now()));
    // remember what to show on the next start
    fs.writeFileSync(path.join(dir(), 'updated.json'), JSON.stringify({ from: app.getVersion(), to: pend.version, body: pend.body || '' }));
    // the setup itself, silent; it waits for / closes what is left of this browser before replacing files
    const child = spawn(pend.file, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/NOCANCEL', '/CLOSEAPPLICATIONS'],
      { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => { try { fs.unlinkSync(lockFile()); } catch (x) {} });
    child.unref();
    return true;
  } catch (e) { log('install on quit failed', e && e.message); try { fs.unlinkSync(lockFile()); } catch (x) {} return false; }
}

/* called first thing on start: an update is being installed right now -> ask the setup to open
   3zT again (with the same arguments) when it is done, and close this copy at once */
function waitIfInstalling() {
  if (process.platform !== 'win32') return false;
  let at = 0; try { at = +fs.readFileSync(lockFile(), 'utf8') || fs.statSync(lockFile()).mtimeMs; } catch (e) { return false; }
  if (Date.now() - at > 3 * 60 * 1000) { try { fs.unlinkSync(lockFile()); } catch (e) {} return false; }   // stale
  const q = a => (/[\s"]/.test(a) ? '"' + String(a).replace(/"/g, '\\"') + '"' : String(a));
  try { fs.writeFileSync(path.join(dir(), 'relaunch.flag'), process.argv.slice(1).map(q).join(' ')); } catch (e) { return false; }
  return true;
}

/* leftovers of an update that is already installed (or older than this version) */
function cleanup() {
  try {
    const pend = readJson(pendingFile());
    if (pend && !newer(pend.version, app.getVersion())) { try { fs.unlinkSync(pendingFile()); } catch (e) {} }
    const keep = pend && newer(pend.version, app.getVersion()) ? path.basename(pend.file || '') : '';
    for (const n of fs.readdirSync(dir())) if (/^3zT-Setup-.*\.exe(\.part)?$/.test(n) && n !== keep) { try { fs.unlinkSync(path.join(dir(), n)); } catch (e) {} }
  } catch (e) {}
}

/* after an update: what to show once (then forgotten) */
function takeUpdated(lang) {
  const f = path.join(dir(), 'updated.json');
  const u = readJson(f); if (!u) return null;
  try { fs.unlinkSync(f); } catch (e) {}
  if (u.to !== app.getVersion()) return null;   // the install did not happen
  return { from: u.from, to: u.to, notes: notesFor(u.body, lang) };
}

function start(opts = {}) {
  log = opts.log || log;
  cleanup();
  if (!installed() && !process.env.ZEUS_UPDATE_URL) return false;
  clearTimeout(timer);
  timer = setTimeout(function tick() { check(); timer = setTimeout(tick, EVERY_MS); }, FIRST_CHECK_MS);
  return true;
}

module.exports = { start, check, installOnQuit, waitIfInstalling, takeUpdated, installed, newer, notesFor, signedText };
