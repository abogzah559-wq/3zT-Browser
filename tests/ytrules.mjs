// Offline checks for src/ytrules.js (how AdGuard's YouTube rules are read and chosen). No network, no Electron:
//
//   node tests/ytrules.mjs            (also run by tests/e2e.mjs with the "features" part)
//
// The list below is written for this test; it only has the shape of AdGuard's rules.
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const Y = createRequire(import.meta.url)('../src/ytrules.js');

export function ytrulesUnit(ok) {
  const list = [
    '! a comment line #%#nothing()',
    'example.org##.banner',
    'foo.com#%#x()',
    'bazyoutube.com#%#x()',
    'youtube.com#%#a()',
    'www.youtube.com#%#b()',
    'www.youtube.com#@%#b()',
    'youtube.com,~m.youtube.com#%#c()',
    '[$path=/tv]youtube.com#%#d()',
    ''
  ].join('\r\n');
  const p = Y.parse(list);
  ok('YouTube rules: comments, other rule kinds and other sites are left out', p.rules.length === 3 && p.exceptions.length === 1
    && !p.rules.some(r => r.body === 'x()' || r.body === 'nothing()'), JSON.stringify(p.rules.map(r => r.body)));
  const www = Y.pick(p, 'www.youtube.com'), m = Y.pick(p, 'm.youtube.com');
  ok('YouTube rules: a youtube.com rule applies to www and m', www.includes('a()') && m.includes('a()'), `www ${www}, m ${m}`);
  ok('YouTube rules: an exception (#@%#) cancels the same rule', !www.includes('b()'), String(www));
  ok('YouTube rules: ~m.youtube.com keeps a rule off m only', www.includes('c()') && !m.includes('c()'), `www ${www}, m ${m}`);
  ok('YouTube rules: rules with [$...] modifiers are not used', !p.rules.some(r => r.body === 'd()') && p.bracketed === 1, String(p.bracketed));
  ok('YouTube rules: a domain ending in "youtube.com" is not YouTube', !Y.match('bazyoutube.com', 'youtube.com') && Y.match('www.youtube.com', 'youtube.com'));

  const ex = "//scriptlet('json-prune-xhr-response', 'playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots', '', '/playlist\\?list=|\\/player(?!.*(get_drm_license))|watch\\?[tv]=|get_watch\\?/')";
  const want = ['json-prune-xhr-response', 'playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots', '',
    '/playlist\\?list=|\\/player(?!.*(get_drm_license))|watch\\?[tv]=|get_watch\\?/'];
  const got = Y.parseScriptlet(ex);
  ok('YouTube rules: scriptlet arguments are read exactly', JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  const q = Y.parseScriptlet("//scriptlet('set-constant', 'it\\'s', \"a\\\"b\")");
  ok('YouTube rules: an escaped quote inside an argument is the quote itself', JSON.stringify(q) === JSON.stringify(['set-constant', "it's", 'a"b']), JSON.stringify(q));
  ok('YouTube rules: a malformed scriptlet is refused', Y.parseScriptlet("//scriptlet('a', b)") === null && Y.parseScriptlet("//scriptlet('a)") === null);

  const body = '! Title: test\n! Version: 1\n\n\nyoutube.com#%#a()\n';
  const sum = crypto.createHash('md5').update(body.replace(/\n+/g, '\n'), 'utf8').digest('base64').replace(/=+$/, '');
  const good = body.replace('! Version: 1\n', '! Version: 1\n! Checksum: ' + sum + '\r\n'), bad = body.replace('! Version: 1\n', '! Version: 1\n! Checksum: AAAAAAAAAAAAAAAAAAAAAA\n');
  ok('YouTube rules: the list checksum is checked', Y.checksum(good).ok && !Y.checksum(bad).ok && !Y.checksum(body).ok, JSON.stringify(Y.checksum(good)));

  // turning rules into code: a scriptlet gets (source, args), a broken rule is reported and the rest still built
  const lib = { version: 't', scriptlets: [{ names: ['set-constant', 'set.js'], scriptlet: 'function setConstant(source,args){window.__sc=[source.name,args]}' }] };
  const b = Y.build(["//scriptlet('set-constant', 'x', '1')", 'window.__raw=1;', "//scriptlet('no-such', 'x')", 'this is not ( javascript'], lib, { engine: '3zT', domainName: 'www.youtube.com' });
  const sandbox = {}; sandbox.window = sandbox;
  createRequire(import.meta.url)('vm').runInNewContext(b.code, sandbox);
  ok('YouTube rules: rules become one script; bad ones are skipped, the rest run', b.ok === 2 && b.failed.length === 2
    && JSON.stringify(sandbox.__sc) === JSON.stringify(['set-constant', ['x', '1']]) && sandbox.__raw === 1, `ok ${b.ok}, failed ${b.failed.length}, ran ${JSON.stringify(sandbox.__sc)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let failed = 0;
  ytrulesUnit((name, pass, info = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info && !pass ? '  - ' + info : ''}`); });
  process.exit(failed ? 1 : 0);
}
