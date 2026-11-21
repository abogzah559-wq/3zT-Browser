'use strict';
/*
 * Song recognition (the music button in the bar).
 *
 * A few seconds of the sound of one tab are turned into an audio fingerprint on this computer, and only that
 * fingerprint is sent to Shazam's recognition service; the recording itself never leaves the computer.
 *
 * The fingerprint code is asivery's shazam-api (https://github.com/asivery/node-shazam-api, GPL-2.0), which uses
 * Fedor Indutny's fft.js (MIT). Neither is part of this repository: both are downloaded from
 * npm (through jsDelivr) the first time the button is used, each file checked against the SHA-256 pinned below,
 * and kept in userData\songid. The files are checked again every time they are loaded.
 *
 * Nothing here runs until the button is pressed; the fingerprint is computed on a worker thread so the browser
 * never waits for it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CDN = 'https://cdn.jsdelivr.net/npm/';
// file in the package -> [ where it is kept (under node_modules), sha256 ]
const FILES = [
  ['shazam-api@0.3.0/dist/index.js', 'shazam-api/dist/index.js', '57a59d92178321cd83b0bdb9a37a47ba8377649d296eb857528f83997f1868d0'],
  ['shazam-api@0.3.0/dist/api.js', 'shazam-api/dist/api.js', '7518907a713e7023852e9079b74e6999b326b3a85eec911eb5ca8ae23de9f19e'],
  ['shazam-api@0.3.0/dist/utils.js', 'shazam-api/dist/utils.js', '2759b3f0faf36d494a07b85111da7db427c165251c1336d876874f6576451ce4'],
  ['shazam-api@0.3.0/dist/types.js', 'shazam-api/dist/types.js', 'd9f84edd6e9073eb2344873dcda1fa0ca0a6b0e685d0317e71bb1f0927797cfc'],
  ['shazam-api@0.3.0/dist/agents.js', 'shazam-api/dist/agents.js', '99a011e33ff6606774c265aaef3806a7970385f51965b8b4559a84d73baa41ca'],
  ['shazam-api@0.3.0/dist/algorithm.js', 'shazam-api/dist/algorithm.js', 'e1ac6a5231d7a1ebc53b313f1da941b8f3e6ef2dfe49bef3bbc89e9d3b570c7b'],
  ['shazam-api@0.3.0/dist/signature-format.js', 'shazam-api/dist/signature-format.js', 'c95708cf18d0feee51392185ac922b5e6b3beefd939d0ce98ce3a06b9d3208b2'],
  ['shazam-api@0.3.0/dist/hanning.js', 'shazam-api/dist/hanning.js', 'bfcaf9fc03d039ef35b4a99b7ab86510d40bb48208d63236eac5df07935d53a8'],
  ['shazam-api@0.3.0/LICENSE', 'shazam-api/LICENSE', '8177f97513213526df2cf6184d8ff986c675afb514d4e68a404010521b880643'],
  ['fft.js@4.0.4/lib/fft.js', 'fft.js/lib/fft.js', '4092b92cec888377666265b724d676628d377d4d5f56b03b76d9c2c27fd061ea']
];
// written by us next to them: how Node finds the two packages, and "node-fetch" (shazam-api loads it, but the
// request is made by the browser itself, see request())
const OWN = {
  'shazam-api/package.json': '{"name":"shazam-api","version":"0.3.0","main":"dist/index.js"}\n',
  'fft.js/package.json': '{"name":"fft.js","version":"4.0.4","main":"lib/fft.js"}\n',
  'node-fetch/package.json': '{"name":"node-fetch","main":"index.js"}\n',
  'node-fetch/index.js': "'use strict';\nmodule.exports = function () { throw new Error('not used'); };\n"
};
const RATE = 16000;   // the fingerprint is made from 16 kHz mono

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// runs on the worker thread: the fingerprint, and the request shazam-api would send (it is sent by the caller)
const WORKER = `
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const dist = path.join(workerData.root, 'shazam-api', 'dist');
const { SignatureGenerator } = require(path.join(dist, 'algorithm.js'));
const { Endpoint } = require(path.join(dist, 'api.js'));
parentPort.on('message', async m => {
  try {
    const pcm = new Int16Array(m.pcm);
    const sig = new SignatureGenerator().getSignature(Array.from(pcm));
    if (!sig) throw new Error('no fingerprint');
    const ep = new Endpoint(m.tz || 'UTC');
    let req = null;
    ep.sendRecognizeRequest = async (url, body) => { req = { url, body }; return { matches: [] }; };
    await ep.formatAndSendRecognizeRequest(sig);
    if (!req) throw new Error('no request');
    parentPort.postMessage({ id: m.id, url: req.url, body: req.body, headers: ep.headers() });
  } catch (e) { parentPort.postMessage({ id: m.id, error: String(e && e.message || e) }); }
});
`;

class SongId {
  constructor(dir, log = () => {}) {
    this.dir = dir;               // userData\songid
    this.log = log;
    this.busy = null;             // the download in progress
    this.worker = null; this.workerTimer = null; this.seq = 0; this.waiting = new Map();
  }
  root() { return path.join(this.dir, 'node_modules'); }

  // every file is there with the right SHA-256 (checked each time: nothing else is ever run)
  check() {
    try {
      for (const [, rel, hash] of FILES) if (sha256(fs.readFileSync(path.join(this.root(), rel))) !== hash) return false;
      for (const [rel, text] of Object.entries(OWN)) if (fs.readFileSync(path.join(this.root(), rel), 'utf8') !== text) return false;
      return true;
    } catch (e) { return false; }
  }

  // downloads what is missing or wrong; `get(url)` returns a fetch Response
  ensure(get) {
    if (this.check()) return Promise.resolve(true);
    if (this.busy) return this.busy;
    this.busy = (async () => {
      const tmp = path.join(this.dir, 'tmp-' + process.pid + '-' + Date.now());
      try {
        const got = await Promise.all(FILES.map(async ([src, rel, hash]) => {
          const r = await get(CDN + src);
          if (!r.ok) throw new Error(src + ': HTTP ' + r.status);
          const b = Buffer.from(await r.arrayBuffer());
          if (sha256(b) !== hash) throw new Error(src + ': checksum does not match');
          return [rel, b];
        }));
        for (const [rel, b] of got) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), b); }
        for (const [rel, text] of Object.entries(OWN)) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), text); }
        this.stopWorker();
        fs.rmSync(this.root(), { recursive: true, force: true });
        fs.renameSync(tmp, this.root());
        if (!this.check()) throw new Error('files changed after download');
        this.log('song recognition: library ready');
        return true;
      } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
        this.busy = null;
      }
    })();
    return this.busy;
  }

  // the worker stays for a minute after its last use (a second try is quick), then goes away
  workerFor() {
    clearTimeout(this.workerTimer);
    this.workerTimer = setTimeout(() => this.stopWorker(), 60000);
    if (this.worker) return this.worker;
    const { Worker } = require('worker_threads');
    const w = new Worker(WORKER, { eval: true, workerData: { root: this.root() }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    w.unref();
    w.on('message', m => { const p = this.waiting.get(m.id); if (p) { this.waiting.delete(m.id); m.error ? p.reject(new Error(m.error)) : p.resolve(m); } });
    const fail = e => { for (const p of this.waiting.values()) p.reject(e); this.waiting.clear(); if (this.worker === w) this.worker = null; };
    w.on('error', fail);
    w.on('exit', () => fail(new Error('worker stopped')));
    this.worker = w;
    return w;
  }
  stopWorker() {
    clearTimeout(this.workerTimer); this.workerTimer = null;
    const w = this.worker; this.worker = null;
    if (w) w.terminate().catch(() => {});
  }

  // 16 kHz mono 16-bit samples -> { url, body, headers } of the recognition request
  request(pcm, tz) {
    if (!this.check()) return Promise.reject(new Error('library missing'));
    const id = ++this.seq;
    const copy = new Int16Array(pcm);   // the buffer is moved to the worker
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.waiting.delete(id); reject(new Error('fingerprint timed out')); }, 15000);
      this.waiting.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
      this.workerFor().postMessage({ id, pcm: copy.buffer, tz }, [copy.buffer]);
    });
  }
}

// Shazam's answer -> { title, artist } (null: no song found)
function parseAnswer(j) {
  if (!j || typeof j !== 'object') throw new Error('unexpected answer');
  if (!Array.isArray(j.matches)) throw new Error('unexpected answer');
  const t = j.track;
  if (!j.matches.length || !t || typeof t.title !== 'string' || !t.title.trim()) return null;
  return { title: t.title.trim().slice(0, 300), artist: typeof t.subtitle === 'string' ? t.subtitle.trim().slice(0, 300) : '' };
}

// how loud a recording is (0..1, the loudest sample): nearly 0 means no sound was playing
function peak(pcm) { let m = 0; for (let i = 0; i < pcm.length; i++) { const v = Math.abs(pcm[i]); if (v > m) m = v; } return m / 32768; }

// the sites that say themselves what song is playing (their player sets the media session: title and artist)
const MUSIC_SITES = ['music.youtube.com', 'open.spotify.com', 'soundcloud.com', 'anghami.com', 'deezer.com', 'music.apple.com', 'tidal.com'];
function musicSite(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  return MUSIC_SITES.some(s => host === s || host.endsWith('.' + s));
}

module.exports = { SongId, parseAnswer, peak, musicSite, FILES, OWN, RATE };
