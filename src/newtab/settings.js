'use strict';
/* zeus://settings - everything in one tidy page, grouped into sections */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let S = null, lang = 'ar', cur = location.hash.slice(1) || 'general';
const L = (ar, en) => (lang === 'en' ? en : ar);

const ICO = {
  general: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  perf: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  privacy: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  ext: '<path d="M14 4h-4v3a2 2 0 1 1-4 0V4H3v7h3a2 2 0 1 1 0 4H3v6h7v-3a2 2 0 1 1 4 0v3h7v-6h-3a2 2 0 1 1 0-4h3V4z"/>',
  downloads: '<path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/>',
  import: '<path d="M4 4h16v16H4z"/><path d="M9 12h6m-3-3v6"/>',
  about: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-5m0-3h.01"/>'
};
const SECTIONS = () => [
  ['general', L('عام', 'General')], ['perf', L('الأداء والسرعة', 'Speed & performance')], ['privacy', L('الإعلانات والخصوصية', 'Ads & privacy')],
  ['youtube', L('يوتيوب وتويتش', 'YouTube & Twitch')], ['ext', L('الإضافات', 'Extensions')], ['downloads', L('التنزيلات', 'Downloads')],
  ['import', L('الاستيراد من كروم', 'Import from Chrome')], ['about', L('حول المتصفح', 'About')]
];

const sw = (on, attrs) => `<button class="sw${on ? ' on' : ''}" ${attrs} role="switch" aria-checked="${!!on}"></button>`;
const row = (t, d, ctl, cls = '') => `<div class="row ${cls}"><div class="tx"><div class="t">${t}</div>${d ? `<div class="d">${d}</div>` : ''}</div>${ctl || ''}</div>`;
const card = (id, title, body) => `<section id="s-${id}"><h2>${title}</h2><div class="card">${body}</div></section>`;

const YT_CLEAN = [
  ['shorts', 'إخفاء الشورتس', 'Hide Shorts', 'من الصفحة الرئيسية والقائمة والمقترحات', 'From home, the menu and suggestions'],
  ['comments', 'إخفاء التعليقات', 'Hide comments'], ['related', 'إخفاء الفيديوهات المقترحة جنب الفيديو', 'Hide related videos'],
  ['cards', 'إخفاء البطاقات اللي تطلع آخر الفيديو', 'Hide end-screen cards'], ['autoplay', 'إيقاف التشغيل التلقائي للفيديو التالي', 'Turn off autoplay'],
  ['home', 'إخفاء فيديوهات الصفحة الرئيسية', 'Hide the home feed'], ['liveChat', 'إخفاء دردشة البث المباشر', 'Hide live chat'],
  ['notifications', 'إخفاء زر الإشعارات', 'Hide notifications'], ['subscribe', 'إخفاء زر الاشتراك', 'Hide subscribe button'],
  ['likes', 'إخفاء الإعجابات', 'Hide likes'], ['views', 'إخفاء عدد المشاهدات', 'Hide view counts'],
  ['trends', 'إخفاء "استكشاف" و"الرائج"', 'Hide Explore & Trending'], ['playables', 'إخفاء الألعاب (Playables)', 'Hide Playables'],
  ['subscriptions', 'إخفاء الاشتراكات من القائمة', 'Hide subscriptions in the menu'],
  ['blur', 'تغبيش الصور المصغرة', 'Blur thumbnails'], ['thumbs', 'إخفاء الصور المصغرة', 'Hide thumbnails'],
  ['gray', 'يوتيوب بالأبيض والأسود', 'Black & white YouTube'], ['clean', 'الوضع النظيف (الفيديو بس)', 'Clean mode (video only)']
];
const SB = [
  ['sponsor', 'إعلانات داخل الفيديو (رعاية)', 'Sponsors'], ['selfpromo', 'ترويج صاحب القناة لنفسه', 'Self-promotion'],
  ['interaction', 'طلب لايك واشتراك', 'Like/subscribe reminders'], ['intro', 'المقدمة', 'Intro'], ['outro', 'الخاتمة', 'Outro / end cards'],
  ['preview', 'ملخص أول الفيديو', 'Preview / recap'], ['filler', 'كلام جانبي وحشو', 'Filler / tangents'], ['music_offtopic', 'أجزاء بدون موسيقى (في الأغاني)', 'Non-music parts in music videos']
];

