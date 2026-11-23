// Site check: open many widely used websites in one browser session and record what each page looks like to a
// visitor. Run once with 3zT and once with Google Chrome (new profiles, same machine), then compare the two with
// tests/site-report.mjs: a problem only 3zT has is one 3zT has to fix.
//
//   node tests/site-check.mjs <label> <browser.exe> [part] [parts]
//     label   3zT or Chrome (3zT starts with a new profile in %APPDATA%\3zT Browser)
//     part    1-based slice of the site list to check, out of `parts` slices (default: all)
//
// For every page: the main document's HTTP status, load time, uncaught script errors, failed requests (and
// requests stopped by the ad blocker, separately), bot checks and "browser not supported" pages, page width
// wider than the window, the amount of text, broken images, ad frames and ad slots still showing, and a small
// screenshot. Writes tests/out/sites-<label>-<part>.json and screenshots in tests/out/sites/, and one line per
// site to the log (SITEJSON), so the report can also be made from the log alone.
// SITE_URLS (comma-separated) checks only those addresses.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOBAL, ARABIC } from './site-list.mjs';

const [label, exe, partArg, partsArg] = process.argv.slice(2);
const part = +partArg || 1, parts = +partsArg || 1;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const SHOTS = path.join(OUT, 'sites');
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 9410;
const is3zt = /^3zt/i.test(label);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIST = process.env.SITE_URLS ? process.env.SITE_URLS.split(',').map(url => ({ url, group: 'chosen' })) : [...GLOBAL.map(url => ({ url, group: 'global' })), ...ARABIC.map(url => ({ url, group: 'arabic' }))];
const per = Math.ceil(LIST.length / parts);
const SITES = LIST.slice((part - 1) * per, part * per);

async function targets() { return (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
async function connect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('connect timeout')), 10000); });
  let id = 0; const wait = new Map(); const ev = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else ev.forEach(f => f(d)); };
  const send = (method, params = {}, ms = 30000) => new Promise(r => { const i = ++id; wait.set(i, r); try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { r({}); } setTimeout(() => { if (wait.has(i)) { wait.delete(i); r({}); } }, ms); });
  const val = async (expr, ms = 30000) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, ms);
    if (r.result && r.result.exceptionDetails) { const x = r.result.exceptionDetails; return { evalError: ((x.exception && x.exception.description) || x.text || '').slice(0, 300) }; }
    if (!r.result) return { evalError: r.error ? r.error.message : 'no answer' };
    return r.result.result ? r.result.result.value : undefined;
  };
  return { send, val, on: f => ev.push(f), off: f => { const i = ev.indexOf(f); if (i >= 0) ev.splice(i, 1); }, close: () => ws.close() };
}
const procName = p => path.basename(p, '.exe');
function kill() { try { execSync(`taskkill /IM ${procName(exe)}.exe /T /F`, { stdio: 'ignore' }); } catch (e) {} }

// what a visitor would notice on the page (run in the page)
const LOOK = `(() => {
  const body = document.body, txt = body ? body.innerText || '' : '';
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 30 || r.height < 20 || r.bottom < 0 || r.top > innerHeight * 3) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const AD = /doubleclick\\.net|googlesyndication|googleadservices|adnxs\\.com|taboola|outbrain|criteo|amazon-adsystem|adform\\.net|pubmatic|rubiconproject|openx\\.net|smartadserver|teads\\.tv|33across|sharethrough|mgid\\.com|revcontent|adsterra|propellerads|popads|ezoic|media\\.net|moatads|adsafeprotected|infolinks|casalemedia|sovrn|gumgum|seedtag|triplelift|yieldmo|adtelligent/i;
  const frames = [...document.querySelectorAll('iframe')];
  const adFrames = frames.filter(f => vis(f) && AD.test(f.src || '')).map(f => (f.src || '').slice(0, 80));
  const adEls = [...document.querySelectorAll('ins.adsbygoogle, [id^="google_ads_iframe"], [id*="div-gpt-ad"], [data-google-query-id], [id^="taboola-"], .trc_related_container, .OUTBRAIN, [data-ad-slot], [class*="ad-slot"], [class*="adslot"], [id^="ad-slot"], [class^="ad-container"], [class*=" ad-container"]')].filter(vis);
  const head = (document.title + ' ' + txt.slice(0, 4000));
  const challenge = (/just a moment|verify you are human|checking (if the site connection is secure|your browser)|attention required|are you a robot|unusual traffic|press (&|and) hold|enable javascript and cookies to continue|access to this page has been denied|request unsuccessful\\. incapsula/i.exec(head) || [])[0] || '';
  const denied = (/access denied|403 forbidden|you don.t have permission to access|not available in your (country|region)|غير متاح في (بلدك|منطقتك)/i.exec(head) || [])[0] || '';
  const oldBrowser = (/browser (is )?not supported|unsupported browser|update your browser|upgrade your browser|switch to a supported browser|this browser (may not be|isn.t) secure|المتصفح غير مدعوم|حدّث متصفحك|حدث متصفحك/i.exec(head) || [])[0] || '';
  const imgs = [...document.images].filter(i => i.src && !i.src.startsWith('data:') && i.loading !== 'lazy' && vis(i));
  return {
    title: document.title.slice(0, 120), url: location.href.slice(0, 200), text: txt.length,
    wide: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    imgs: imgs.length, broken: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
    videos: document.querySelectorAll('video').length, frames: frames.length,
    adFrames, adEls: adEls.length, adElsSample: adEls.slice(0, 3).map(e => (e.id || e.className || e.tagName).toString().slice(0, 60)),
    challenge, denied, oldBrowser, lang: document.documentElement.lang || '', dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction
  };
})()`;

