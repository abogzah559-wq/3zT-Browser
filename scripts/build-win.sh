#!/bin/bash
# Builds a portable Windows folder + zip from the official Electron release (no npm needed).
# usage: scripts/build-win.sh <path-to-electron-vX-win32-x64.zip>
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER=$(node -p "require('$ROOT/package.json').version")
OUT="$ROOT/dist/3zT Browser"
rm -rf "$ROOT/dist" && mkdir -p "$OUT"
unzip -q "$1" -d "$OUT"
mv "$OUT/electron.exe" "$OUT/3zT Browser.exe"
# our icon + name inside the .exe (Explorer, taskbar, Task Manager)
python3 "$ROOT/scripts/patch_exe.py" "$OUT/3zT Browser.exe" "$ROOT/assets/icon.png" "3zT Browser" "$VER"
rm -f "$OUT/resources/default_app.asar"
# keep only the Arabic and English UI languages of Chromium (smaller download)
find "$OUT/locales" -name '*.pak' ! -name 'ar.pak' ! -name 'en-US.pak' ! -name 'en-GB.pak' -delete
mkdir -p "$OUT/resources/app"
cp -r "$ROOT/package.json" "$ROOT/src" "$ROOT/assets" "$OUT/resources/app/"
cp "$ROOT/docs/اقرأني.txt" "$OUT/" 2>/dev/null || true
(cd "$ROOT/dist" && zip -qr -9 "3zT-Browser-$VER-win-x64.zip" "3zT Browser")
ls -la "$ROOT/dist"