function render() {
  if (!S) return;
  lang = S.lang || 'ar';
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
  document.title = L('الإعدادات', 'Settings');
  $('nav').innerHTML = `<h1>${L('الإعدادات', 'Settings')}</h1>` + SECTIONS().map(([id, name]) =>
    `<a data-nav="${id}" class="${cur === id ? 'on' : ''}"><svg viewBox="0 0 24 24">${ICO[id]}</svg>${name}</a>`).join('');
  const restart = need => need ? `<div class="note"><span>${L('يحتاج إعادة تشغيل المتصفح عشان يتطبق.', 'Restart the browser to apply this.')}</span><button class="pri" data-act="relaunch">${L('أعد التشغيل', 'Restart')}</button></div>` : '';
  const fast = S.perfMode === 'fast';
  const sec = {};
  sec.general = card('general', L('عام', 'General'),
    row(L('اللغة', 'Language'), '', `<div class="seg"><button class="${lang === 'ar' ? 'on' : ''}" data-set="lang" data-v="ar">عربي</button><button class="${lang === 'en' ? 'on' : ''}" data-set="lang" data-v="en">English</button></div>`) +
    (S.canDefault ? row(L('المتصفح الافتراضي', 'Default browser'), L('أي رابط تضغطه برا المتصفح (ديسكورد مثلاً) يفتح هنا.', 'Links you click outside the browser open here.'),
      S.isDefault ? `<span class="muted">✓ ${L('هو الافتراضي', 'It is the default')}</span>` : `<button class="pri" data-act="makeDefault">${L('خلّه الافتراضي', 'Make default')}</button>`) : '') +
    row(L('رجّع تبويباتي لما أفتح المتصفح', 'Restore my tabs on start'), '', sw(S.restoreTabs, 'data-tog="restoreTabs"')) +
    row(L('كلمات السر', 'Passwords'), L('عرض واستيراد كلمات السر المحفوظة.', 'View and import saved passwords.'), `<button data-open="passwords">${L('فتح', 'Open')}</button>`) +
    row(L('السجل', 'History'), '', `<button data-open="history">${L('فتح', 'Open')}</button>`));
  sec.perf = card('perf', L('الأداء والسرعة', 'Speed & performance'),
    `<div class="modes">
      <button class="mode${!fast ? ' on' : ''}" data-set="perfMode" data-v="normal"><b>${L('عادي', 'Normal')}</b><span>${L('متوازن: سريع وخفيف على الرام. التبويبات اللي ما تستخدمها تنام وتفضّي الذاكرة.', 'Balanced: fast and light on RAM. Tabs you are not using sleep to free memory.')}</span></button>
      <button class="mode${fast ? ' on' : ''}" data-set="perfMode" data-v="fast"><b>${L('تصفح سريع جداً ⚡', 'Very fast ⚡')}</b><span>${L('السرعة أول شي: الروابط تبدأ تتحمل أول ما توقف عليها بالماوس، التبويبات ما تنام، والتنزيل بأكثر من اتصال. ياخذ رام ومعالج أكثر.', 'Speed first: links start loading when you hover them, tabs never sleep, downloads use several connections. Uses more RAM and CPU.')}</span></button>
    </div>` + restart(S.perfMode !== S.perfActive) +
    row(L('توفير الذاكرة', 'Memory saver'), fast ? L('طافي في وضع التصفح السريع جداً.', 'Off in very fast mode.') : L('التبويبات اللي ما فتحتها من هالمدة (بالدقايق) تنام.', 'Tabs you have not opened for this many minutes go to sleep.'),
      `<div class="seg">${[[0, L('إيقاف', 'Off')], [5, '5'], [15, '15'], [30, '30'], [60, '60']].map(([v, l]) => `<button class="${S.memorySaverMin === v ? 'on' : ''}" data-set="memorySaverMin" data-v="${v}">${l}</button>`).join('')}</div>`, fast ? 'dis' : '') +
    row(L('تسريع الأجهزة (كرت الشاشة)', 'Hardware acceleration (GPU)'), L('يخلي الفيديو والصفحات أنعم. طفّه بس لو فيه مشاكل في الشاشة.', 'Smoother video and pages. Turn off only if you see display problems.'), sw(S.hwAccel, 'data-tog="hwAccel"')) +
    restart(S.hwAccel !== S.hwAccelActive) +
    row(L('مدير المهام', 'Task manager'), L('شوف كل تبويب وإضافة كم ياخذ رام ومعالج. (Shift+Esc)', 'See how much RAM and CPU each tab and extension uses. (Shift+Esc)'), `<button data-open="tasks">${L('فتح', 'Open')}</button>`));
  sec.privacy = card('privacy', L('الإعلانات والخصوصية', 'Ads & privacy'),
    row(L('مانع الإعلانات والمتتبعات', 'Ad and tracker blocker'), `${L('المحظور من البداية:', 'Blocked so far:')} ${Number(S.blockedTotal).toLocaleString('en')} · ${L('القواعد:', 'Rules:')} ${Number(S.adRules).toLocaleString('en')}`, sw(S.adblock, 'data-tog="adblock"')) +
    row(L('مواقع مستثناة من المانع', 'Sites allowed to show ads'), S.adAllow.length ? '' : L('ما فيه. تقدر تطفي المانع لموقع معيّن من زر الدرع في الشريط.', 'None. Turn the blocker off for a site from the shield button in the bar.'), '') +
    (S.adAllow.length ? `<div class="chips">${S.adAllow.map(x => `<span class="chip">${esc(x)}<button data-act="unallow" data-arg="${esc(x)}" title="${L('إزالة', 'Remove')}">✕</button></span>`).join('')}</div>` : '') +
    row(L('مسح بيانات التصفح', 'Clear browsing data'), L('يمسح السجل والكاش والكوكيز (بيطلعك من حساباتك).', 'Clears history, cache and cookies (signs you out).'), `<button data-act="clearData">${L('مسح…', 'Clear…')}</button>`));
  const sbOn = S.sponsorBlock;
  sec.youtube = card('youtube', L('يوتيوب وتويتش', 'YouTube & Twitch'),
    row(L('حظر إعلانات يوتيوب', 'Block YouTube ads'), S.adblock ? '' : L('يحتاج مانع الإعلانات شغّال.', 'Needs the ad blocker on.'), sw(S.ytAds, 'data-tog="ytAds"'), S.adblock ? '' : 'dis') +
    row(L('حظر إعلانات تويتش', 'Block Twitch ads'), L('يحاول يجيب البث بدون إعلانات، ولو ما قدر يخفيها لين تخلص.', 'Tries to get an ad-free stream; if it cannot, it hides the ad until it ends.'), sw(S.twitchAds, 'data-tog="twitchAds"'), S.adblock ? '' : 'dis') +
    row('SponsorBlock', L('يتخطى تلقائياً الأجزاء المزعجة داخل الفيديوهات (حسب تحديد مستخدمين SponsorBlock).', 'Skips annoying parts inside videos automatically (marked by SponsorBlock users).'), sw(sbOn, 'data-tog="sponsorBlock"')) +
    SB.map(([id, ar, en]) => row(L(ar, en), '', sw(S.sbCats.includes(id), `data-sb="${id}"`), 'sub' + (sbOn ? '' : ' dis'))).join('') +
    row(L('الإضاءة المحيطة', 'Ambient light'), L('توهج حول الفيديو بألوانه. إعداداتها داخل مشغّل يوتيوب (زر الإعدادات تحت الفيديو).', 'A glow around the video in its colours. Its options are inside the YouTube player (settings button under the video).'), sw(S.ambient, 'data-tog="ambient"')) +
    `<div class="row"><div class="tx"><div class="t">${L('تنظيف يوتيوب', 'Clean YouTube')}</div><div class="d">${L('اختر وش تبي تخفي. يتطبق على طول.', 'Pick what to hide. Applies right away.')}</div></div></div>` +
    YT_CLEAN.map(([id, ar, en, dar, den]) => row(L(ar, en), dar ? L(dar, den) : '', sw(S.ytClean[id], `data-yt="${id}"`), 'sub')).join(''));
  sec.ext = card('ext', L('الإضافات', 'Extensions'),
    (S.extensions.length ? S.extensions.map(x => `<div class="row ext">${x.icon ? `<img src="${esc(x.icon)}" alt="">` : '<span class="ph"></span>'}<div class="tx"><div class="t">${esc(x.name)}</div><div class="d">${esc(x.version || '')}</div></div>
      ${x.options ? `<button data-act="extOptions" data-arg="${esc(x.options)}">${L('إعداداتها', 'Options')}</button>` : ''}<button data-act="extRemove" data-arg="${esc(x.id)}">${L('إزالة', 'Remove')}</button></div>`).join('')
      : row(L('ما فيه إضافات', 'No extensions'), L('SponsorBlock وتنظيف يوتيوب والإضاءة المحيطة ومانع إعلانات تويتش صارت جزء من المتصفح.', 'SponsorBlock, Clean YouTube, Ambient light and the Twitch ad blocker are now part of the browser.'), '')) +
    row(L('استيراد إضافاتي من كروم', 'Import my Chrome extensions'), L('الإضافات اللي صارت جزء من المتصفح ما تنضاف مرة ثانية.', 'Extensions that are now built in are skipped.'), `<button data-act="extImport">${L('استيراد', 'Import')}</button>`));
  sec.downloads = card('downloads', L('التنزيلات', 'Downloads'),
    row(L('مجلد التنزيلات', 'Downloads folder'), '', `<button data-act="downloads">${L('فتح', 'Open')}</button>`) +
    (S.fdmFound ? row(L('التنزيل عبر Free Download Manager', 'Download with Free Download Manager'), L('تجريبي', 'Beta'), sw(S.fdm, 'data-tog="fdm"')) : ''));
  sec.import = card('import', L('الاستيراد من كروم', 'Import from Chrome'),
    row(L('المفضلة والأيقونات', 'Bookmarks and icons'), '', `<button data-act="importBookmarks">${L('استيراد', 'Import')}</button>`) +
    row(L('شكل بلاك كروم (الخلفية والخط والإعدادات)', 'Black Chrome look (background, font, settings)'), '', `<button data-act="importLook">${L('استيراد', 'Import')}</button>`));
  sec.about = card('about', L('حول المتصفح', 'About'),
    row('3zT Browser ' + esc(S.versions.app), 'Chromium ' + esc(S.versions.chrome), ''));
  $('main').innerHTML = sec[cur] || sec.general;
}

