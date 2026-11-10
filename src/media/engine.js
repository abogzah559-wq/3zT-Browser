'use strict';
/*
 * Built-in media downloader (from the 3zT Download app, now part of the browser).
 *  - videos / audio (MP3) with yt-dlp, photo posts (TikTok photos, Instagram, X...) with gallery-dl, ffmpeg for merging and trimming
 *  - nothing runs until you use it: the first time, the three tools are downloaded from their official releases
 *    and checked against the checksums those releases publish; later they update themselves with one button
 *  - no local server and no open port: the downloads page talks to this module over the browser's own IPC
 *  - every program it starts is stopped when its job is cancelled or the browser closes
 *  - your sign-in on the site is passed along (only that site's cookies, in a temporary file deleted right after)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile, execFileSync } = require('child_process');

const isWin = process.platform === 'win32';
const exe = n => n + (isWin ? '.exe' : '');
const QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const clock = t => { t = Math.round(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + 'h' : '') + (h || m ? m + 'm' : '') + s + 's'; };
/* what the site wants with its video file (TikTok: its own page as Referer and the cookies of the moment the page was read) */
const COOKIE_ATTR = /^(domain|path|expires|max-age|secure|httponly|samesite|priority|partitioned)$/i;
function previewHeaders(f) {
  const h = {}, src = f.http_headers || {};
  if (src.Referer) h.Referer = src.Referer;
  if (src['User-Agent']) h['User-Agent'] = src['User-Agent'];
  const c = String(f.cookies || '').split(/;\s*/).map(x => x.split('=')).filter(([k, v]) => k && v != null && !COOKIE_ATTR.test(k.trim())).map(([k, ...v]) => k.trim() + '=' + v.join('='));
  if (c.length) h.Cookie = c.join('; ');
  return h.Referer || h.Cookie ? h : null;
}
const IMG = /\.(jpe?g|png|webp|gif|avif|bmp)$/i, VID = /\.(mp4|webm|mov|m4v|mkv)$/i, AUD = /\.(mp3|m4a|aac|ogg|opus|wav)$/i;
const MAX_JOBS = 3, MAX_IMAGES = 300;
// UTF-8 everywhere so Arabic titles and file names come through intact
const ENV = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

const TOOLS = {
  ytdlp: { file: exe('yt-dlp'), url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', sums: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS', name: 'yt-dlp.exe' },
  ffmpeg: { zip: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip', sums: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/checksums.sha256', name: 'ffmpeg-master-latest-win64-gpl-shared.zip' },
  gallerydl: { file: exe('gallery-dl'), api: 'https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest', name: 'gallery-dl.exe' }
};

class MediaEngine {
  /* opts: { dir (userData/media), outDir(), fetch (Electron net.fetch), jsRuntime (this exe), userAgent, log, onChange(job) } */
  constructor(opts) {
    this.o = opts;
    this.toolsDir = path.join(opts.dir, 'tools');
    this.tmp = path.join(os.tmpdir(), '3zt-media-' + process.pid);
    // left behind by a run that crashed: their programs are gone, so are their temp files
    try { for (const d of fs.readdirSync(os.tmpdir())) { const m = /^3zt-media-(\d+)$/.exec(d); if (m && +m[1] !== process.pid && !alive(+m[1])) fs.rm(path.join(os.tmpdir(), d), { recursive: true, force: true }, () => {}); } } catch (e) {}
    this.jobs = new Map();
    this.infos = new Map();       // preview details kept for the download: id -> { file, dir, url, t, key }
    this.procs = new Set();
    this.setup = null;            // running first-time setup (a promise)
    this.setupState = null;       // { stage, pct } while it runs
  }
  log(...a) { try { this.o.log && this.o.log(...a); } catch (e) {} }
  changed(job) { try { this.o.onChange && this.o.onChange(job); } catch (e) {} }

