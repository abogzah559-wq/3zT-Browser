'use strict';
// Bridge for the floating toolbar only.
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['ui:expand', 'ui:height', 'ui:hidden', 'win', 'tab', 'set', 'ext:options', 'misc', 'download:show', 'find', 'find:stop', 'tab:dragout', 'tab:dragend', 'ext:popup', 'ext:popupClose', 'ext:pin', 'pw:answer']);
const INVOKE = new Set(['ext:list', 'ext:add', 'ext:remove', 'bm:import', 'ntp:import', 'history:search', 'suggest', 'ext:importChrome', 'pw:import']);
const ON = new Set(['state', 'focus-address', 'close-menus', 'download', 'found', 'find-open', 'drop-hint', 'pw-offer']);

contextBridge.exposeInMainWorld('ui', {
  send: (ch, ...a) => { if (SEND.has(ch)) ipcRenderer.send(ch, ...a); },
  invoke: (ch, ...a) => (INVOKE.has(ch) ? ipcRenderer.invoke(ch, ...a) : Promise.resolve(null)),
  on: (ch, fn) => { if (ON.has(ch)) ipcRenderer.on(ch, (e, ...a) => fn(...a)); }
});
