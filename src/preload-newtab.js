'use strict';
// Runs in every tab, but only gives the API to our own new tab page (file://.../newtab/newtab.html).
// Websites get nothing from here.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:' && /\/newtab\/newtab\.html$/i.test(decodeURIComponent(location.pathname))) {
  contextBridge.exposeInMainWorld('zeus', {
    getBookmarks: () => ipcRenderer.invoke('bm:get'),
    searchHistory: (text, max) => ipcRenderer.invoke('history:search', text, max),
    suggest: (q, hl) => ipcRenderer.invoke('suggest', q, hl),
    getLang: () => ipcRenderer.invoke('lang:get'),
    setLang: l => ipcRenderer.send('set', 'lang', l),
    onLang: fn => ipcRenderer.on('lang', (e, l) => fn(l))
  });
}
