#!/usr/bin/env python3
"""
Build the Windows app folder dist/3zT from the official Electron release zip.
Works on Windows and Linux (no npm needed).

usage: python scripts/build_win.py <electron-vX-win32-x64.zip>
result: dist/3zT/3zT.exe (+ Chromium files, resources/app = this project)
"""
import json, os, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pkg = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))
VER = pkg['version']
NAME = '3zT'
OUT = os.path.join(ROOT, 'dist', NAME)

shutil.rmtree(os.path.join(ROOT, 'dist'), ignore_errors=True)
os.makedirs(OUT)
with zipfile.ZipFile(sys.argv[1]) as z:
    z.extractall(OUT)
os.rename(os.path.join(OUT, 'electron.exe'), os.path.join(OUT, NAME + '.exe'))

# our icon + name inside the .exe (Explorer, taskbar, Task Manager)
subprocess.check_call([sys.executable, os.path.join(ROOT, 'scripts', 'patch_exe.py'),
                       os.path.join(OUT, NAME + '.exe'), os.path.join(ROOT, 'assets', 'icon.png'), NAME, VER])

# Electron's sample app is not needed
try: os.remove(os.path.join(OUT, 'resources', 'default_app.asar'))
except FileNotFoundError: pass

# keep only the Arabic and English UI languages of Chromium (smaller download)
loc = os.path.join(OUT, 'locales')
for f in os.listdir(loc):
    if f.endswith('.pak') and f not in ('ar.pak', 'en-US.pak', 'en-GB.pak'):
        os.remove(os.path.join(loc, f))

# the app itself
app = os.path.join(OUT, 'resources', 'app')
os.makedirs(app)
shutil.copy(os.path.join(ROOT, 'package.json'), app)
shutil.copytree(os.path.join(ROOT, 'src'), os.path.join(app, 'src'), ignore=shutil.ignore_patterns('__pycache__'))
shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(app, 'assets'))
shutil.copy(os.path.join(ROOT, 'LICENSE'), os.path.join(OUT, 'LICENSE.3zT.txt'))
print('built', OUT, VER)
