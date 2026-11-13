// Diagnosis: what a "fast" (no re-encode) part download looks like inside, on a video whose key frames are far
// apart (like many YouTube music videos). Prints each stream's start, the edit list and the first frames' times.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import http from 'node:http'; import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { MediaEngine } = require('../src/media/engine.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dl = fs.mkdtempSync(path.join(os.tmpdir(), '3zt-cut-'));
const m = new MediaEngine({ dir: path.join(dl, 'profile'), outDir: () => dl, fetch: (u, o) => fetch(u, o), jsRuntime: process.execPath, packedDir: path.join(root, 'tools-cache'), version: 'test', log: () => {} });
const note = (t, s) => console.log(`::notice title=${t}::${String(s).replace(/\r?\n/g, ' | ').slice(0, 2500)}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await m.ensureTools();
const ff = path.join(m.paths().ffmpegDir, 'ffmpeg.exe'), fp = path.join(m.paths().ffmpegDir, 'ffprobe.exe');
const src = path.join(dl, 'gop.mp4');
// 120 s, a key frame only every 12 s, sound throughout
execFileSync(ff, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=500', '-t', '120', '-c:v', 'libx264', '-g', '360', '-keyint_min', '360', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src]);
const srv = http.createServer((q, r) => {
  const b = fs.readFileSync(src), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || '');
  if (rg) { const s = +rg[1], e = rg[2] ? +rg[2] : b.length - 1; r.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${s}-${e}/${b.length}`, 'Content-Length': e - s + 1, 'Accept-Ranges': 'bytes' }); return r.end(b.subarray(s, e + 1)); }
  r.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': b.length, 'Accept-Ranges': 'bytes' }); r.end(b);
}).listen(8799);
const probe = f => {
  const j = JSON.parse(execFileSync(fp, ['-v', 'error', '-show_entries', 'format=start_time,duration:stream=index,codec_type,start_time,duration', '-of', 'json', f]).toString());
  const frames = s => { try { return execFileSync(fp, ['-v', 'error', '-select_streams', s, '-show_entries', 'packet=pts_time,flags', '-read_intervals', '%+#4', '-of', 'csv=p=0', f]).toString().trim().replace(/\r?\n/g, ' ; '); } catch (e) { return 'err'; } };
  let elst = ''; try { execFileSync(fp, ['-v', 'trace', '-i', f], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { elst = String(e.stderr || ''); }
  try { elst = execFileSync(ff, ['-v', 'trace', '-i', f], { stdio: ['ignore', 'ignore', 'pipe'] }).toString(); } catch (e) { elst = String(e.stderr || ''); }
  const el = (elst.match(/elst[^\n]*|edit list[^\n]*|duration=\d+ time=[^\n]*/gi) || []).slice(0, 6).join(' ; ');
  return `format start ${j.format.start_time} dur ${j.format.duration} · streams ${j.streams.map(s => s.codec_type + ' start ' + s.start_time + ' dur ' + s.duration).join(', ')} · first video packets ${frames('v:0')} · first audio packets ${frames('a:0')} · edit list: ${el}`;
};
for (const exact of [false, true]) {
  const r = await m.startVideo({ url: 'http://127.0.0.1:8799/gop.mp4', mode: 'video', q: 'best', cookies: [], start: 97, end: 107, exact });
  let j; for (;;) { j = m.get(r.id); if (!j || !['running', 'trim'].includes(j.state)) break; await sleep(500); }
  note(`fast-mode diagnosis: ${exact ? 'exact' : 'fast'} 97-107 s`, j && j.file ? path.basename(j.file) + ' · ' + probe(j.file) : 'failed ' + (j && j.error));
}
srv.close(); process.exit(0);
