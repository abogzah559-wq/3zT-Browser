'use strict';
// Bridge for the floating toolbar only.
const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['reader:toggle', 'tabs:strip', 'tabs:go', 'ui:expand', 'ui:height', 'win', 'tab', 'set', 'ext:options', 'misc', 'download:show', 'find', 'find:stop', 'tab:dragout', 'tab:dragend', 'ext:popup', 'ext:popupClose', 'ext:pin', 'pw:answer', 'dl:uiAct', 'perm:answer', 'perm:set', 'net:warm', 'media:open', 'dl:drag']);
const INVOKE = new Set(['tabs:preview', 'tabs:all', 'ext:list', 'ext:add', 'ext:remove', 'bm:import', 'ntp:import', 'history:search', 'suggest', 'ext:importChrome', 'pw:import', 'dl:session', 'search:history']);
const ON = new Set(['tab-search', 'state', 'focus-address', 'close-menus', 'download', 'found', 'find-open', 'drop-hint', 'pw-offer', 'tint', 'being-moved', 'updated', 'perm-ask', 'perm-cancel']);

contextBridge.exposeInMainWorld('ui', {
  send: (ch, ...a) => { if (SEND.has(ch)) ipcRenderer.send(ch, ...a); },
  invoke: (ch, ...a) => (INVOKE.has(ch) ? ipcRenderer.invoke(ch, ...a) : Promise.resolve(null)),
  on: (ch, fn) => { if (ON.has(ch)) ipcRenderer.on(ch, (e, ...a) => fn(...a)); }
});
