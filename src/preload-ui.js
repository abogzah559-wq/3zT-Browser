'use strict';
// Bridge for the floating toolbar only.
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['ui:expand', 'win', 'drag:start', 'drag:end', 'tab', 'set', 'ext:options', 'misc', 'download:show']);
const INVOKE = new Set(['ext:list', 'ext:add', 'ext:remove', 'bm:import', 'history:search', 'suggest']);
const ON = new Set(['state', 'focus-address', 'close-menus', 'download']);

contextBridge.exposeInMainWorld('ui', {
  send: (ch, ...a) => { if (SEND.has(ch)) ipcRenderer.send(ch, ...a); },
  invoke: (ch, ...a) => (INVOKE.has(ch) ? ipcRenderer.invoke(ch, ...a) : Promise.resolve(null)),
  on: (ch, fn) => { if (ON.has(ch)) ipcRenderer.on(ch, (e, ...a) => fn(...a)); }
});
