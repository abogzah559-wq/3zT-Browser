/* 3zT compatibility shim for Chrome extensions running in 3zT Browser (Electron).
   Fills small Chrome APIs Electron does not have, so extensions don't crash on them. */
(function () {
  try {
    var c = globalThis.chrome; if (!c) return;
    var ret = function (v) {
      return function () {
        var a = Array.prototype.slice.call(arguments);
        var cb = typeof a[a.length - 1] === 'function' ? a.pop() : null;
        var val = typeof v === 'function' ? v.apply(null, a) : v;
        if (cb) setTimeout(function () { cb(val); }, 0);
        return Promise.resolve(val);
      };
    };
    var ev = function () { return { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; }, hasListeners: function () { return false; } }; };
    var def = function (obj, key, val) { try { Object.defineProperty(obj, key, { value: val, configurable: true, writable: true }); } catch (e) {} };

    // storage.sync exists in Electron but every call fails ("sync is not available"): always use local
    if (c.storage && c.storage.local) def(c.storage, 'sync', c.storage.local);
    // keyboard shortcuts list
    if (!c.commands) def(c, 'commands', { getAll: ret([]), onCommand: ev() });
    // one browser window
    if (!c.windows) {
      var win = { id: 1, focused: true, type: 'normal', state: 'normal', incognito: false, alwaysOnTop: false, top: 0, left: 0, width: 1280, height: 800 };
      def(c, 'windows', {
        WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2,
        get: ret(win), getCurrent: ret(win), getLastFocused: ret(win), getAll: ret([win]),
        update: ret(win), remove: ret(undefined),
        create: ret(function (o) { try { if (o && o.url && c.tabs && c.tabs.create) c.tabs.create({ url: [].concat(o.url)[0] }); } catch (e) {} return win; }),
        onFocusChanged: ev(), onCreated: ev(), onRemoved: ev(), onBoundsChanged: ev()
      });
    }
    if (c.extension) {
      if (!c.extension.isAllowedFileSchemeAccess) def(c.extension, 'isAllowedFileSchemeAccess', ret(false));
      if (!c.extension.isAllowedIncognitoAccess) def(c.extension, 'isAllowedIncognitoAccess', ret(false));
    }
    if (!c.fontSettings) def(c, 'fontSettings', { getFontList: ret([]) });
    if (!c.contextMenus) def(c, 'contextMenus', { create: ret(undefined), update: ret(undefined), remove: ret(undefined), removeAll: ret(undefined), onClicked: ev() });
    if (c.action && !c.action.setBadgeText) { def(c.action, 'setBadgeText', ret(undefined)); def(c.action, 'setBadgeBackgroundColor', ret(undefined)); }
  } catch (e) {}
})();
