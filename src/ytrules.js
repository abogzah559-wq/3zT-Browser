'use strict';
/*
 * YouTube rules from AdGuard Base filter - the pure part (no Electron), so it can be tested on its own.
 *
 * AdGuard's filter list is plain text. The lines that matter here are script rules for YouTube:
 *   youtube.com,~m.youtube.com#%#//scriptlet('set-constant', 'ytInitialPlayerResponse.adSlots', 'undefined')
 *   www.youtube.com#%#(function(){ ...raw JavaScript... })();
 *   www.youtube.com#@%#...   (an exception: the same rule must not run there)
 * "Scriptlets" are named functions from AdGuard's scriptlet library; the rule gives the name and the arguments.
 *
 *   parse(text)                 every YouTube script rule and exception in the list, in file order
 *   pick(parsed, host)          the rule bodies that apply to one host
 *   parseScriptlet(body)        //scriptlet('name', 'a', 'b') -> ['name', 'a', 'b'], or null if malformed
 *   checksum(text)              checks the list's own "! Checksum:" line
 *   build(bodies, lib, source)  turns the bodies into one page script (each rule on its own, a bad one cannot
 *                               stop the others); reports the rules that could not be used
 */
const crypto = require('crypto');
const vm = require('vm');

const BASES = ['youtube.com', 'youtube-nocookie.com', 'youtubekids.com'];
// a host is the domain itself or one of its subdomains; a domain with a wildcard matches nothing
const match = (h, d) => !!h && !!d && !d.includes('*') && (h === d || h.endsWith('.' + d));

function parse(text) {
  const rules = [], exceptions = [];
  let bracketed = 0;
  for (let line of String(text).split('\n')) {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (!line || line[0] === '!') continue;
    let mark = '#@%#', i = line.indexOf(mark);
    if (i < 0) { mark = '#%#'; i = line.indexOf(mark); }
    if (i < 0) continue;
    const head = line.slice(0, i), body = line.slice(i + mark.length);
    // rules with modifiers ([$path=/tv]...) are for other YouTube apps (TV); not used here
    if (head[0] === '[') { bracketed++; continue; }
    const pos = [], neg = [];
    for (let d of head.split(',')) {
      d = d.trim();
      if (!d) continue;
      if (d[0] === '~') neg.push(d.slice(1)); else pos.push(d);
    }
    if (!pos.some(d => BASES.some(b => match(d, b)))) continue;
    (mark === '#%#' ? rules : exceptions).push({ pos, neg, body });
  }
  return { rules, exceptions, bracketed };
}

const appliesTo = (r, h) => r.pos.some(d => match(h, d)) && !r.neg.some(d => match(h, d));

function pick(parsed, host) {
  if (typeof parsed === 'string') parsed = parse(parsed);
  const off = new Set(parsed.exceptions.filter(x => appliesTo(x, host)).map(x => x.body));
  return parsed.rules.filter(r => appliesTo(r, host) && !off.has(r.body)).map(r => r.body);
}

const isScriptlet = body => body.startsWith('//scriptlet(') && body.endsWith(')');

function parseScriptlet(body) {
  if (!isScriptlet(body)) return null;
  const s = body.slice('//scriptlet('.length, -1), out = [];
  let i = 0;
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  for (;;) {
    skip();
    const q = s[i];
    if (q !== "'" && q !== '"') return null;
    i++;
    let v = '', closed = false;
    while (i < s.length) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) {
        const n = s[i + 1];
        v += n === q ? q : c + n;
        i += 2;
        continue;
      }
      if (c === q) { closed = true; i++; break; }
      v += c; i++;
    }
    if (!closed) return null;
    out.push(v);
    skip();
    if (i >= s.length) return out;
    if (s[i] !== ',') return null;
    i++;
  }
}

function checksum(text) {
  const m = /^! Checksum: *(\S+)/m.exec(String(text).replace(/\r/g, ''));
  if (!m) return { ok: false, expected: '', actual: '' };
  const body = String(text).replace(/\r/g, '')
    .split('\n').filter(l => !l.startsWith('! Checksum:')).join('\n')
    .replace(/\n+/g, '\n');
  const actual = crypto.createHash('md5').update(body, 'utf8').digest('base64').replace(/=+$/, '');
  return { ok: actual === m[1], expected: m[1], actual };
}

// lib: the parsed scriptlets.corelibs.json; source: { engine, version, verbose, domainName }
function build(bodies, lib, source) {
  const byName = new Map();
  for (const e of (lib && Array.isArray(lib.scriptlets)) ? lib.scriptlets : []) {
    if (e && Array.isArray(e.names) && typeof e.scriptlet === 'string') for (const n of e.names) if (!byName.has(n)) byName.set(n, e);
  }
  const parts = [], failed = [];
  for (const body of bodies) {
    let code = null;
    if (!body.startsWith('//scriptlet(')) code = body;
    else {
      const a = parseScriptlet(body), e = a && byName.get(a[0]);
      if (e) {
        const src = Object.assign({}, source, { name: a[0], args: a.slice(1) });
        code = '(' + e.scriptlet + ')(' + JSON.stringify(src) + ',' + JSON.stringify(a.slice(1)) + ');';
      }
    }
    if (code !== null) { try { new vm.Script(code); } catch (x) { code = null; } }   // compiled only, never run here
    if (code === null) { failed.push(body); continue; }
    parts.push('try{' + code + '\n}catch(e){}');
  }
  return { code: parts.join('\n;\n'), ok: parts.length, failed };
}

// the three rules that answer YouTube's current ad-blocker checks; a list without them is not accepted
function markers(bodies) {
  return {
    adStatus: bodies.some(b => b.includes('google_ad_status')),
    timeout: bodies.some(b => b.includes('adjust-setTimeout') && b.includes('17000')),
    abnormality: bodies.some(b => b.includes('onAbnormalityDetected'))
  };
}

module.exports = { BASES, match, parse, pick, parseScriptlet, checksum, build, markers };
