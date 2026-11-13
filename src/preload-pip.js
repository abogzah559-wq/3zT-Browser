'use strict';
/* the picture-in-picture window's buttons (src/ui/pip.html): only that page gets these few calls */
const { contextBridge, ipcRenderer } = require('electron');
if (location.protocol === 'file:' && /\/ui\/pip\.html$/.test(location.pathname)) {
  contextBridge.exposeInMainWorld('pip', {
    state: () => ipcRenderer.invoke('pip:state'),
    cmd: (c, a) => ipcRenderer.invoke('pip:cmd', String(c), +a || 0),
    grab: kind => ipcRenderer.send('pip:grab', String(kind)),
    drag: () => ipcRenderer.send('pip:drag'),
    drop: () => ipcRenderer.send('pip:drop'),
    testBounds: b => ipcRenderer.invoke('pip:testBounds', b),
    onLang: cb => ipcRenderer.on('pip:lang', (e, l) => cb(l === 'en' ? 'en' : 'ar'))
  });
}
