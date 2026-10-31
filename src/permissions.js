'use strict';
/*
 * Site permissions: camera, microphone, location, notifications, clipboard reading, MIDI,
 * window placement, USB / HID / serial devices and screen sharing.
 *
 *  - nothing sensitive is granted without asking; ordinary things (downloads, video, cookies,
 *    full screen, copying to the clipboard) never ask
 *  - the question is a small bar under the address bar, never a window that blocks browsing;
 *    if you ignore it, the site is refused this time only (and the bar's icon lets you allow later)
 *  - "Allow" / "Block" are remembered per site (private windows: only until they close)
 *  - everything can be seen and changed per site (site panel in the bar, and Settings)
 */

// what a site can ask for -> how it is called (Arabic, English)
const KINDS = {
  camera: ['الكاميرا', 'Camera'],
  microphone: ['المايك', 'Microphone'],
  geolocation: ['موقعك', 'Your location'],
  notifications: ['الإشعارات', 'Notifications'],
  'clipboard-read': ['قراءة الحافظة', 'Read the clipboard'],
  midi: ['أجهزة MIDI', 'MIDI devices'],
  'window-management': ['أماكن النوافذ والشاشات', 'Window placement'],
  'idle-detection': ['معرفة إذا كنت بعيد عن الجهاز', 'Know when you are away'],
  usb: ['أجهزة USB', 'USB devices'],
  hid: ['أجهزة HID', 'HID devices'],
  serial: ['المنافذ التسلسلية', 'Serial ports'],
  screen: ['مشاركة الشاشة', 'Screen sharing']
};
// Chromium permission names -> our kinds
const FROM_CHROMIUM = {
  geolocation: 'geolocation', notifications: 'notifications', 'clipboard-read': 'clipboard-read',
  midi: 'midi', midiSysex: 'midi', 'window-management': 'window-management', 'idle-detection': 'idle-detection',
  usb: 'usb', hid: 'hid', serial: 'serial'
};
// harmless or needed for normal browsing: never asked
// ('display-capture' is let through here because the real question is the screen picker below)
const ALWAYS = new Set(['display-capture', 'fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'speaker-selection', 'storage-access', 'top-level-storage-access']);

const originOf = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin : ''; } catch (e) { return ''; } };

class Permissions {
  /* store: settings (data.perms = { origin: { kind: 'allow' | 'block' } }) */
  constructor({ settings, onChange }) {
    this.settings = settings;
    this.onChange = onChange || (() => {});
    this.temp = new Map();          // private windows: partition -> { origin: { kind: value } }
    if (!settings.data.perms || typeof settings.data.perms !== 'object') settings.data.perms = {};
  }
  table(partition) {
    if (!partition) return this.settings.data.perms;
    if (!this.temp.has(partition)) this.temp.set(partition, {});
    return this.temp.get(partition);
  }
  get(origin, kind, partition) { const t = this.table(partition)[origin]; return t ? t[kind] : undefined; }
  set(origin, kind, value, partition) {
    if (!origin || !KINDS[kind]) return;
    const tab = this.table(partition);
    const site = tab[origin] || (tab[origin] = {});
    if (value === 'allow' || value === 'block') site[kind] = value; else delete site[kind];
    if (!Object.keys(site).length) delete tab[origin];
    if (!partition) this.settings.save();
    this.onChange(origin);
  }
  clearSite(origin, partition) { delete this.table(partition)[origin]; if (!partition) this.settings.save(); this.onChange(origin); }
  forgetPartition(partition) { this.temp.delete(partition); }
  site(origin, partition) { return Object.assign({}, this.table(partition)[origin] || {}); }
  all() {
    return Object.entries(this.settings.data.perms).map(([origin, kinds]) => ({ origin, kinds: Object.assign({}, kinds) }))
      .filter(x => Object.keys(x.kinds).length).sort((a, b) => a.origin.localeCompare(b.origin));
  }
}

/* kinds a Chromium permission request stands for (camera and microphone are separate) */
function kindsOf(permission, details) {
  if (permission === 'media') {
    const t = (details && details.mediaTypes) || [];
    const k = [];
    if (t.includes('video')) k.push('camera');
    if (t.includes('audio')) k.push('microphone');
    return k.length ? k : ['camera', 'microphone'];
  }
  return FROM_CHROMIUM[permission] ? [FROM_CHROMIUM[permission]] : [];
}
function checkKind(permission, details) {
  if (permission === 'media') return details && details.mediaType === 'video' ? 'camera' : details && details.mediaType === 'audio' ? 'microphone' : null;
  return FROM_CHROMIUM[permission] || null;
}

module.exports = { Permissions, KINDS, ALWAYS, kindsOf, checkKind, originOf };