async function visit(c, url, idx) {
  const rec = { url, status: 0, loadMs: 0, errors: [], failed: [], blocked: 0, requests: 0 };
  let mainFrame = null;
  const t0 = Date.now();
  let loaded = false;
  const f = d => {
    const p = d.params || {};
    if (d.method === 'Page.frameNavigated' && !p.frame.parentId) mainFrame = p.frame.id;
    if (d.method === 'Network.requestWillBeSent') rec.requests++;
    if (d.method === 'Network.responseReceived' && p.type === 'Document' && !rec.status && (!mainFrame || p.frameId === mainFrame)) rec.status = p.response.status;
    if (d.method === 'Network.loadingFailed') {
      if (/BLOCKED_BY_CLIENT/.test(p.errorText)) rec.blocked++;
      else if (!p.canceled && rec.failed.length < 15) rec.failed.push(p.type + ' ' + p.errorText);
    }
    if (d.method === 'Runtime.exceptionThrown' && rec.errors.length < 10) {
      const x = p.exceptionDetails; rec.errors.push(((x.exception && x.exception.description) || x.text || '').split('\n')[0].slice(0, 160));
    }
    if (d.method === 'Page.loadEventFired' && !loaded) { loaded = true; rec.loadMs = Date.now() - t0; }
  };
  c.on(f);
  const nav = await c.send('Page.navigate', { url });
  if (nav.result && nav.result.errorText) rec.navError = nav.result.errorText;
  for (let i = 0; i < 50 && !loaded; i++) await sleep(500);   // up to 25 s
  if (!loaded) rec.loadMs = -1;
  await sleep(3500);   // late content: ads, consent boxes, players
  rec.look = await c.val(LOOK) || null;
  try {
    const s = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 45 }, 15000);
    if (s.result) fs.writeFileSync(path.join(SHOTS, `${String(idx).padStart(3, '0')}-${label}.jpg`), Buffer.from(s.result.data, 'base64'));
  } catch (e) {}
  c.off(f);
  return rec;
}

async function main() {
  if (!exe || !fs.existsSync(exe)) { console.log(`::error title=site check::no browser at ${exe}`); process.exit(1); }
  kill(); await sleep(1500);
  let args = [`--remote-debugging-port=${PORT}`];
  if (is3zt) { try { fs.rmSync(path.join(process.env.APPDATA, '3zT Browser'), { recursive: true, force: true }); } catch (e) {} }
  else args.push('--no-first-run', '--no-default-browser-check', '--disable-sync', '--window-size=1366,860', `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'sites-'))}`, 'about:blank');
  const started = Date.now();
  const child = spawn(exe, args, { detached: true, stdio: ['ignore', is3zt ? fs.openSync(path.join(OUT, `sites-${label}-${part}.log`), 'w') : 'ignore', is3zt ? fs.openSync(path.join(OUT, `sites-${label}-${part}.err.log`), 'w') : 'ignore'] });
  child.unref();
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    await sleep(500);
    try { const t = await targets(); page = t.find(x => x.type === 'page' && (is3zt ? x.url.includes('newtab.html') : !x.url.startsWith('chrome') && !x.url.startsWith('devtools'))); } catch (e) {}
  }
  if (!page) { console.log(`::error title=site check::${label} did not open`); kill(); process.exit(1); }
  const startMs = Date.now() - started;
  // the ad blocker's full lists and the YouTube rules are downloaded a few seconds after start
  await sleep(25000);
  const c = await connect(page);
  await c.send('Page.enable'); await c.send('Network.enable'); await c.send('Runtime.enable');
  const result = { label, part, parts, startMs, sites: [] };
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i], idx = (part - 1) * per + i + 1;
    let r;
    try { r = await visit(c, s.url, idx); } catch (e) { r = { url: s.url, crash: String(e && e.message || e) }; }
    r.group = s.group; r.idx = idx;
    result.sites.push(r);
    console.log('SITEJSON ' + JSON.stringify(r));
    console.log(`${idx} ${s.url} -> ${r.status} ${r.loadMs}ms err ${r.errors ? r.errors.length : '?'} blocked ${r.blocked} ${r.look ? (r.look.challenge || r.look.denied || r.look.oldBrowser || '') : 'no look'}`);
    fs.writeFileSync(path.join(OUT, `sites-${label}-${part}.json`), JSON.stringify(result, null, 1));
  }
  fs.writeFileSync(path.join(OUT, `sites-${label}-${part}.json`), JSON.stringify(result, null, 1));
  console.log('SITEMETA ' + JSON.stringify({ label, part, startMs }));
  c.close(); kill();
}
main().catch(e => { console.log('::error title=site check::' + (e && e.stack || e)); kill(); process.exit(1); });
