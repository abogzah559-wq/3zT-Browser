// Song recognition (src/songid.js), without Electron.
//   node tests/songid.mjs
// With internet it downloads the library from jsDelivr (checksums checked), makes a fingerprint of a test tone
// and sends it to Shazam: the answer must be a valid "no song" answer. Without internet those parts are skipped.
// SONGID_LOCAL=<dir with node_modules/shazam-api, fft.js> tests the worker with a local copy instead.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
const require = createRequire(import.meta.url);
const S = require('../src/songid.js');

let fails = 0;
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
const notice = (k, v) => { console.log(`${k}: ${v}`); if (process.env.GITHUB_ACTIONS) console.log(`::notice title=${k}::${v}`); };

// a tone that changes over 6 seconds (16 kHz mono)
const tone = (() => { const n = S.RATE * 6, a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = Math.round(9000 * Math.sin(2 * Math.PI * (300 + i / 60) * i / S.RATE) + 3000 * Math.sin(2 * Math.PI * 1250 * i / S.RATE)); return a; })();

// 1. the answer
ok('a match gives the title and the artist', JSON.stringify(S.parseAnswer({ matches: [{ id: '1' }], track: { title: ' Song ', subtitle: 'Artist' } })) === '{"title":"Song","artist":"Artist"}');
ok('no match gives null', S.parseAnswer({ matches: [] }) === null);
ok('a match without a title gives null', S.parseAnswer({ matches: [{}], track: {} }) === null);
let threw = false; try { S.parseAnswer({ error: 'rate limited' }); } catch (e) { threw = true; }
ok('an answer that is not Shazam\'s is an error (not "no song")', threw);
threw = false; try { S.parseAnswer(null); } catch (e) { threw = true; }
ok('an empty answer is an error', threw);

// 2. loudness and music sites
ok('silence is silent', S.peak(new Int16Array(16000)) === 0);
ok('the tone is loud', S.peak(tone) > 0.3, S.peak(tone).toFixed(2));
ok('music sites are known (with subdomains)', S.musicSite('music.youtube.com') && S.musicSite('play.anghami.com') && S.musicSite('www.deezer.com') && S.musicSite('open.spotify.com'));
ok('other sites are not music sites', !S.musicSite('www.youtube.com') && !S.musicSite('notspotify.com') && !S.musicSite('spotify.com.evil.net'));

// 3. a file that does not match is never used
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'songid-'));
const bad = new S.SongId(tmp);
ok('nothing downloaded: not ready', bad.check() === false);
let refused = false; await bad.request(tone, 'UTC').catch(() => { refused = true; });
ok('nothing is run without the checked files', refused);
// a changed file on disk after the download
const fake = new S.SongId(path.join(tmp, 'x'));
const okBody = rel => Buffer.from('x');
let got = 0;
const r = await fake.ensure(async () => { got++; return new Response(okBody(), { status: 200 }); }).then(() => 'ok', e => e.message);
ok('a download with the wrong checksum is refused', /checksum/.test(r) && !fake.check(), r);
ok('nothing is left behind after a refused download', !fs.existsSync(fake.root()) && (fs.existsSync(fake.dir) ? fs.readdirSync(fake.dir).length === 0 : true));

// 4. the worker (a local copy of the library, files not checked)
async function workerTest(sid, label) {
  const t0 = Date.now();
  const req = await sid.request(tone, 'Asia/Riyadh');
  const ms = Date.now() - t0;
  const body = JSON.parse(req.body);
  ok(`${label}: the fingerprint is made on the worker`, /^https:\/\/amp\.shazam\.com\/discovery\//.test(req.url) && /^data:audio\/vnd\.shazam\.sig;base64,/.test(body.signature.uri) && body.timezone === 'Asia/Riyadh' && body.signature.samplems === 6000, `${ms} ms, ${body.signature.uri.length} chars`);
  ok(`${label}: the request has Shazam's headers`, req.headers && req.headers['Content-Type'] === 'application/json' && !!req.headers['User-Agent']);
  const silent = await sid.request(new Int16Array(S.RATE * 4), 'UTC').then(x => JSON.parse(x.body).signature.uri.length, e => 'error ' + e.message);
  ok(`${label}: silence still makes a (short) fingerprint, no crash`, typeof silent === 'number', String(silent));
  return req;
}
if (process.env.SONGID_LOCAL) {
  const loc = new S.SongId(process.env.SONGID_LOCAL);
  loc.check = () => true;
  loc.root = () => path.join(process.env.SONGID_LOCAL, 'node_modules');
  await workerTest(loc, 'local copy');
  loc.stopWorker();
}

// 5. with internet: the real files, and Shazam itself
const online = await fetch('https://cdn.jsdelivr.net/npm/fft.js@4.0.4/package.json', { signal: AbortSignal.timeout(8000) }).then(r => r.ok, () => false);
if (!online) notice('songid', 'no internet: download and Shazam not tested here');
else {
  const sid = new S.SongId(path.join(tmp, 'real'));
  const d = await sid.ensure(u => fetch(u)).then(() => 'ok', e => e.message);
  ok('the library downloads and every checksum matches', d === 'ok' && sid.check(), d);
  // a second call does not download again
  let calls = 0; await sid.ensure(async u => { calls++; return fetch(u); });
  ok('a second use does not download again', calls === 0);
  if (d === 'ok') {
    const req = await workerTest(sid, 'real library');
    const t0 = Date.now();
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: AbortSignal.timeout(15000) }).then(async x => ({ status: x.status, j: await x.json().catch(() => null) }), e => ({ status: 0, err: e.message }));
    let ans = 'error';
    try { ans = JSON.stringify(S.parseAnswer(res.j)); } catch (e) { ans = 'error: ' + e.message; }
    ok('Shazam answers the request (a test tone: no song)', res.status === 200 && ans === 'null', `HTTP ${res.status} in ${Date.now() - t0} ms, ${ans} ${res.err || ''}`);
    notice('shazam answer', `HTTP ${res.status}, ${Date.now() - t0} ms, ${ans}`);
    // the same file corrupted on disk: not used any more
    fs.appendFileSync(path.join(sid.root(), 'shazam-api', 'dist', 'api.js'), '\n//x');
    ok('a file changed on disk is noticed', sid.check() === false);
    sid.stopWorker();
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
