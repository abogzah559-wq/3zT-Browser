# Third-party notices

3zT includes or uses the following third-party work. Each keeps its own license.

## Ambient light for YouTube v2.38.17

By Wessel Kroos - <https://github.com/WesselKroos/youtube-ambilight>

`src/inject/ambient/` - original scripts and styles; one loading line in `scripts/content.js` changed.

```
MIT License

Copyright (c) 2017 Wessel Kroos

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## TwitchAdSolutions - vaft (v58)

By pixeltris and contributors - <https://github.com/pixeltris/TwitchAdSolutions>

`src/inject/twitch-vaft.js` - unmodified.

```
MIT License

Copyright (c) 2020-present TwitchAdSolutions Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## electron-chrome-web-store 0.13.0

By Samuel Maddock - <https://github.com/samuelmaddock/electron-browser-shell>

`src/vendor/chrome-web-store/` - bundled; small changes listed in `LICENSES.txt` there.

License text: `src/vendor/chrome-web-store/LICENSES.txt`.

## adm-zip 0.5.16

By Another-D-Mention Software and contributors - <https://github.com/cthackers/adm-zip>

bundled in `src/vendor/chrome-web-store/index.js`.

License text: `src/vendor/chrome-web-store/LICENSES.txt`.

## pbf 4.0.1

By Mapbox - <https://github.com/mapbox/pbf>

bundled in `src/vendor/chrome-web-store/index.js`.

License text: `src/vendor/chrome-web-store/LICENSES.txt`.

## Used, not included

- **SponsorBlock** (<https://sponsor.ajay.app>) - skip segments are fetched from the public API. The data is made by the SponsorBlock community and licensed CC BY-NC-SA 4.0 (<https://creativecommons.org/licenses/by-nc-sa/4.0/>). 3zT is free and non-commercial.
- **EasyList / EasyPrivacy** (<https://easylist.to>) - filter lists downloaded at runtime; dual licensed GPL-3.0 / CC BY-SA 3.0.
- **Clean YouTube: Block Shorts, Hide Comments & Feeds** (Chrome Web Store, v1.9.8) - the list of YouTube page elements hidden by the Clean YouTube switches (`src/features.js`) is adapted from this extension. Credit to its developer; it will be changed or removed on request.
- **Electron** (MIT) and **Chromium** (BSD-style and others) - the Windows build ships their `LICENSE` and `LICENSES.chromium.html` files next to `3zT.exe`.

## Media

The looping background video on the new tab page (`src/newtab/media/anime.mp4`) is a short anime clip. It is not covered by the MIT License of 3zT and belongs to its rights holders. It will be removed on request.
