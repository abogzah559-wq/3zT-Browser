// Sign a release for the silent updater.
//   UPDATE_SIGNING_KEY=<PEM private key> node scripts/sign-update.mjs dist/3zT-Browser-Setup.exe 0.10.0
// Writes dist/3zT-Browser-Setup.exe.sig and checks it against the public key built into src/updater.js,
// so a release can never go out with a signature the browsers would refuse.
import crypto from 'node:crypto';
import fs from 'node:fs';

const [file, version] = process.argv.slice(2);
const pem = process.env.UPDATE_SIGNING_KEY;
if (!file || !version) { console.error('usage: sign-update.mjs <setup.exe> <version>'); process.exit(2); }
if (!pem || !pem.includes('PRIVATE KEY')) { console.error('UPDATE_SIGNING_KEY is not set'); process.exit(3); }

const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const text = Buffer.from(`3zT-Browser-Setup.exe\n${version}\n${sha}`);
const sig = crypto.sign(null, text, crypto.createPrivateKey(pem));

const src = fs.readFileSync(new URL('../src/updater.js', import.meta.url), 'utf8');
const pub = (src.match(/const PUBLIC_KEY = '([^']+)'/) || [])[1];
const ok = pub && crypto.verify(null, text, crypto.createPublicKey({ key: Buffer.from(pub, 'base64'), format: 'der', type: 'spki' }), sig);
if (!ok) { console.error('the signing key does not match the public key in src/updater.js'); process.exit(4); }

fs.writeFileSync(file + '.sig', sig.toString('base64'));
console.log('signed', file, version, sha);
