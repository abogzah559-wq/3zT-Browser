// TikTok and Instagram layout (3zT): the playing video as large as the page allows; on TikTok its action buttons,
// caption and the eye button in the bottom-right corner just above the video bar (hidden until the eye button is
// pressed); the up/down arrows fixed at the screen's left edge. Runs in an isolated world of TikTok / Instagram pages (src/preload-newtab.js), with the rules
// from src/sociallayout.js passed in as RULES.
//
// Built to survive TikTok's redesigns:
// - the CSS (social-view.css) never uses TikTok's names: this script finds the parts and marks them with its own
//   attribute (data-tzt-part), and the CSS only styles those marks;
// - each part is looked for by several names, newest first (the list is kept up to date from GitHub), then by
//   what it contains (TikTok's own test ids such as like-icon, which rarely change); the playing video is found by
//   its position on screen;
// - nothing is moved unless the playing video and its parts were found, and a part that does not land where it
//   was put goes back to TikTok's own place: a redesign can only bring back TikTok's own layout, never a broken one.
// Lightweight: works only on scroll, resize and changes to the page's elements, never while a video just plays.
(RULES => {
  'use strict';

  const SITE = location.hostname.endsWith('instagram.com') ? 'ig' : 'tt';
  const root = document.documentElement;
  root.classList.add(`tzt-${SITE}`);

  // (a name the browser cannot read is skipped)
  const qa = (sel, scope = document) => { try { return scope.querySelectorAll(sel); } catch (e) { return []; } };
  const first = (list, scope = document) => {
    for (const sel of list || []) { const el = qa(sel, scope)[0]; if (el) return el; }
    return null;
  };
  const all = (list, scope = document) => {
    const out = new Set();
    for (const sel of list || []) for (const el of qa(sel, scope)) out.add(el);
    return [...out];
  };
  const NAV_LABEL = (() => { try { return new RegExp(RULES.instagram.navLabel, 'i'); } catch (e) { return /ريلز|reel/i; } })();
  // the smallest box holding all of `els` (their nearest shared parent)
  const shared = (els) => {
    let box = els[0] && els[0].parentElement;
    while (box && !els.every((e) => box.contains(e))) box = box.parentElement;
    return box;
  };

  // ---------------------------------------------------------------- TikTok
  // where TikTok's parts are: names newest first (src/social-layout.json, kept up to date from GitHub by
  // src/sociallayout.js), then what the parts contain. TikTok's 2026 design ("anchoring") draws one set of
  // buttons and one caption over whichever video is playing; the older one had a set inside every video.
  const TT = RULES.tiktok;

  // the video playing in the middle of the screen, and where its picture really is (without the black bars)
  function ttVideo() {
    const mid = window.innerHeight / 2;
    let best = null, bestScore = Infinity;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      if (r.width < 200 || r.height < 150 || r.bottom < 0 || r.top > window.innerHeight) continue;
      // a playing video wins over a paused one at the same distance from the middle
      const score = Math.abs(r.top + r.height / 2 - mid) + (v.paused ? window.innerHeight : 0);
      if (score < bestScore) { bestScore = score; best = v; }
    }
    if (!best) return null;
    const r = best.getBoundingClientRect();
    let { left, top, width, height } = r;
    const vw = best.videoWidth, vh = best.videoHeight;
    const fit = getComputedStyle(best).objectFit;
    if (vw && vh && (fit === 'contain' || fit === 'scale-down' || fit === '')) {
      const s = Math.min(width / vw, height / vh);
      const w = vw * s, h = vh * s;
      left += (width - w) / 2; top += (height - h) / 2; width = w; height = h;
    }
    return { el: best, left, top, width, height, right: left + width, bottom: top + height };
  }

  // the visible one of several candidates: the one nearest to the video
  function nearest(els, v) {
    let best = null, bestD = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const d = Math.abs(r.top + r.height / 2 - (v.top + v.height / 2)) + Math.max(0, v.left - r.right, r.left - v.right);
      if (d < bestD) { bestD = d; best = el; }
    }
    return best;
  }

  function findActions(v) {
    let el = nearest(all(TT.actions), v);
    if (el) return el;
    // by content: the column holding like / comment / share, without the video in it
    const icons = (TT.actionIcons || []).map((s) => nearest([...qa(s)], v)).filter(Boolean);
    if (icons.length < 2) return null;
    el = shared(icons);
    return el && !el.querySelector('video') && el.getBoundingClientRect().width < 160 ? el : null;
  }
  function findCaption(v) {
    let el = nearest(all(TT.caption), v);
    if (el) return el;
    const inner = nearest(all(TT.captionInside), v);
    // climb while the box stays a caption (no video, no buttons column, not most of the screen)
    for (el = inner; el && el.parentElement; el = el.parentElement) {
      const p = el.parentElement;
      if (p.querySelector('video') || first(TT.actionIcons, p) || p.getBoundingClientRect().height > window.innerHeight / 3) break;
    }
    return inner ? el : null;
  }
  function findNav() {
    const el = first(TT.nav);
    if (el) return el;
    const b = (TT.navButtons || []).map((s) => qa(s)[0]).filter(Boolean);
    return b.length >= 2 ? shared(b) : null;
  }

  // the outermost box that is only this part (a wrapper of the same size around it): moving the inner one
  // alone would leave the wrapper behind, and a wrapper with a transform would carry it off
  function outermost(el) {
    if (!el) return el;
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body && p.children.length === 1; p = p.parentElement) {
      const q = p.getBoundingClientRect();
      if (Math.abs(q.left - r.left) > 8 || Math.abs(q.top - r.top) > 8 || Math.abs(q.width - r.width) > 8 || Math.abs(q.height - r.height) > 8) break;
      el = p;
    }
    return el;
  }

  // our own marks on TikTok's parts (moved to the new element when TikTok swaps it)
  const marked = {};
  const refused = new WeakSet();   // parts that did not land where they were put (see check below)
  function mark(part, el) {
    if (el && refused.has(el)) el = null;
    if (marked[part] === el && (!el || el.getAttribute('data-tzt-part') === part)) return;
    if (marked[part] && marked[part].getAttribute('data-tzt-part') === part) marked[part].removeAttribute('data-tzt-part');
    marked[part] = el;
    if (el) el.setAttribute('data-tzt-part', part);
  }
  // a part that is not where it was put (something around it changed how it is positioned) goes back to
  // TikTok's own place rather than staying somewhere wrong
  // (only after it was off three times in a row: a part still sliding into place is off for a moment)
  const misses = new WeakMap();
  function check(part, want) {
    const el = marked[part];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const off = Object.entries(want).some(([k, v]) => Math.abs(r[k] - v) > 24);
    const n = off ? (misses.get(el) || 0) + 1 : 0;
    misses.set(el, n);
    if (n >= 3) { refused.add(el); mark(part, null); }
    else if (off) setTimeout(schedule, 250);   // look again once it has settled
  }

  // ------------------------------------------------------------- Instagram
  // Instagram's class names are random, so its parts are found by structure and tagged:
  //   data-tzt-ig="item"    one reel (video area + buttons column)
  //   data-tzt-ig="media"   the video area
  //   data-tzt-ig="actions" like / comment / share / more column
  //   data-tzt-ig="info"    account name + caption column
  //   data-tzt-nav          the previous/next arrows
  function tag(el, value) {
    if (el && el.getAttribute('data-tzt-ig') !== value) el.setAttribute('data-tzt-ig', value);
  }

  function updateInstagram() {
    for (const video of document.querySelectorAll('main video')) {
      let branch = video;
      let parent = video.parentElement;
      for (let depth = 0; parent && depth < 16; depth++) {
        let actions = null;
        for (const child of parent.children) {
          if (child === branch || child.querySelector('video')) continue;
          const w = child.getBoundingClientRect().width;
          if (w > 0 && w < 110 && child.querySelectorAll('[role="button"]').length >= 3) actions = child;
        }
        if (actions) {
          tag(parent, 'item');
          tag(branch, 'media');
          tag(actions, 'actions');
          for (const child of branch.children) {
            if (!child.querySelector('video') && child.querySelector('a[href^="/"]')) tag(child, 'info');
          }
          break;
        }
        branch = parent;
        parent = parent.parentElement;
      }
    }

    // previous / next arrows: the two buttons labelled for reels, and their shared container
    const navButtons = [...document.querySelectorAll('[role="button"][aria-label], button[aria-label]')]
      .filter((b) => NAV_LABEL.test(b.getAttribute('aria-label')) && !b.closest('[data-tzt-ig="item"]'));
    if (navButtons.length >= 2) {
      let box = navButtons[0].parentElement;
      while (box && !box.contains(navButtons[1])) box = box.parentElement;
      const r = box && box.getBoundingClientRect();
      // only a small arrows box — never a large page section
      if (r && r.width < 140 && r.height < 220 && !box.hasAttribute('data-tzt-nav')) {
        box.setAttribute('data-tzt-nav', '');
      }
    }
  }

  // ------------------------------------------------- show / hide button
  const ICON_SHOW = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const ICON_HIDE = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.4 0-10-7-10-7a18.4 18.4 0 0 1 5.1-5.9M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M2 2l20 20"/></svg>';

  let toggle = null;
  function ensureToggle() {
    if (toggle && toggle.isConnected) return;
    toggle = document.createElement('button');
    toggle.id = 'tzt-toggle';
    toggle.type = 'button';
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // don't pause the video underneath
      root.classList.toggle('tzt-show-actions');
      paintToggle();
      schedule();
    });
    paintToggle();
    root.appendChild(toggle); // outside the site's own app tree
  }
  function paintToggle() {
    const shown = root.classList.contains('tzt-show-actions');
    toggle.innerHTML = shown ? ICON_HIDE : ICON_SHOW;
    const label = shown ? 'إخفاء الأزرار' : 'إظهار الأزرار';
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
  }

  // ------------------------------------------------------ placement
  const TOGGLE_SIZE = 40;
  const EDGE = 12;
  const NAV_LEFT = 28;   // the up/down arrows: fixed at the screen's left edge (social-view.css)
  let pending = false;

  const setVar = (name, value) => { if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value); };
  const px = (n) => `${Math.round(n)}px`;
  const placed = (on) => { if (root.classList.contains('tzt-placed') !== on) root.classList.toggle('tzt-placed', on); };

  // TikTok's side menu is collapsed to its icons once, when the page opens (with TikTok's own button), so the video
  // gets the room. Opened again by hand, it is left open.
  let sidebarDone = false;
  function collapseSidebar() {
    if (sidebarDone) return;
    const tg = first(TT.sidebarToggle);
    if (!tg) return;
    sidebarDone = true;
    let menu = tg.parentElement;
    for (let i = 0; menu && i < 8 && menu.getBoundingClientRect().height < window.innerHeight / 2; i++) menu = menu.parentElement;
    if (menu && menu.getBoundingClientRect().width > 150) tg.click();
  }

  function placeTikTok() {
    collapseSidebar();
    const v = ttVideo();
    const actions = v && findActions(v);
    const caption = v && findCaption(v);
    // nothing of ours without the video and at least one part: TikTok keeps its own layout
    if (!v || (!actions && !caption)) {
      mark('actions', null); mark('caption', null); mark('nav', null);
      placed(false);
      return;
    }
    mark('actions', outermost(actions));
    mark('caption', outermost(caption));
    const nav = outermost(findNav());
    mark('nav', nav && !nav.querySelector('video') ? nav : null);
    if (!marked.actions && !marked.caption) { mark('nav', null); placed(false); return; }   // (both refused before)

    const W = root.clientWidth, H = window.innerHeight;
    // the corner the parts sit in: bottom-right, just above TikTok's video bar (progress bar and play controls).
    // That bar is the same on every video, wide or tall, so the parts never move from one video to the next.
    // Without the bar (an older design): the bottom-right corner of the video itself.
    let edgeRight, floor;
    const ctl = first(TT.controls);
    const c = ctl && ctl.getBoundingClientRect();
    if (c && c.width > 200 && c.height && c.top > H / 2) { edgeRight = c.right; floor = c.top; }
    else { edgeRight = v.right; floor = Math.min(v.bottom, H); }
    const shown = root.classList.contains('tzt-show-actions');
    const right = W - edgeRight + EDGE;                // distance from the screen's right edge
    let up = H - floor + 6;                            // distance from the screen's bottom
    setVar('--tzt-cap-right', px(right));
    setVar('--tzt-cap-bottom', px(up));
    setVar('--tzt-cap-width', px(Math.max(260, Math.min(440, W * 0.32))));
    if (shown && caption) up += caption.getBoundingClientRect().height + 6;
    setVar('--tzt-toggle-left', px(edgeRight - EDGE - TOGGLE_SIZE));
    setVar('--tzt-toggle-top', px(H - up - TOGGLE_SIZE));
    up += TOGGLE_SIZE + 8;
    setVar('--tzt-act-right', px(right));
    setVar('--tzt-act-bottom', px(up));

    ensureToggle();
    placed(true);
    check('actions', { right: W - right });
    check('caption', { right: W - right });
    check('nav', { left: NAV_LEFT });
    if (!marked.actions && !marked.caption) { mark('nav', null); placed(false); }
  }

  function placeInstagram() {
    const mid = window.innerHeight / 2;
    let el = null, bestDist = Infinity;
    for (const x of document.querySelectorAll('[data-tzt-ig="media"]')) {
      const r = x.getBoundingClientRect();
      if (r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const dist = Math.abs(r.top + r.height / 2 - mid);
      if (dist < bestDist) { bestDist = dist; el = x; }
    }
    if (!el) { placed(false); return; }
    const r = el.getBoundingClientRect();
    // toggle: right edge of the video — bottom corner while everything is hidden,
    // just above the caption once it is shown
    const visibleBottom = Math.min(r.bottom, window.innerHeight);
    let top = visibleBottom - (EDGE + 8) - TOGGLE_SIZE; // clear of the progress bar
    if (root.classList.contains('tzt-show-actions')) {
      // above the caption's first line, measured where the caption really is: the block's last element can be an
      // empty one (its height alone left the eye over the caption's last line); the last one showing something is it
      const info = el.querySelector('[data-tzt-ig="info"]');
      const kids = info ? [...info.children].reverse() : [];
      for (const k of kids) {
        const ir = k.getBoundingClientRect();
        if (!(ir.height > 0 && ir.height < r.height * 0.6)) continue;
        // only when it sits at the bottom, where the eye is (on a wide video it shows at the top: the eye stays)
        if (ir.bottom > top) top = Math.min(ir.top, visibleBottom) - 6 - TOGGLE_SIZE;
        break;
      }
    }
    setVar('--tzt-toggle-left', px(r.right - EDGE - TOGGLE_SIZE));
    setVar('--tzt-toggle-top', px(top));
    setVar('--tzt-toggle-gap', px(r.bottom - top + 8));   // the buttons column, above the eye (from the video's bottom)
    ensureToggle();
    placed(true);
  }

  function place() {
    pending = false;
    try { SITE === 'tt' ? placeTikTok() : placeInstagram(); }
    catch (e) { placed(false); }   // never leave the site half moved
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(place);
  }

  // ------------------------------------------------------------ wiring
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('transitionend', schedule, { capture: true, passive: true });
  // a new video's size is known only once it has loaded
  document.addEventListener('loadedmetadata', schedule, { capture: true, passive: true });
  document.addEventListener('playing', schedule, { capture: true, passive: true });

  let debounce = 0;
  const real = (muts) => muts.some((m) => m.type === 'attributes' || [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1));
  new MutationObserver((muts) => {
    if (!real(muts)) return;         // text changing (the play time) is not a layout change
    if (SITE === 'tt') schedule();   // TikTok: the next frame (the parts are found again there)
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (SITE === 'ig') updateInstagram();
      schedule();
    }, 120);
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  if (SITE === 'ig') updateInstagram();
  schedule();
})
