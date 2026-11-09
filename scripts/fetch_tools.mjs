// The video downloader's tools, shipped inside the setup (resources/tools) so nothing is fetched on first use:
//   <out>/yt-dlp.exe, <out>/gallery-dl.exe, <out>/ffmpeg/{ffmpeg.exe, ffprobe.exe, *.dll}
// usage: node scripts/fetch_tools.mjs <out dir>   (GH_TOKEN optional, avoids API rate limits)
// yt-dlp and gallery-dl are checked against the SHA-256 sums their releases publish.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BIN = path.resolve(process.argv[2] || 'tools-cache');
fs.rmSync(BIN, { recursive: true, force: true });
fs.mkdirSync(path.join(BIN, 'ffmpeg'), { recursive: true });
const H = { 'User-Agent': '3zt-download-build', Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: 'Bearer ' + process.env.GH_TOKEN } : {}) };

// newest release (of the last 15) that has an asset matching `re`
async function asset(repo, rel, re) {
  const url = rel === 'any' ? `https://api.github.com/repos/${repo}/releases?per_page=15` : `https://api.github.com/repos/${repo}/releases/${rel}`;
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${repo} ${rel}: HTTP ${r.status} ${await r.text()}`);
  const list = [].concat(await r.json()).filter(x => !x.draft && !x.prerelease);
  for (const j of list) {
    const a = j.assets.find(x => re.test(x.name));
    if (a) { console.log(`${repo} ${j.tag_name}: ${a.name} (${(a.size / 1048576).toFixed(1)} MB)`); return a.browser_download_url; }
  }
  throw new Error(`${repo}: no asset like ${re} in ${list.map(j => j.tag_name + ' [' + j.assets.map(x => x.name).join(', ') + ']').join('; ')}`);
}
async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': H['User-Agent'] }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

{
  const url = await asset('yt-dlp/yt-dlp', 'latest', /^yt-dlp\.exe$/);
  await download(url, path.join(BIN, 'yt-dlp.exe'));
  const sums = await (await fetch(url.replace(/yt-dlp\.exe$/, 'SHA2-256SUMS'), { redirect: 'follow' })).text();
  const want = (sums.split(/\r?\n/).find(l => /\syt-dlp\.exe$/.test(l)) || '').split(/\s+/)[0];
  const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(BIN, 'yt-dlp.exe'))).digest('hex');
  if (!want || want !== got) throw new Error(`yt-dlp.exe checksum mismatch ${got} != ${want}`);
  console.log('yt-dlp.exe sha256 ok');
}
// gallery-dl moved to Codeberg: take the newest release there, check its SHA256
{
  const r = await fetch('https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest', { headers: { 'User-Agent': H['User-Agent'] } });
  if (!r.ok) throw new Error('codeberg gallery-dl: HTTP ' + r.status);
  const j = await r.json();
  const exe = j.assets.find(x => x.name === 'gallery-dl.exe'), sums = j.assets.find(x => x.name === 'SHA256SUMS');
  if (!exe) throw new Error('codeberg gallery-dl ' + j.tag_name + ': no gallery-dl.exe in ' + j.assets.map(x => x.name).join(', '));
  console.log(`mikf/gallery-dl (codeberg) ${j.tag_name}: gallery-dl.exe`);
  const dest = path.join(BIN, 'gallery-dl.exe');
  await download(exe.browser_download_url, dest);
  // its checksum: the release's SHA256SUMS when it has one, otherwise the same version on GitHub (GitHub publishes each file's SHA-256)
  const got = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
  let want = '', from = '';
  if (sums) {
    const txt = await (await fetch(sums.browser_download_url)).text();
    want = (txt.split(/\r?\n/).find(l => /\sgallery-dl\.exe$/.test(l)) || '').split(/\s+/)[0]; from = 'SHA256SUMS';
  }
  if (!want) {
    try {
      const g = await (await fetch(`https://api.github.com/repos/mikf/gallery-dl/releases/tags/${j.tag_name}`, { headers: H })).json();
      const a = (g.assets || []).find(x => x.name === 'gallery-dl.exe');
      if (a && /^sha256:/.test(a.digest || '')) { want = a.digest.slice(7); from = 'GitHub release ' + j.tag_name; }
    } catch (e) {}
  }
  if (want) {
    if (want !== got) throw new Error(`gallery-dl.exe checksum mismatch ${got} != ${want} (${from})`);
    console.log('gallery-dl.exe sha256 ok (' + from + ')');
  } else {
    // neither place publishes a checksum for this version: the file came over HTTPS from the author's own release
    console.log(`::warning title=gallery-dl::${j.tag_name}: no published checksum to compare with (sha256 ${got})`);
  }
}
const zip = path.join(BIN, 'ff.zip');
{
  const url = await asset('yt-dlp/FFmpeg-Builds', 'tags/latest', /^ffmpeg-master-latest-win64-gpl-shared\.zip$/);
  await download(url, zip);
  const sums = await (await fetch(url.replace(/[^/]+$/, 'checksums.sha256'), { redirect: 'follow' })).text();
  const want = (sums.split(/\r?\n/).find(l => /ffmpeg-master-latest-win64-gpl-shared\.zip$/.test(l.trim())) || '').trim().split(/\s+/)[0];
  const got = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  if (!want || want !== got) throw new Error(`ffmpeg zip checksum mismatch ${got} != ${want}`);
  console.log('ffmpeg zip sha256 ok');
}
// Windows' own tar (bsdtar) opens zip files; Git Bash's GNU tar does not
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';
execFileSync(TAR, ['-xf', 'ff.zip'], { stdio: 'inherit', cwd: BIN });
const top = fs.readdirSync(BIN).find(d => d.startsWith('ffmpeg-') && fs.statSync(path.join(BIN, d)).isDirectory());
const src = path.join(BIN, top, 'bin');
for (const f of fs.readdirSync(src)) if (/^(ffmpeg|ffprobe)\.exe$|\.dll$/i.test(f)) fs.copyFileSync(path.join(src, f), path.join(BIN, 'ffmpeg', f));
fs.rmSync(path.join(BIN, top), { recursive: true, force: true });
fs.rmSync(zip, { force: true });
console.log('tools ready:', fs.readdirSync(BIN).join(', '), '| ffmpeg:', fs.readdirSync(path.join(BIN, 'ffmpeg')).join(', '));
