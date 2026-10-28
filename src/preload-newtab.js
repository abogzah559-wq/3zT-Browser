'use strict';
// Runs in every tab, but only gives the API to our own pages (file://.../newtab/newtab.html or history.html).
// Websites get nothing from here.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:' && /\/newtab\/(newtab|history|tasks)\.html$/i.test(decodeURIComponent(location.pathname))) {
  contextBridge.exposeInMainWorld('zeus', {
    getBookmarks: () => ipcRenderer.invoke('bm:get'),
    favicons: urls => ipcRenderer.invoke('fav:get', urls),
    searchHistory: (text, max) => ipcRenderer.invoke('history:search', text, max),
    deleteHistory: url => ipcRenderer.invoke('history:delete', url),
    clearHistory: () => ipcRenderer.invoke('history:clear'),
    suggest: (q, hl) => ipcRenderer.invoke('suggest', q, hl),
    getLang: () => ipcRenderer.invoke('lang:get'),
    setLang: l => ipcRenderer.send('set', 'lang', l),
    onLang: fn => ipcRenderer.on('lang', (e, l) => fn(l)),
    takeImport: () => ipcRenderer.invoke('ntp:take'),
    onImportReady: fn => ipcRenderer.on('import-ready', () => fn()),
    onStrip: fn => ipcRenderer.on('strip', (e, h) => fn(h)),
    tasks: () => ipcRenderer.invoke('tasks:get'),
    sleepTab: id => ipcRenderer.invoke('tasks:sleep', id)
  });
}
