"""Light update bundle: the app folder alone, for installed copies on the same Electron.

    python scripts/make_app_bundle.py dist/3zT/resources/app dist/3zT-app.json <electron version>

The browser downloads it instead of the full setup when only 3zT's own code changed
(src/updater.js), checks its signature (3zT-app.json.sig) and swaps the folder on close.
"""
import base64, json, os, sys

src, out, electron = sys.argv[1:4]
with open(os.path.join(src, 'package.json'), encoding='utf-8') as f:
    version = json.load(f)['version']
files = {}
for root, _, names in os.walk(src):
    for n in names:
        p = os.path.join(root, n)
        rel = os.path.relpath(p, src).replace(os.sep, '/')
        with open(p, 'rb') as f:
            files[rel] = base64.b64encode(f.read()).decode('ascii')
with open(out, 'w', encoding='utf-8') as f:
    json.dump({'version': version, 'electron': electron, 'files': files}, f, separators=(',', ':'))
print(f'light bundle {out}: {len(files)} files, {os.path.getsize(out) // 1024} KB, version {version}, electron {electron}')