  /* ---------- tools ---------- */
  /* the tools that came with the setup (resources/tools); yt-dlp and gallery-dl are copied next to the
     profile once per version because they update themselves; FFmpeg is used where it is */
  packed() { const d = this.o.packedDir; return d && fs.existsSync(path.join(d, TOOLS.ytdlp.file)) ? d : null; }
  paths() {
    const pk = this.packed();
    const ff = pk && fs.existsSync(path.join(pk, 'ffmpeg', exe('ffmpeg'))) ? path.join(pk, 'ffmpeg') : path.join(this.toolsDir, 'ffmpeg');
    return { ytdlp: path.join(this.toolsDir, TOOLS.ytdlp.file), gallerydl: path.join(this.toolsDir, TOOLS.gallerydl.file), ffmpegDir: ff };
  }
  copyPacked() {
    // copied again only when a setup brought different files (a light update or "Update download tools" does not
    // bring back an older yt-dlp); the note is written only for files that were really copied
    const pk = this.packed(); if (!pk) return;
    fs.mkdirSync(this.toolsDir, { recursive: true });
    const stampF = path.join(this.toolsDir, 'packed.json');
    let stamp = {}; try { stamp = JSON.parse(fs.readFileSync(stampF, 'utf8')) || {}; } catch (e) {}
    for (const f of [TOOLS.ytdlp.file, TOOLS.gallerydl.file]) {
      const src = path.join(pk, f), dst = path.join(this.toolsDir, f);
      let id = ''; try { const st = fs.statSync(src); id = st.size + ':' + Math.round(st.mtimeMs); } catch (e) { continue; }
      if (fs.existsSync(dst) && stamp[f] === id) continue;
      try { fs.copyFileSync(src, dst); stamp[f] = id; } catch (e) { this.log('tool copy failed', f, e.message); }
    }
    try { fs.writeFileSync(stampF, JSON.stringify(stamp)); } catch (e) {}
  }
  ready() {
    const p = this.paths();
    return fs.existsSync(p.ytdlp) && fs.existsSync(p.gallerydl) && fs.existsSync(path.join(p.ffmpegDir, exe('ffmpeg')));
  }
  toolsInfo() { return { ready: this.ready(), setup: this.setupState }; }
  ensureTools() {
    if (!this.copied) { this.copied = true; try { this.copyPacked(); } catch (e) {} }   // tools from the setup: instant
    if (this.ready()) return Promise.resolve(true);
    if (!isWin) return Promise.reject(new Error('The download tools are only set up automatically on Windows'));
    if (!this.setup) {
      this.setup = this.installTools().finally(() => { this.setup = null; this.setupState = null; this.changed(null); });
    }
    return this.setup;
  }
  async download(url, dest, label, share) {
    const r = await this.o.fetch(url, { headers: { 'User-Agent': '3zT' } });
    if (!r.ok || !r.body) throw new Error(`${label}: HTTP ${r.status}`);
    const total = +r.headers.get('content-length') || 0;
    const part = dest + '.part';
    const out = fs.createWriteStream(part);
    const h = crypto.createHash('sha256');
    let got = 0, last = 0;
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      const b = Buffer.from(value); h.update(b); got += b.length;
      if (!out.write(b)) await new Promise(res => out.once('drain', res));
      if (total && Date.now() - last > 300) { last = Date.now(); this.setupState = { stage: label, pct: Math.round(share[0] + (share[1] - share[0]) * got / total) }; this.changed(null); }
    }
    await new Promise((res, rej) => out.end(e => (e ? rej(e) : res())));
    fs.renameSync(part, dest);
    return h.digest('hex');
  }
  async sumsFor(url, name) {
    const r = await this.o.fetch(url); if (!r.ok) throw new Error('checksums: HTTP ' + r.status);
    const line = (await r.text()).split(/\r?\n/).find(l => l.trim().endsWith(name) && /^[0-9a-f]{64}\s/i.test(l.trim()));
    if (!line) throw new Error('no checksum published for ' + name);
    return line.trim().split(/\s+/)[0].toLowerCase();
  }
  async installTools() {
    fs.mkdirSync(this.toolsDir, { recursive: true });
    const p = this.paths();
    const check = (got, want, what) => { if (got !== want) throw new Error(`${what}: checksum mismatch (download damaged or changed)`); };
    // 1. yt-dlp
    if (!fs.existsSync(p.ytdlp)) {
      const want = await this.sumsFor(TOOLS.ytdlp.sums, TOOLS.ytdlp.name);
      const tmp = p.ytdlp + '.new';
      check(await this.download(TOOLS.ytdlp.url, tmp, 'yt-dlp', [0, 15]), want, 'yt-dlp');
      fs.renameSync(tmp, p.ytdlp);
    }
    // 2. gallery-dl (Codeberg release, checked against its SHA256SUMS)
    if (!fs.existsSync(p.gallerydl)) {
      const r = await this.o.fetch(TOOLS.gallerydl.api, { headers: { 'User-Agent': '3zT' } });
      if (!r.ok) throw new Error('gallery-dl: HTTP ' + r.status);
      const rel = await r.json();
      const a = (rel.assets || []).find(x => x.name === TOOLS.gallerydl.name), s = (rel.assets || []).find(x => x.name === 'SHA256SUMS');
      if (!a || !s) throw new Error('gallery-dl: release files not found');
      const want = await this.sumsFor(s.browser_download_url, TOOLS.gallerydl.name);
      const tmp = p.gallerydl + '.new';
      check(await this.download(a.browser_download_url, tmp, 'gallery-dl', [15, 30]), want, 'gallery-dl');
      fs.renameSync(tmp, p.gallerydl);
    }
    // 3. ffmpeg (yt-dlp's own Windows builds), unpacked with Windows' tar
    if (!fs.existsSync(path.join(p.ffmpegDir, exe('ffmpeg')))) {
      const want = await this.sumsFor(TOOLS.ffmpeg.sums, TOOLS.ffmpeg.name);
      const zip = path.join(this.toolsDir, 'ffmpeg.zip');
      check(await this.download(TOOLS.ffmpeg.zip, zip, 'ffmpeg', [30, 95]), want, 'ffmpeg');
      this.setupState = { stage: 'ffmpeg', pct: 96 }; this.changed(null);
      const work = path.join(this.toolsDir, 'ffmpeg-unpack');
      fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work);
      const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
      await new Promise((res, rej) => { const pr = this.run(tar, ['-xf', zip, '-C', work]); pr.on('error', e => rej(new Error('ffmpeg unpack: ' + e.message))); pr.on('close', code => (code === 0 ? res() : rej(new Error('ffmpeg unpack failed (' + code + ')')))); });
      const top = fs.readdirSync(work).find(d => fs.statSync(path.join(work, d)).isDirectory());
      const bin = top && path.join(work, top, 'bin');
      if (!bin || !fs.existsSync(path.join(bin, 'ffmpeg.exe'))) throw new Error('ffmpeg: unexpected package');
      const next = p.ffmpegDir + '.new';
      fs.rmSync(next, { recursive: true, force: true }); fs.mkdirSync(next);
      for (const f of fs.readdirSync(bin)) if (/^(ffmpeg|ffprobe)\.exe$|\.dll$/i.test(f)) fs.copyFileSync(path.join(bin, f), path.join(next, f));
      fs.rmSync(p.ffmpegDir, { recursive: true, force: true });
      fs.renameSync(next, p.ffmpegDir);
      fs.rmSync(work, { recursive: true, force: true }); fs.rmSync(zip, { force: true });
    }
    this.log('media tools ready');
    return true;
  }
  /* "the site stopped working": yt-dlp and gallery-dl update themselves */
  async updateTools() {
    await this.ensureTools();
    // a running download keeps yt-dlp.exe open, so Windows would not let it replace itself
    if ([...this.jobs.values()].some(j => j.state === 'running')) throw new Error('busy-update');
    const p = this.paths();
    const one = (bin, args) => new Promise(res => {
      let out = ''; const pr = this.run(bin, args);
      pr.stdout.on('data', d => (out += d)); pr.stderr.on('data', d => (out += d));
      pr.on('error', e => res(String(e.message))); pr.on('close', () => res(out.trim().split(/\r?\n/).slice(-1).join(' ')));
    });
    return { ytdlp: await one(p.ytdlp, ['-U']), gallerydl: await one(p.gallerydl, ['-U']) };
  }

  /* ---------- processes ---------- */
  run(bin, args, env) {
    const p = spawn(bin, args, { env: env || ENV, windowsHide: true });
    this.procs.add(p); p.on('close', () => this.procs.delete(p)); p.on('error', () => this.procs.delete(p));
    return p;
  }
  killTree(p, wait) {
    if (!p || p.exitCode !== null) return;
    if (isWin) {
      const a = ['/PID', String(p.pid), '/T', '/F'];
      try { wait ? execFileSync('taskkill', a, { windowsHide: true, stdio: 'ignore', timeout: 5000 }) : execFile('taskkill', a, { windowsHide: true }, () => {}); } catch (e) {}
    } else { try { p.kill('SIGKILL'); } catch (e) {} }
  }
  lines(stream, cb) {
    let buf = ''; stream.setEncoding('utf8');
    const t = this.o.trace;   // tests: every line the tools print
    stream.on('data', d => { buf += d; let i; while ((i = buf.search(/\r?\n|\r/)) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) { if (t) t(l.trim()); cb(l.trim()); } } });
    stream.on('end', () => { if (buf.trim()) cb(buf.trim()); });
  }
  /* stop everything (browser closing) */
  close() {
    for (const p of this.procs) this.killTree(p, true);
    this.procs.clear();
    try { fs.rmSync(this.tmp, { recursive: true, force: true }); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  outDir() { const d = this.o.outDir(); fs.mkdirSync(d, { recursive: true }); return d; }
  freeName(dir, name) {
    const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
    let n = name, i = 2;
    while (fs.existsSync(path.join(dir, n))) n = `${base} (${i++})${ext}`;
    return n;
  }
  moveFile(src, dir, name) {
    const dest = path.join(dir, this.freeName(dir, name));
    try { fs.renameSync(src, dest); } catch (e) { fs.copyFileSync(src, dest); fs.rmSync(src, { force: true }); }
    return dest;
  }
  cleanErr(e) {
    const s = String(e || '');
    return s.split(/\r?\n/).filter(l => /error|unsupported|unable|not available|private|login|http|sign in/i.test(l)).slice(-3).join('\n') || s.slice(-400);
  }
  newJob(kind, url, extra) {
    const id = crypto.randomBytes(6).toString('hex');
    const dir = path.join(this.tmp, id);
    fs.mkdirSync(dir, { recursive: true });
    const job = Object.assign({ id, kind, url, state: 'running', pct: 0, stage: '', error: '', dir, proc: null, created: Date.now() }, extra);
    this.jobs.set(id, job);
    // only the last few finished jobs are kept
    const done = [...this.jobs.values()].filter(j => j.state !== 'running' && j.state !== 'trim');
    for (const j of done.slice(0, Math.max(0, done.length - 20))) { this.jobs.delete(j.id); fs.rm(j.dir, { recursive: true, force: true }, () => {}); }
    return job;
  }
  /* the site's cookies as a Netscape cookies.txt (yt-dlp/gallery-dl --cookies); deleted when the job ends */
  writeCookies(job, cookies) {
    if (!cookies || !cookies.length) return null;
    const f = path.join(job.dir, 'cookies.txt');
    const rows = ['# Netscape HTTP Cookie File'];
    for (const c of cookies) {
      const dom = (c.hostOnly ? '' : (c.domain.startsWith('.') ? '' : '.')) + c.domain;
      rows.push([dom, c.hostOnly ? 'FALSE' : 'TRUE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', Math.round(c.expirationDate || 0), c.name, c.value].join('\t'));
    }
    fs.writeFileSync(f, rows.join('\n') + '\n', { mode: 0o600 });
    return f;
  }
  commonArgs(job, cookies) {
    const a = [];
    const cf = this.writeCookies(job, cookies);
    if (cf) a.push('--cookies', cf);
    if (this.o.userAgent) a.push('--user-agent', this.o.userAgent);
    return a;
  }
  public(job) {
    const j = { id: job.id, kind: job.kind, url: job.url, state: job.state, pct: Math.round(job.pct || 0), stage: job.stage, error: job.error, name: job.name || '', file: job.file || null, title: job.title || '' };
    if (job.kind === 'images') j.items = (job.items || []).map((x, i) => ({ i, name: x.name, type: x.type, size: x.size, file: x.path }));
    if (job.state === 'trim') j.temp = job.temp;
    return j;
  }
  /* jobs of normal browsing (part = null) or of one private session */
  list(part) { return [...this.jobs.values()].filter(j => (j.partition || null) === (part || null)).sort((a, b) => b.created - a.created).map(j => this.public(j)); }
  /* a private session ended: its jobs and their temporary files go */
  forgetPartition(part) {
    for (const j of [...this.jobs.values()]) if (j.partition === part) {
      if (j.state === 'running') { j.state = 'cancelled'; this.killTree(j.proc); }
      this.jobs.delete(j.id); fs.rm(j.dir, { recursive: true, force: true }, () => {});
    }
  }
  get(id) { const j = this.jobs.get(id); return j ? this.public(j) : null; }

  /* ---------- video / audio (yt-dlp) ---------- */
  /* start/end (seconds): only that part is downloaded (yt-dlp --download-sections); exact: cut on the exact frame.
     infoId: the link's details from the preview, so yt-dlp starts downloading at once instead of reading the page again */
  async startVideo({ url, mode, q, trim, cookies, partition, winId, start, end, exact, infoId }) {
    if ([...this.jobs.values()].filter(j => j.kind === 'video' && j.state === 'running').length >= MAX_JOBS) throw new Error('busy');
    const job = this.newJob('video', url, { mode: mode === 'audio' ? 'audio' : 'video', trim: !!trim && mode !== 'audio', stage: 'tools', partition: partition || null, winId });
    const cut = isFinite(+start) && isFinite(+end) && +end - +start > 0.2 ? { s: Math.max(0, +start), e: +end } : null;
    const cached = this.infoFile(infoId, url);
    this.changed(job);
    try { await this.ensureTools(); } catch (e) { job.state = 'error'; job.error = 'tools: ' + e.message; this.changed(job); return this.public(job); }
    if (job.state === 'cancelled') return this.public(job);
    const p = this.paths();
    job.stage = 'preparing';
    const args = ['--no-playlist', '--newline', '--no-warnings', '--no-mtime', '--color', 'never',
      '-P', job.dir, '-o', '%(title).80B [%(id)s].%(ext)s',
      '--progress', '--progress-template', 'download:3ZTP %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s',
      '--print', 'before_dl:3ZTT %(title)s', '--print', 'after_move:3ZTF %(filepath)s',
      '--ffmpeg-location', p.ffmpegDir, ...this.commonArgs(job, cookies)];
    // YouTube needs a JavaScript runtime: this program works as Node.js (ELECTRON_RUN_AS_NODE)
    if (this.o.jsRuntime) args.push('--js-runtimes', 'node:' + this.o.jsRuntime);
    if (job.mode === 'audio') args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
    else args.push('-S', (q === 'best' || !QUALITIES.includes(q) ? 'res' : 'res:' + q) + ',vcodec:h264,acodec:m4a', '--merge-output-format', 'mp4');
    if (cut) job.cut = { s: cut.s, e: cut.e, exact: !!exact };
    /* the ways to get it, best first. A way that fails (or gives a file without the picture, or not cut) hands over
       to the next one, so a cut is never saved uncut and a video never saved as sound only:
         1. the preview's details (starts at once) + only the part
         2. the page read again (fresh links and cookies) + only the part
         3. the whole video, cut here afterwards */
    job.tries = [];
    if (cut) { if (cached) job.tries.push({ info: cached, part: true }); job.tries.push({ part: true }); job.tries.push({ part: false }); }
    else { if (cached) job.tries.push({ info: cached }); job.tries.push({}); }
    job.base = args;
    this.nextTry(job, p);
    return this.public(job);
  }
  nextTry(job, p) {
    const t = job.tries.shift();
    if (!t) { job.state = 'error'; job.error = job.lastErr || 'failed'; fs.rm(job.dir, { recursive: true, force: true }, () => {}); return this.changed(job); }
    // what an earlier try left behind goes (the cookies file stays for the next try)
    try { for (const f of fs.readdirSync(job.dir)) if (f !== 'cookies.txt') fs.rmSync(path.join(job.dir, f), { recursive: true, force: true }); } catch (e) {}
    job.pct = 0; job.raw = null; job.stage = 'preparing'; this.changed(job);
    const args = job.base.slice();
    if (t.part) {
      args.push('--download-sections', `*${job.cut.s.toFixed(2)}-${job.cut.e.toFixed(2)}`);
      if (job.cut.exact) args.push('--force-keyframes-at-cuts');   // the edges are encoded again so the cut is on the exact frame
    }
    if (t.info && fs.existsSync(t.info)) args.push('--load-info-json', t.info); else args.push('--', job.url);
    this.log('yt-dlp', job.url, job.mode, t.part ? 'part' : '', t.info ? 'cached' : '');
    const pr = job.proc = this.run(p.ytdlp, args, this.o.jsRuntime ? { ...ENV, ELECTRON_RUN_AS_NODE: '1' } : ENV);
    let err = '', final = '', part = 0, last = 0;
    const onLine = l => {
      if (l.startsWith('3ZTP ')) {
        const [, a, b] = l.split(' '); const d = +a, tt = +b;
        if (tt > 0) {
          const pc = Math.min(100, (d / tt) * 100);
          if (job.raw != null && pc + 20 < job.raw) part++;   // the next file (the audio after the video) started
          job.raw = pc;
          // one bar for the whole job: the picture is most of it, the sound the last bit
          job.pct = Math.min(99, part ? Math.max(job.pct, 90 + pc * 0.09) : pc * 0.9);
          job.stage = '';
        }
        if (Date.now() - last > 400) { last = Date.now(); this.changed(job); }
      } else if (l.startsWith('3ZTT ')) { job.title = l.slice(5).trim(); this.changed(job); }
      else if (l.startsWith('3ZTF ')) final = l.slice(5).trim();
      else if (/^\[(Merger|ExtractAudio|FixupM3u8|VideoConvertor)\]/.test(l)) { job.pct = 99; job.stage = 'finishing'; this.changed(job); }
      else if (/ERROR/i.test(l)) err = (err + '\n' + l).slice(-1500);
    };
    this.lines(pr.stdout, onLine);
    this.lines(pr.stderr, l => { onLine(l); if (!l.startsWith('3ZT')) err = (err + '\n' + l).slice(-1500); });
    let ended = false;
    const end = (code, why) => {
      if (ended) return; ended = true;
      if (why) job.lastErr = why;
      job.proc = null;
      if (job.state !== 'running') { fs.rm(job.dir, { recursive: true, force: true }, () => {}); return this.changed(job); }
      let src = final && fs.existsSync(final) ? final : null;
      if (!src) {
        const files = fs.readdirSync(job.dir).filter(f => !/\.(part|ytdl|temp|tmp|txt|json)$/i.test(f) && !/\.f\d+\./.test(f));
        files.sort((a, b) => fs.statSync(path.join(job.dir, b)).size - fs.statSync(path.join(job.dir, a)).size);
        if (files[0]) src = path.join(job.dir, files[0]);
      }
      if (code !== 0 || !src) { job.lastErr = this.cleanErr(err) || job.lastErr || 'failed'; return this.nextTry(job, p); }
      this.afterDownload(job, p, src, t).catch(e => {
        fs.rm(job.dir, { recursive: true, force: true }, () => {});
        if (job.state === 'running') { job.state = 'error'; job.error = String(e.message || e); }
        this.changed(job);
      });
    };
    pr.on('error', e => end(1, 'yt-dlp: ' + e.message));
    pr.on('close', code => end(code));
  }
  /* the file is checked before it is called done: it has a picture (video), it is the part you chose (cut),
     and it plays everywhere (HEVC, which Windows can't play without a paid add-on, becomes H.264) */
  async afterDownload(job, p, src, t) {
    const m = await this.probeMedia(src);
    if (job.state !== 'running') { fs.rm(job.dir, { recursive: true, force: true }, () => {}); return this.changed(job); }
    const empty = m.ok && (m.dur <= 0.2 || (job.mode === 'video' ? !m.video : !(m.audio || m.video)));
    if (empty) {
      job.lastErr = job.mode === 'video' && m.ok && !m.video ? 'no-picture' : 'empty';
      if (job.tries.length) return this.nextTry(job, p);
      throw new Error(job.lastErr);
    }
    const want = job.cut ? job.cut.e - job.cut.s : 0;
    // a "fast" cut may start at the key frame before your start: a few seconds longer is fine, the whole video is not
    const needCut = !!job.cut && (!t.part || (m.ok && m.dur > want + Math.max(8, want * 0.25)));
    const needConvert = job.mode === 'video' && m.ok && /^(hevc|h265)$/i.test(m.video || '');
    if (job.cut && !needCut && t.part) this.log('part ok', m.dur);
    let file = src;
    if (job.trim && !job.cut && VID.test(src)) {   // the old "trim after download" flow: waits for the part to keep
      job.pct = 100; job.name = path.basename(src); job.state = 'trim'; job.temp = src;
      try { fs.rmSync(path.join(job.dir, 'cookies.txt'), { force: true }); } catch (e) {}
      return this.changed(job);
    }
    if (needCut || needConvert) {
      const ext = job.mode === 'video' ? '.mp4' : path.extname(src);
      const tmp = path.join(job.dir, 'out-3zt' + ext);
      job.stage = needCut ? 'trimming' : 'converting'; job.pct = 0; this.changed(job);
      const s0 = needCut ? job.cut.s : 0, e0 = needCut ? job.cut.e : (m.dur || 1e7);
      await this.trimFile(src, s0, e0, needConvert || (needCut && job.cut.exact), tmp, pc => { job.pct = pc; this.changed(job); }, job);
      job.proc = null;
      if (job.state !== 'running') { fs.rm(job.dir, { recursive: true, force: true }, () => {}); return this.changed(job); }
      file = tmp;
    }
    // the name says it is a part: "Title [id] (1m57s-2m33s).mp4"
    let name = path.basename(src, path.extname(src));
    if (job.cut) name += ` (${clock(job.cut.s)}-${clock(job.cut.e)})`;
    name += path.extname(file);
    try { fs.rmSync(path.join(job.dir, 'cookies.txt'), { force: true }); } catch (e) {}
    job.file = this.moveFile(file, this.outDir(), name); job.name = path.basename(job.file);
    job.state = 'done'; job.stage = ''; job.pct = 100; job.error = '';
    fs.rm(job.dir, { recursive: true, force: true }, () => {});
    this.changed(job);
  }
  /* what a media file holds, from ffmpeg's own report: { ok, dur, video: codec or null, audio } */
  probeMedia(f) {
    return new Promise(res => {
      let out = '';
      let pr; try { pr = this.run(path.join(this.paths().ffmpegDir, exe('ffmpeg')), ['-hide_banner', '-i', f], ENV); } catch (e) { return res({ ok: false }); }
      const t = setTimeout(() => this.killTree(pr), 15000);
      pr.stderr.setEncoding('utf8'); pr.stderr.on('data', d => { if (out.length < 40000) out += d; });
      pr.on('error', () => { clearTimeout(t); res({ ok: false }); });   // can't check: trust the download
      pr.on('close', () => {
        clearTimeout(t);
        const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
        // a cover picture inside a sound file is not a video
        const vl = out.split(/\r?\n/).find(l => /Stream #.*: Video: /.test(l) && !/attached pic/.test(l));
        const v = vl && /: Video: (\w+)/.exec(vl);
        res({ ok: true, dur: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0, video: v ? v[1] : null, audio: /Stream #.*: Audio:/.test(out) });
      });
    });
  }


  /* ---------- the preview's details, reused by the download ---------- */
  infoFile(id, url) {
    const x = id && this.infos && this.infos.get(String(id));
    if (!x || Date.now() - x.t > 10 * 60 * 1000 || !fs.existsSync(x.file)) return null;   // stream addresses expire
    return x.url === url ? x.file : null;
  }
  pruneInfos() {
    for (const [id, x] of this.infos) if (Date.now() - x.t > 15 * 60 * 1000 || this.infos.size > 30) { this.infos.delete(id); fs.rm(x.dir, { recursive: true, force: true }, () => {}); }
  }
  /* the downloader window closed: everything of it stops and is forgotten (programs, temporary files, the list) */
  reset(part, key) {
    for (const j of [...this.jobs.values()]) if ((j.partition || null) === (part || null)) {
      j.state = 'cancelled';
      if (j.proc) this.killTree(j.proc);   // without waiting: closing the window must not freeze the browser
      this.jobs.delete(j.id); fs.rm(j.dir, { recursive: true, force: true }, () => {});
    }
    if (this.infoProcs && key != null && this.infoProcs.has(key)) { this.killTree(this.infoProcs.get(key)); this.infoProcs.delete(key); }
    for (const [id, x] of this.infos) if (key == null || x.key === key) { this.infos.delete(id); fs.rm(x.dir, { recursive: true, force: true }, () => {}); }
  }
  running(part) { return [...this.jobs.values()].some(j => (j.partition || null) === (part || null) && j.state === 'running'); }

  /* ---------- what is at this link (shown before downloading, to confirm) ---------- */
  async info({ url, cookies, key }) {
    await this.ensureTools();
    if (!this.infoProcs) this.infoProcs = new Map();
    if (key != null && this.infoProcs.has(key)) this.killTree(this.infoProcs.get(key));   // a newer link replaces the one still loading
    const p = this.paths();
    const dir = path.join(this.tmp, 'info-' + crypto.randomBytes(4).toString('hex'));
    fs.mkdirSync(dir, { recursive: true });
    const job = { dir };
    const args = ['-J', '--no-playlist', '--no-warnings', '--color', 'never', ...this.commonArgs(job, cookies)];
    if (this.o.jsRuntime) args.push('--js-runtimes', 'node:' + this.o.jsRuntime);
    args.push('--', url);
    return new Promise(res => {
      const pr = this.run(p.ytdlp, args, this.o.jsRuntime ? { ...ENV, ELECTRON_RUN_AS_NODE: '1' } : ENV);
      if (key != null) this.infoProcs.set(key, pr);
      let out = '', err = '';
      const t = setTimeout(() => this.killTree(pr), 45000);
      pr.stdout.setEncoding('utf8'); pr.stdout.on('data', d => { if (out.length < 30e6) out += d; });
      pr.stderr.setEncoding('utf8'); pr.stderr.on('data', d => (err = (err + d).slice(-2000)));
      const done = r => { clearTimeout(t); if (key != null && this.infoProcs.get(key) === pr) this.infoProcs.delete(key); fs.rm(path.join(dir, 'cookies.txt'), { force: true }, () => {}); res(r); };
      pr.on('error', e => done({ error: e.message }));
      pr.on('close', () => {
        let j = null; try { j = JSON.parse(out); } catch (e) {}
        if (!j) { fs.rm(dir, { recursive: true, force: true }, () => {}); return done({ error: this.cleanErr(err) || 'no-info' }); }
        // kept for the download (--load-info-json) for a few minutes
        const infoId = crypto.randomBytes(6).toString('hex');
        // kept as the tool wrote it: some sites (TikTok) only send the video with the cookies of the moment the page
        // was read. Readable by this user only, deleted after 10 minutes, when the window closes, or at the next start after a crash
        try { fs.writeFileSync(path.join(dir, 'info.json'), out, { mode: 0o600 }); this.infos.set(infoId, { file: path.join(dir, 'info.json'), dir, url, t: Date.now(), key }); } catch (e) {}
        this.pruneInfos();
        // a light stream for the preview player: one file with picture and sound, plain http(s), 480p or less
        const fm = (j.formats || []).filter(f => f.url && /^https?$/.test(f.protocol || '') && f.vcodec !== 'none' && f.acodec !== 'none' && (f.vcodec || f.acodec || /^(mp4|webm|m4v|mov)$/.test(f.ext || '')) && !/dash|m3u8/.test(f.protocol || ''));
        const pv = fm.filter(f => (f.height || 0) <= 480).sort((a, b) => (b.height || 0) - (a.height || 0))[0] || fm.sort((a, b) => (a.height || 0) - (b.height || 0))[0];
        const thumbs = (j.thumbnails || []).filter(x => x.url && /^https:/.test(x.url));
        const best = thumbs.filter(x => (x.width || 0) <= 1280).sort((a, b) => (b.width || 0) - (a.width || 0))[0] || thumbs[thumbs.length - 1];
        done({ title: j.title || '', thumbnail: (j.thumbnail && /^https:/.test(j.thumbnail) ? j.thumbnail : best && best.url) || '', duration: j.duration || 0,
          uploader: j.uploader || j.channel || '', site: j.extractor_key || j.extractor || '', url: j.webpage_url || url,
          heights: [...new Set((j.formats || []).map(f => f.height).filter(Boolean))].sort((a, b) => b - a).slice(0, 8),
          photos: !(j.formats || []).some(f => f.vcodec && f.vcodec !== 'none') && !j.duration,
          infoId, preview: pv ? pv.url : '', previewHeaders: pv ? previewHeaders(pv) : null });
      });
    });
  }

  /* ---------- photos (gallery-dl) ---------- */
  async startImages({ url, cookies, partition, winId }) {
    const job = this.newJob('images', url, { items: [], stage: 'tools', partition: partition || null, winId });
    this.changed(job);
    try { await this.ensureTools(); } catch (e) { job.state = 'error'; job.error = 'tools: ' + e.message; this.changed(job); return this.public(job); }
    if (job.state === 'cancelled') return this.public(job);
    job.stage = '';
    const p = this.paths();
    const files = path.join(job.dir, 'files'); fs.mkdirSync(files);
    const args = ['--no-colors', '-D', files, '--range', '1-' + MAX_IMAGES, ...this.commonArgs(job, cookies), '--', url];
    this.log('gallery-dl', url);
    const pr = job.proc = this.run(p.gallerydl, args);
    let err = '';
    const add = f => {
      f = f.replace(/^# /, '').replace(/^\\\\\?\\/, '').trim();
      if (!f || !f.startsWith(files) || !fs.existsSync(f) || job.items.some(x => x.path === f)) return;
      const ext = path.extname(f).toLowerCase();
      const type = IMG.test(f) ? 'image' : VID.test(f) ? 'video' : AUD.test(f) ? 'audio' : 'file';
      job.items.push({ path: f, name: path.basename(f), type, size: fs.statSync(f).size, ext });
      this.changed(job);
    };
    this.lines(pr.stdout, l => { try { add(l); } catch (e) {} });
    this.lines(pr.stderr, l => (err = (err + '\n' + l).slice(-2000)));
    pr.on('error', e => { job.state = 'error'; job.error = 'gallery-dl: ' + e.message; this.changed(job); });
    pr.on('close', () => {
      job.proc = null;
      try { fs.rmSync(path.join(job.dir, 'cookies.txt'), { force: true }); } catch (e) {}
      if (job.state === 'error' || job.state === 'cancelled') return this.changed(job);
      try {
        const rest = fs.readdirSync(files).map(f => path.join(files, f)).filter(f => fs.statSync(f).isFile() && !/\.part$/i.test(f));
        rest.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs).forEach(add);
      } catch (e) {}
      if (job.items.length) job.state = 'done';
      else { job.state = 'error'; job.error = this.cleanErr(err) || 'no-photos'; }
      this.changed(job);
    });
    return this.public(job);
  }
  saveImages(id, idx) {
    const job = this.jobs.get(id);
    if (!job || job.kind !== 'images' || job.state !== 'done') throw new Error('expired');
    const dir = this.outDir(), saved = [];
    for (const i of [...new Set((idx || []).map(Number))].filter(i => i >= 0 && i < job.items.length).sort((a, b) => a - b)) {
      const it = job.items[i]; if (!it || !fs.existsSync(it.path)) continue;
      const stem = it.name.slice(0, it.name.length - it.ext.length).split(' ')[0].slice(0, 60) || 'photo';
      const dest = path.join(dir, this.freeName(dir, stem + it.ext));
      fs.copyFileSync(it.path, dest);
      saved.push(dest);
    }
    return saved;
  }

  cancel(id) {
    const job = this.jobs.get(id); if (!job) return false;
    if (job.state === 'running') { job.state = 'cancelled'; this.killTree(job.proc); }
    else if (job.state === 'trim') { job.state = 'cancelled'; fs.rm(job.dir, { recursive: true, force: true }, () => {}); }
    this.changed(job);
    return true;
  }

  /* ---------- trimming (ffmpeg) ----------
     exact=false: the streams are copied as they are (no quality change, very fast); the cut snaps to the nearest
                  key frame before the start, so it can begin up to a few seconds early.
     exact=true:  the picture is encoded again (H.264, high quality) so the cut is on the exact frame; slower,
                  and like any re-encode not bit-identical to the original. */
  trimFile(src, start, end, exact, dest, onPct, owner) {
    const p = this.paths();
    const dur = Math.max(0.1, end - start);
    const args = ['-hide_banner', '-nostdin', '-y', '-ss', start.toFixed(3), '-i', src, '-t', dur.toFixed(3), '-map', '0:v:0?', '-map', '0:a?'];
    const audio = AUD.test(dest);
    if (exact) args.push(...(audio ? [] : ['-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']), ...(/\.mp3$/i.test(dest) ? ['-c:a', 'libmp3lame', '-q:a', '0'] : ['-c:a', 'aac', '-b:a', '192k']));
    else args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
    if (/\.(mp4|m4v|mov|m4a)$/i.test(dest)) args.push('-movflags', '+faststart');
    args.push('-progress', 'pipe:1', dest);
    return new Promise((res, rej) => {
      const pr = this.run(path.join(p.ffmpegDir, exe('ffmpeg')), args);
      if (owner) owner.proc = pr;   // so Cancel can stop it
      let err = '';
      this.lines(pr.stdout, l => { const m = /^out_time_us=(\d+)/.exec(l); if (m && onPct) onPct(Math.min(99, (+m[1] / 1e6) / dur * 100)); });
      pr.stderr.on('data', d => (err = (err + d).slice(-2000)));
      pr.on('error', rej);
      pr.on('close', code => (code === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0 ? res(dest) : rej(new Error(this.cleanErr(err) || 'ffmpeg failed'))));
    });
  }
  /* a job waiting for "pick the part to keep" -> trimmed file in the output folder */
  async finishTrim(id, { start, end, exact, whole }) {
    const job = this.jobs.get(id);
    if (!job || job.state !== 'trim' || !job.temp || !fs.existsSync(job.temp)) throw new Error('expired');
    const name = path.basename(job.temp);
    if (whole) {
      job.file = this.moveFile(job.temp, this.outDir(), name);
    } else {
      job.state = 'running'; job.stage = 'trimming'; job.pct = 0; this.changed(job);
      const ext = exact && !AUD.test(name) ? '.mp4' : path.extname(name) || '.mp4';
      const outName = this.freeName(this.outDir(), name.slice(0, name.length - path.extname(name).length) + ' (clip)' + ext);
      const dest = path.join(this.outDir(), outName);
      let failed = null;
      try { await this.trimFile(job.temp, +start, +end, !!exact, dest, pc => { job.pct = pc; this.changed(job); }, job); }
      catch (e) { failed = e; }
      job.proc = null;
      if (job.state === 'cancelled' || failed) {
        try { fs.rmSync(dest, { force: true }); } catch (x) {}
        if (job.state === 'cancelled') { fs.rm(job.dir, { recursive: true, force: true }, () => {}); this.changed(job); return this.public(job); }
        job.state = 'trim'; job.stage = ''; job.error = String(failed.message || failed); this.changed(job); throw failed;
      }
      job.file = dest;
    }
    job.name = path.basename(job.file); job.state = 'done'; job.stage = ''; job.pct = 100; job.error = '';
    fs.rm(job.dir, { recursive: true, force: true }, () => {});
    this.changed(job);
    return this.public(job);
  }
  /* trim any video already on disk (from the downloads list): a new file next to it */
  async trimExisting(src, { start, end, exact }, onPct, owner) {
    await this.ensureTools();
    const dir = path.dirname(src), name = path.basename(src), ext = exact && !AUD.test(name) ? '.mp4' : path.extname(name) || '.mp4';
    const dest = path.join(dir, this.freeName(dir, name.slice(0, name.length - path.extname(name).length) + ' (clip)' + ext));
    try { return await this.trimFile(src, +start, +end, !!exact, dest, onPct, owner); }
    catch (e) { try { fs.rmSync(dest, { force: true }); } catch (x) {} throw e; }
  }
}

module.exports = { MediaEngine, QUALITIES };