let toastT = 0;
function toast(t) { const x = $('toast'); x.textContent = t; x.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove('on'), 2600); }
async function load() { S = await zeus.settings(); render(); }

$('nav').addEventListener('click', e => { const a = e.target.closest('[data-nav]'); if (!a) return; cur = a.dataset.nav; history.replaceState(null, '', '#' + cur); render(); window.scrollTo(0, 0); });
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tog) { zeus.set(b.dataset.tog, !S[b.dataset.tog]); return; }
  if (b.dataset.set) { const k = b.dataset.set; zeus.set(k, k === 'memorySaverMin' ? +b.dataset.v : b.dataset.v); return; }
  if (b.dataset.yt) { const o = Object.assign({}, S.ytClean); o[b.dataset.yt] = !o[b.dataset.yt]; zeus.set('ytClean', o); return; }
  if (b.dataset.sb) { const c = new Set(S.sbCats); c.has(b.dataset.sb) ? c.delete(b.dataset.sb) : c.add(b.dataset.sb); zeus.set('sbCats', [...c]); return; }
  if (b.dataset.open) { zeus.act('open', b.dataset.open); return; }
  const act = b.dataset.act; if (!act) return;
  if (act === 'extRemove' && !confirm(L('إزالة الإضافة؟', 'Remove this extension?'))) return;
  b.disabled = true;
  const r = await zeus.act(act, b.dataset.arg);
  b.disabled = false;
  if (act === 'makeDefault') toast(L('اختار "3zT Browser" من صفحة ويندوز اللي فتحت', 'Pick "3zT Browser" on the Windows page that opened'));
  if (act === 'importBookmarks') toast(r ? L(`انضافت ${r} من مفضلة كروم`, `Imported ${r} bookmarks`) : L('تم تحديث الأيقونات، وما فيه مفضلة جديدة', 'Icons updated, no new bookmarks'));
  if (act === 'importLook') toast(r ? L('تم. افتح تبويب جديد عشان تشوف الشكل', 'Done. Open a new tab to see it') : L('ما لقيت إعدادات بلاك كروم في كروم', 'Black Chrome settings not found'));
  if (act === 'extImport' && r) toast(L(`انضافت ${r.imported.length} إضافة`, `Imported ${r.imported.length} extensions`));
  if (act === 'clearData' && r) toast(L('تم المسح', 'Cleared'));
  load();
});
zeus.onSettings(load);
zeus.onLang(() => load());
addEventListener('hashchange', () => { cur = location.hash.slice(1) || 'general'; render(); });
load();
