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
    this.jobs = new Map();
    this.procs = new Set();
    this.setup = null;            // running first-time setup (a promise)
    this.setupState = null;       // { stage, pct } while it runs
  }
  log(...a) { try { this.o.log && this.o.log(...a); } catch (e) {} }
  changed(job) { try { this.o.onChange && this.o.onChange(job); } catch (e) {} }

  /* ---------- tools ---------- */
  paths() {
    return { ytdlp: path.join(this.toolsDir, TOOLS.ytdlp.file), gallerydl: path.join(this.toolsDir, TOOLS.gallerydl.file), ffmpegDir: path.join(this.toolsDir, 'ffmpeg') };
  }
  ready() {
    const p = this.paths();
    return fs.existsSync(p.ytdlp) && fs.existsSync(p.gallerydl) && fs.existsSync(path.join(p.ffmpegDir, exe('ffmpeg')));
  }
  toolsInfo() { return { ready: this.ready(), setup: this.setupState }; }
  ensureTools() {
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
      await new Promise((res, rej) => execFile(tar, ['-xf', zip, '-C', work], { windowsHide: true }, e => (e ? rej(new Error('ffmpeg unpack: ' + e.message)) : res())));
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
    stream.on('data', d => { buf += d; let i; while ((i = buf.search(/\r?\n|\r/)) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) cb(l.trim()); } });
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
  list() { return [...this.jobs.values()].sort((a, b) => b.created - a.created).map(j => this.public(j)); }
  get(id) { const j = this.jobs.get(id); return j ? this.public(j) : null; }

  /* ---------- video / audio (yt-dlp) ---------- */
  async startVideo({ url, mode, q, trim, cookies }) {
    if ([...this.jobs.values()].filter(j => j.kind === 'video' && j.state === 'running').length >= MAX_JOBS) throw new Error('busy');
    const job = this.newJob('video', url, { mode: mode === 'audio' ? 'audio' : 'video', trim: !!trim && mode !== 'audio', stage: 'tools' });
    this.changed(job);
    try { await this.ensureTools(); } catch (e) { job.state = 'error'; job.error = 'tools: ' + e.message; this.changed(job); return this.public(job); }
    if (job.state === 'cancelled') return this.public(job);
    const p = this.paths();
    job.stage = '';
    const args = ['--no-playlist', '--newline', '--no-warnings', '--no-mtime', '--color', 'never',
      '-P', job.dir, '-o', '%(title).80B [%(id)s].%(ext)s',
      '--progress', '--progress-template', 'download:3ZTP %(progress.downloaded_bytes)s %(progress.total_bytes,progress.total_bytes_estimate)s',
      '--print', 'before_dl:3ZTT %(title)s', '--print', 'after_move:3ZTF %(filepath)s',
      '--ffmpeg-location', p.ffmpegDir, ...this.commonArgs(job, cookies)];
    // YouTube needs a JavaScript runtime: this program works as Node.js (ELECTRON_RUN_AS_NODE)
    if (this.o.jsRuntime) args.push('--js-runtimes', 'node:' + this.o.jsRuntime);
    if (job.mode === 'audio') args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
    else args.push('-S', (q === 'best' || !QUALITIES.includes(q) ? 'res' : 'res:' + q) + ',vcodec:h264,acodec:m4a', '--merge-output-format', 'mp4');
    args.push('--', url);
    this.log('yt-dlp', url, job.mode, q || '');
    const pr = job.proc = this.run(p.ytdlp, args, this.o.jsRuntime ? { ...ENV, ELECTRON_RUN_AS_NODE: '1' } : ENV);
    let err = '', final = '', part = 0, last = 0;
    const onLine = l => {
      if (l.startsWith('3ZTP ')) {
        const [, a, b] = l.split(' '); const d = +a, t = +b;
        if (t > 0) { const pc = Math.min(99, (d / t) * 100); if (pc + 20 < job.pct) part++; job.pct = pc; job.stage = part ? 'part' + (part + 1) : ''; }
        if (Date.now() - last > 400) { last = Date.now(); this.changed(job); }
      } else if (l.startsWith('3ZTT ')) { job.title = l.slice(5).trim(); this.changed(job); }
      else if (l.startsWith('3ZTF ')) final = l.slice(5).trim();
      else if (/^\[(Merger|ExtractAudio|FixupM3u8|VideoConvertor)\]/.test(l)) { job.pct = 99; job.stage = 'finishing'; this.changed(job); }
      else if (/ERROR/i.test(l)) err = (err + '\n' + l).slice(-1500);
    };
    this.lines(pr.stdout, onLine);
    this.lines(pr.stderr, l => { onLine(l); if (!l.startsWith('3ZT')) err = (err + '\n' + l).slice(-1500); });
    pr.on('error', e => { job.state = 'error'; job.error = 'yt-dlp: ' + e.message; this.changed(job); });
    pr.on('close', code => {
      job.proc = null;
      try { fs.rmSync(path.join(job.dir, 'cookies.txt'), { force: true }); } catch (e) {}
      if (job.state === 'error' || job.state === 'cancelled') { fs.rm(job.dir, { recursive: true, force: true }, () => {}); return this.changed(job); }
      let src = final && fs.existsSync(final) ? final : null;
      if (!src) {
        const files = fs.readdirSync(job.dir).filter(f => !/\.(part|ytdl|temp|tmp|txt)$/i.test(f) && !/\.f\d+\./.test(f));
        files.sort((a, b) => fs.statSync(path.join(job.dir, b)).size - fs.statSync(path.join(job.dir, a)).size);
        if (files[0]) src = path.join(job.dir, files[0]);
      }
      if (code === 0 && src) {
        job.pct = 100; job.name = path.basename(src);
        if (job.trim && VID.test(src)) { job.state = 'trim'; job.temp = src; }   // waits in the temp folder until you pick the part to keep
        else {
          try { job.file = this.moveFile(src, this.outDir(), job.name); job.name = path.basename(job.file); job.state = 'done'; }
          catch (e) { job.state = 'error'; job.error = 'save: ' + e.message; }
          fs.rm(job.dir, { recursive: true, force: true }, () => {});
        }
      } else { job.state = 'error'; job.error = this.cleanErr(err) || 'failed'; fs.rm(job.dir, { recursive: true, force: true }, () => {}); }
      this.changed(job);
    });
    return this.public(job);
  }

  /* ---------- photos (gallery-dl) ---------- */
  async startImages({ url, cookies }) {
    const job = this.newJob('images', url, { items: [], stage: 'tools' });
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
  trimFile(src, start, end, exact, dest, onPct) {
    const p = this.paths();
    const dur = Math.max(0.1, end - start);
    const args = ['-hide_banner', '-nostdin', '-y', '-ss', start.toFixed(3), '-i', src, '-t', dur.toFixed(3), '-map', '0:v:0?', '-map', '0:a?'];
    if (exact) args.push('-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k');
    else args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
    args.push('-movflags', '+faststart', '-progress', 'pipe:1', dest);
    return new Promise((res, rej) => {
      const pr = this.run(path.join(p.ffmpegDir, exe('ffmpeg')), args);
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
      const ext = exact ? '.mp4' : path.extname(name) || '.mp4';
      const outName = this.freeName(this.outDir(), name.slice(0, name.length - path.extname(name).length) + ' (clip)' + ext);
      const dest = path.join(this.outDir(), outName);
      try { await this.trimFile(job.temp, +start, +end, !!exact, dest, pc => { job.pct = pc; this.changed(job); }); }
      catch (e) { try { fs.rmSync(dest, { force: true }); } catch (x) {} job.state = 'trim'; job.stage = ''; job.error = String(e.message || e); this.changed(job); throw e; }
      job.file = dest;
    }
    job.name = path.basename(job.file); job.state = 'done'; job.stage = ''; job.pct = 100; job.error = '';
    fs.rm(job.dir, { recursive: true, force: true }, () => {});
    this.changed(job);
    return this.public(job);
  }
  /* trim any video already on disk (from the downloads list): a new file next to it */
  async trimExisting(src, { start, end, exact }, onPct) {
    await this.ensureTools();
    const dir = path.dirname(src), name = path.basename(src), ext = exact ? '.mp4' : path.extname(name) || '.mp4';
    const dest = path.join(dir, this.freeName(dir, name.slice(0, name.length - path.extname(name).length) + ' (clip)' + ext));
    return this.trimFile(src, +start, +end, !!exact, dest, onPct);
  }
}

module.exports = { MediaEngine, QUALITIES };
