// DuckDuckGo's Autoconsent (MPL-2.0): answers cookie-consent popups ("reject" / "necessary only") for the
// cookie-popup setting. Taken from the npm registry at build time, pinned version, checked against the
// registry's sha512 integrity:  <out>/autoconsent.cjs.js, <out>/compact-rules.json, <out>/LICENSE, <out>/VERSION
// usage: node scripts/fetch_autoconsent.mjs [out dir]   (default src/vendor/autoconsent)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const VERSION = process.env.AUTOCONSENT_VERSION || '18.2.0';
// the package's sha512 as first published, pinned here: a changed package under the same version is refused
const PINNED = { '18.2.0': '2gq60kLJ2wqgxFQ1zs2ZPZ2eY54WBiiH04od0RqLKGVg5hKZ7JvPSfsfLsrPfXWVJx/cS02cB5bJLCMirQN6Qw==' };
const OUT = path.resolve(process.argv[2] || 'src/vendor/autoconsent');
const meta = await fetch(`https://registry.npmjs.org/@duckduckgo/autoconsent/${VERSION}`);
if (!meta.ok) {
  const all = await (await fetch('https://registry.npmjs.org/@duckduckgo/autoconsent')).json().catch(() => ({}));
  throw new Error(`autoconsent ${VERSION}: HTTP ${meta.status}; latest ${all['dist-tags'] && all['dist-tags'].latest}`);
}
const { dist } = await meta.json();
const tgz = Buffer.from(await (await fetch(dist.tarball)).arrayBuffer());
const [alg, want] = String(dist.integrity).split('-');
const got = crypto.createHash(alg).update(tgz).digest('base64');
if (alg !== 'sha512' || got !== want) throw new Error(`autoconsent ${VERSION}: integrity mismatch`);
if (PINNED[VERSION] && PINNED[VERSION] !== got) throw new Error(`autoconsent ${VERSION}: not the pinned package (${got})`);
if (!PINNED[VERSION]) console.log(`::notice title=autoconsent sha512::${VERSION} sha512-${got}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autoconsent-'));
fs.writeFileSync(path.join(tmp, 'p.tgz'), tgz);
execFileSync('tar', ['-xzf', 'p.tgz'], { cwd: tmp });
const pkg = path.join(tmp, 'package');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [from, to] of [['dist/autoconsent.cjs.js', 'autoconsent.cjs.js'], ['rules/compact-rules.json', 'compact-rules.json'], ['LICENSE', 'LICENSE']]) {
  const f = path.join(pkg, from);
  if (!fs.existsSync(f)) throw new Error(`autoconsent ${VERSION}: ${from} missing (has: ${fs.readdirSync(pkg).join(', ')})`);
  fs.copyFileSync(f, path.join(OUT, to));
}
fs.writeFileSync(path.join(OUT, 'VERSION'), VERSION + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log(`autoconsent ${VERSION} (sha512 ok): autoconsent.cjs.js ${kb('autoconsent.cjs.js')}, compact-rules.json ${kb('compact-rules.json')}`);
