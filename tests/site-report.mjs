// Compares the site check of 3zT with the one of Google Chrome (tests/site-check.mjs) and lists, per website,
// what goes wrong only in 3zT, plus the ads 3zT still shows. Writes tests/out/site-report.md and .json.
//   node tests/site-report.mjs <folder with sites-*.json>
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'tests/out';
const load = label => {
  const out = { sites: new Map(), startMs: [] };
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (new RegExp(`^sites-${label}-\\d+\\.json$`).test(f.name)) { const j = JSON.parse(fs.readFileSync(p, 'utf8')); for (const s of j.sites) out.sites.set(s.url, s); out.startMs.push(j.startMs); } } };
  walk(dir);
  return out;
};
const Z = load('3zT'), C = load('Chrome');
const host = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
const rows = [], ads = [];
for (const [url, z] of Z.sites) {
  const c = C.sites.get(url) || {}, zl = z.look || {}, cl = c.look || {};
  const issues = [];
  if (z.crash) issues.push('check crashed: ' + z.crash);
  if (z.navError && !c.navError) issues.push('does not open: ' + z.navError);
  if (zl.challenge && !cl.challenge) issues.push('bot check: "' + zl.challenge + '"');
  if (zl.denied && !cl.denied) issues.push('refused: "' + zl.denied + '"');
  if (zl.oldBrowser && !cl.oldBrowser) issues.push('browser refused: "' + zl.oldBrowser + '"');
  if (z.status >= 400 && !(c.status >= 400)) issues.push(`HTTP ${z.status} (Chrome ${c.status || '?'})`);
  if (z.loadMs === -1 && c.loadMs > 0) issues.push(`never finished loading (Chrome ${c.loadMs} ms)`);
  else if (z.loadMs > 8000 && c.loadMs > 0 && z.loadMs > 2 * c.loadMs) issues.push(`slow: ${z.loadMs} ms (Chrome ${c.loadMs} ms)`);
  const cErr = new Set(c.errors || []);
  const newErr = (z.errors || []).filter(e => !cErr.has(e));
  if (newErr.length) issues.push('script errors only in 3zT: ' + newErr.slice(0, 3).join(' | '));
  if (cl.text > 500 && zl.text < 0.4 * cl.text) issues.push(`content missing: ${zl.text} characters of text (Chrome ${cl.text})`);
  if (zl.wide > 20 && !(cl.wide > 5)) issues.push(`page wider than the window by ${zl.wide}px`);
  if ((zl.broken || 0) > (cl.broken || 0) + 2) issues.push(`${zl.broken} broken images (Chrome ${cl.broken || 0})`);
  if ((z.failed || []).length > (c.failed || []).length + 5) issues.push(`${z.failed.length} failed requests (Chrome ${(c.failed || []).length}): ` + z.failed.slice(0, 3).join(', '));
  if (zl.adFrames && zl.adFrames.length || zl.adEls) ads.push({ url, adFrames: zl.adFrames || [], adEls: zl.adEls || 0, sample: zl.adElsSample || [], chromeAds: (cl.adFrames || []).length + (cl.adEls || 0) });
  rows.push({ idx: z.idx, url, group: z.group, issues, blocked: z.blocked, status: z.status, loadMs: z.loadMs, chromeLoadMs: c.loadMs, chromeLook: cl, look: zl });
}
rows.sort((a, b) => a.idx - b.idx);
const bad = rows.filter(r => r.issues.length);
let md = `# Site check: 3zT compared with Google Chrome\n\n${rows.length} websites (${rows.filter(r => r.group === 'global').length} global, ${rows.filter(r => r.group === 'arabic').length} Arabic). `;
md += `Start until the first page: 3zT ${Z.startMs.join(' / ')} ms, Chrome ${C.startMs.join(' / ')} ms.\n\n`;
md += `## Problems only 3zT has (${bad.length})\n\n| # | Site | Problem |\n|---|---|---|\n`;
for (const r of bad) md += `| ${r.idx} | ${host(r.url)} | ${r.issues.join('<br>').replace(/\|/g, '/')} |\n`;
md += `\n## Ads still showing in 3zT (${ads.length})\n\n| Site | Ad frames | Ad slots | Chrome (no blocker) |\n|---|---|---|---|\n`;
for (const a of ads) md += `| ${host(a.url)} | ${a.adFrames.length} ${a.adFrames.slice(0, 2).join(' ')} | ${a.adEls} ${a.sample.join(', ')} | ${a.chromeAds} |\n`;
md += `\n## Every site\n\n| # | Site | HTTP | Load 3zT / Chrome | Blocked | Text 3zT / Chrome | Challenge |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.idx} | ${host(r.url)} | ${r.status} | ${r.loadMs} / ${r.chromeLoadMs} | ${r.blocked} | ${r.look.text || 0} / ${r.chromeLook.text || 0} | ${r.look.challenge || r.look.denied || r.look.oldBrowser || ''}${r.chromeLook.challenge || r.chromeLook.denied ? ' (Chrome: ' + (r.chromeLook.challenge || r.chromeLook.denied) + ')' : ''} |\n`;
fs.writeFileSync(path.join(dir, 'site-report.md'), md);
fs.writeFileSync(path.join(dir, 'site-report.json'), JSON.stringify({ bad, ads }, null, 1));
console.log(md.split('## Every site')[0]);
