// Real-site check of the downloader engine (runs on the Windows test machine, which can reach the sites).
// Every result is printed as a GitHub annotation; the tool output goes to tests/out/media-real.log.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { MediaEngine } = require('../src/media/engine.js');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, 'tests', 'out'); fs.mkdirSync(out, { recursive: true });
const logF = path.join(out, 'media-real.log'); fs.writeFileSync(logF, '');
const log = (...a) => fs.appendFileSync(logF, a.join(' ') + '\n');
const dl = fs.mkdtempSync(path.join(os.tmpdir(), '3zt-real-'));
const m = new MediaEngine({ dir: path.join(dl, 'profile'), outDir: () => dl, fetch: (u, o) => fetch(u, o), jsRuntime: process.execPath,
  packedDir: path.join(root, 'tools-cache'), version: 'test', log, trace: l => log('  |', l) });
const ffprobe = path.join(m.paths().ffmpegDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
const probe = f => { try { return JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration,start_time:stream=codec_type,codec_name,width,height', '-of', 'json', f]).toString()); } catch (e) { return { error: String(e.message).slice(0, 200) }; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wait(id, ms = 300000) { const t = Date.now(); for (;;) { const j = m.get(id); if (!j || !['running', 'trim'].includes(j.state)) return j; if (Date.now() - t > ms) return { ...j, state: 'timeout' }; await sleep(500); } }
const note = (ok, title, msg) => console.log(`::${ok ? 'notice' : 'error'} title=${title}::${String(msg).replace(/\r?\n/g, ' | ').slice(0, 900)}`);
let fails = 0;
async function check(name, url, o, expect) {
  log(`\n===== ${name}: ${url} ${JSON.stringify(o)}`);
  let infoId;
  if (o.useInfo) { const i = await m.info({ url, cookies: [], key: name }); log('info', JSON.stringify({ ...i, heights: undefined })); if (i.error) { fails++; return note(false, name, 'info: ' + i.error); } infoId = i.infoId; }
  const t0 = Date.now();
  const r = await m.startVideo({ url, mode: o.mode || 'video', q: o.q || 'best', cookies: [], start: o.start, end: o.end, exact: o.exact, infoId });
  const j = await wait(r.id);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!j || j.state !== 'done') { fails++; return note(false, name, `state ${j && j.state}: ${j && j.error} (${secs}s)`); }
  const p = probe(j.file);
  const streams = (p.streams || []).map(s => `${s.codec_type}:${s.codec_name}${s.width ? ' ' + s.width + 'x' + s.height : ''}`).join(', ');
  const d = +(p.format && p.format.duration);
  const problems = expect({ d, p, j });
  if (problems) fails++;
  note(!problems, name, `${problems ? 'FAIL ' + problems + ' — ' : 'PASS '}${path.basename(j.file)} · ${d.toFixed(2)} s · ${streams} · ${secs}s`);
}
const vidOk = (p, codec) => { const v = (p.streams || []).find(s => s.codec_type === 'video'); return !v ? 'no picture' : codec && v.codec_name !== codec ? 'video is ' + v.codec_name : ''; };
const near = (d, want, tol) => (Math.abs(d - want) <= tol ? '' : `length ${d.toFixed(2)} s, wanted ${want} s`);
const YT = process.env.YT_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const TT = process.env.TT_URL || 'https://www.tiktok.com/@scout2015/video/6718335390845095173';
await check('youtube part fast (with preview)', YT, { useInfo: true, start: 117.2, end: 153 }, ({ d, p }) => vidOk(p) || near(d, 35.8, 4));
await check('youtube part exact (with preview)', YT, { useInfo: true, start: 60, end: 72.5, exact: true }, ({ d, p }) => vidOk(p) || near(d, 12.5, 0.4));
await check('youtube part exact (no preview)', YT, { start: 30, end: 40, exact: true }, ({ d, p }) => vidOk(p) || near(d, 10, 0.4));
await check('youtube part mp3', YT, { useInfo: true, mode: 'audio', start: 20, end: 30 }, ({ d }) => near(d, 10, 1));
await check('tiktok video (with preview)', TT, { useInfo: true }, ({ p }) => vidOk(p, 'h264'));
await check('tiktok video (no preview)', TT, {}, ({ p }) => vidOk(p, 'h264'));
await check('tiktok part exact', TT, { useInfo: true, start: 1, end: 4, exact: true }, ({ d, p }) => vidOk(p, 'h264') || near(d, 3, 0.4));
m.close && m.close();
// the tools' own errors and format choices, for reading without the log file
const L = fs.readFileSync(logF, 'utf8').split('\n');
const keep = L.filter(l => /ERROR|WARNING: \[|\[info\] .*Downloading .*format|\[download\] Destination|=====|Merger|download-sections|ffmpeg command line|section/i.test(l));
for (let i = 0; i < keep.length; i += 12) console.log(`::notice title=log ${i / 12 + 1}::${keep.slice(i, i + 12).join(' || ').slice(0, 3500)}`);
console.log(`media-real: ${fails} failed`);
process.exit(0);
