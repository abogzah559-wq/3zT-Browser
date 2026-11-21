// The names of TikTok's parts for the TikTok / Instagram layout (src/sociallayout.js), without Electron.
//   node tests/social.mjs
// With internet it also checks the copy on GitHub (the one installed browsers download).
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
const require = createRequire(import.meta.url);
const L = require('../src/sociallayout.js');

let fails = 0;
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`); };
const throws = f => { try { f(); return false; } catch (e) { return true; } };

// the built-in file is valid and complete
let b = null; try { b = L.validate(L.BUILTIN); } catch (e) { ok('the built-in names are valid', false, e.message); }
ok('the built-in names are valid, with every part', !!b && L.TT_KEYS.every(k => b.tiktok[k] && b.tiktok[k].length), b ? L.TT_KEYS.map(k => k + ':' + (b.tiktok[k] || []).length).join(' ') : '');

// what a downloaded file may not be
const good = { version: 2, tiktok: { actions: ['[data-e2e="new-actions"]', 'div > section'] }, instagram: { navLabel: 'reel' } };
ok('a file with only some parts is accepted (child selectors too)', !throws(() => L.validate(good)));
ok('no version: refused', throws(() => L.validate({ tiktok: { actions: ['a'] } })));
ok('no buttons names: refused', throws(() => L.validate({ version: 1, tiktok: { caption: ['a'] } })));
ok('anything that could be a style or a tag: refused', throws(() => L.validate({ version: 1, tiktok: { actions: ['a{color:red}'] } })) && throws(() => L.validate({ version: 1, tiktok: { actions: ['<script>'] } })) && throws(() => L.validate({ version: 1, tiktok: { actions: ['a;b'] } })));
ok('very long names or lists: refused', throws(() => L.validate({ version: 1, tiktok: { actions: ['a'.repeat(201)] } })) && throws(() => L.validate({ version: 1, tiktok: { actions: Array(17).fill('a') } })));
ok('a broken Instagram pattern: refused', throws(() => L.validate({ version: 1, tiktok: { actions: ['a'] }, instagram: { navLabel: '(' } })));
ok('not an object: refused', throws(() => L.validate(null)) && throws(() => L.validate([1])) && throws(() => L.validate('x')));

// merging: downloaded names first, the built-in ones kept after them
const m = L.merge(L.validate(good));
ok('downloaded names come first, the built-in ones stay as a fallback', m.tiktok.actions[0] === '[data-e2e="new-actions"]' && m.tiktok.actions.includes(L.BUILTIN.tiktok.actions[0]) && m.tiktok.caption.length === L.BUILTIN.tiktok.caption.length && m.instagram.navLabel === 'reel');
ok('nothing downloaded: the built-in names', JSON.stringify(L.merge(null).tiktok) === JSON.stringify(L.BUILTIN.tiktok));

// refresh: a bad answer changes nothing; a good one is kept on disk and used after a restart; 304 keeps it
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-'));
const resp = (status, body, etag) => new Response(status === 304 ? null : body, { status, headers: etag ? { etag } : {} });
let s = new L.SocialLayout(dir);
let r = await s.refresh(async () => resp(200, '{"version":1,"tiktok":{"actions":["a{}"]}}'), true).then(x => x, e => 'error ' + e.message);
ok('a bad download is refused and the names stay as they were', /error/.test(String(r)) && JSON.stringify(s.rules) === JSON.stringify(L.merge(null)), String(r));
r = await s.refresh(async () => resp(200, JSON.stringify(good), '"e1"'), true).then(x => x, e => 'error ' + e.message);
ok('a good download is used', r === true && s.rules.tiktok.actions[0] === '[data-e2e="new-actions"]', String(r));
s = new L.SocialLayout(dir);
ok('...and kept for the next start', s.rules.tiktok.actions[0] === '[data-e2e="new-actions"]');
let sent = null;
r = await s.refresh(async (u, h) => { sent = h; return resp(304); }, true);
ok('"not changed" (304) keeps the names, asking with the last ETag', r === false && sent && sent['If-None-Match'] === '"e1"' && s.rules.tiktok.actions[0] === '[data-e2e="new-actions"]');
let calls = 0; await s.refresh(async () => { calls++; return resp(304); });
ok('not asked again within a few hours', calls === 0);
fs.rmSync(dir, { recursive: true, force: true });

// the layout script and its CSS: the CSS styles only our own marks
const css = fs.readFileSync(new URL('../src/inject/social-view.css', import.meta.url), 'utf8');
const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(x => x.trim()).filter(x => !x.startsWith('@') && !/^\d/.test(x));
const foreign = sels.filter(x => /\[class|\[data-e2e|Div|Section/.test(x.replace(/\[data-e2e\*="follow"\]/, '').replace(/\[data-e2e\$="-count"\]/, '').replace(/\[class\*="(tux-interaction-container|SpanTuxIconWrapper)"\]/g, '')));
ok('the CSS never positions TikTok\'s parts by TikTok\'s names (only by our marks)', foreign.length === 0, foreign.join(' | '));
const js = fs.readFileSync(new URL('../src/inject/social-view.js', import.meta.url), 'utf8');
ok('the layout script takes its names from the rules', /const TT = RULES\.tiktok;/.test(js) && !/anchoring-engagement-vertical/.test(js));

// the copy on GitHub that installed browsers download
const online = await fetch(L.URL_RAW, { signal: AbortSignal.timeout(8000) }).then(async r => ({ status: r.status, text: await r.text() }), () => null);
if (!online) console.log('social: no internet, the GitHub copy is not checked');
else if (online.status === 404) console.log('social: the GitHub copy is not on the main branch yet (404)');
else {
  let v = null; try { v = L.validate(JSON.parse(online.text)); } catch (e) { v = e.message; }
  ok('the copy on GitHub is valid', v && typeof v === 'object', typeof v === 'string' ? v : 'version ' + v.version);
}
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
