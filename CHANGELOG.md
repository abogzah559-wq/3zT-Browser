# Changelog

Each version has an English and an Arabic part. The release notes and the "Details" button in
the browser's "updated" note are made from these sections.

## 0.13.0

### English
- New logo: the fox, everywhere (program, taskbar, setup, tabs). This update installs the full setup once so the program's own icon changes too.
- Video, audio and photo downloader built in (the former 3zT Download app): a fox button in the address bar on pages with a video or a post opens the downloads page with the link. Save the video (up to 4K), MP3 audio, or pick the photos of a post. The tools it needs are fetched and checked the first time you use it; nothing runs in the background.
- Trim a video before saving it, or trim any finished video in the downloads list: pick the start and end on a timeline with a preview. "Fast" keeps the quality (cuts at the nearest key frame), "Frame-exact" re-encodes to cut exactly.
- Drag a finished download from the list onto a website, the desktop or a folder.
- Downloads that failed on many sites now work: tabs opened by a site carry its exact request (form data, the page it came from, the opener), like Chrome. The empty tab that only started a download closes by itself.
- Arabic file names are kept (they used to be saved as "download").
- Sign-in pages no longer pop up the Windows Security window by themselves; a passkey you choose still works.
- Pin tabs (right-click a tab). More Chrome shortcuts: Ctrl+PgUp/PgDn, Ctrl+Shift+PgUp/PgDn, Ctrl+Shift+W, F3, Alt+Home. Save link, copy image address, save video in the right-click menu.
- Faster start (the ad lists are kept ready), the ad blocker follows each rule's resource types, private-window downloads are not kept in the list, errors are written to a small log file.

### العربية
- شعار جديد: الثعلب في كل مكان (البرنامج، شريط المهام، السيت اب، التبويبات). هالتحديث يركّب السيت اب كامل مرة وحدة عشان تتغير أيقونة البرنامج نفسها.
- محمّل الفيديو والصوت والصور صار داخل المتصفح (برنامج 3zT Download): زر الثعلب يطلع جنب الرابط في الصفحات اللي فيها فيديو أو منشور، ويفتح صفحة التنزيلات والرابط جاهز. تحفظ الفيديو (لين 4K) أو الصوت MP3 أو تختار صور المنشور. الأدوات اللي يحتاجها تنزل وتنفحص أول مرة تستخدمه، وما يشتغل شي بالخلفية.
- قص الفيديو قبل الحفظ، أو قص أي فيديو خلص تحميله من القائمة: تختار البداية والنهاية على شريط مع معاينة. «سريع» بنفس الجودة (يقص عند أقرب إطار مفتاحي)، و«دقيق» يعيد الترميز عشان يقص بالضبط.
- تسحب أي ملف حملته من القائمة وترميه في موقع أو على سطح المكتب أو في مجلد.
- التنزيلات اللي كانت تفشل في مواقع كثيرة صارت تشتغل: التبويب اللي يفتحه الموقع ينفتح بنفس طلبه بالضبط زي كروم. والتبويب الفاضي اللي بس بدأ التحميل يتقفل لحاله.
- أسماء الملفات العربية تنحفظ صح (كانت تنحفظ باسم download).
- صفحات تسجيل الدخول ما عاد تطلع نافذة أمان ويندوز لحالها، ومفتاح الدخول اللي تختاره بنفسك لسا يشتغل.
- تثبيت التبويبات (كلك يمين على التبويب). اختصارات كروم زيادة: Ctrl+PgUp/PgDn و Ctrl+Shift+PgUp/PgDn و Ctrl+Shift+W و F3 و Alt+Home. وفي الكلك يمين: حفظ الرابط، نسخ عنوان الصورة، حفظ الفيديو.
- تشغيل أسرع (قوائم الإعلانات جاهزة)، مانع الإعلانات يحترم نوع كل قاعدة، تنزيلات النافذة المتخفية ما تنحفظ في القائمة، والأخطاء تنكتب في ملف سجل صغير.

## 0.12.8

### English
- Translate page now works in place, like Chrome: the page stays where it is and keeps working, its text is swapped for the translation, new text is translated as it appears, and other pages of the same site are translated too until you press the button again. No more trip through Google Translate's site.
- Ctrl+Shift+T after closing and reopening the browser: closed tabs are kept across restarts, and if tabs are not restored on start, the first Ctrl+Shift+T brings back all the tabs that were open.
- The browser's own pages show as 3zt://settings, 3zt://downloads... instead of zeus:// (the old addresses still work).
- Past searches under the address bar all line up on the right in the Arabic interface, English ones too.

### العربية
- ترجمة الصفحة صارت داخل الصفحة نفسها زي كروم: الصفحة تبقى مكانها وتشتغل عادي، نصوصها تتبدل بالترجمة، واللي ينضاف بعدين يترجم لحاله، وباقي صفحات نفس الموقع تترجم بعد لين تضغط الزر مرة ثانية. ما عاد تنتقل لموقع ترجمة قوقل.
- Ctrl+Shift+T بعد ما تقفل المتصفح وتفتحه: التبويبات المقفلة تنحفظ، ولو المتصفح ما يرجّع التبويبات وقت الفتح، أول Ctrl+Shift+T يرجّع كل التبويبات اللي كانت مفتوحة.
- صفحات المتصفح نفسه صارت تطلع 3zt://settings و 3zt://downloads... بدل zeus:// (والعناوين القديمة لسا تشتغل).
- عمليات البحث السابقة تحت الشريط كلها صارت يمين في الواجهة العربية، حتى الإنجليزي.

## 0.12.7

### English
- YouTube's suggested videos on the right of a video show again. One of the signals added in 0.12.5 against the "ad blockers are not allowed" popup stopped YouTube from drawing that list; it is removed, the rest stays (no popup, no ads).

### العربية
- رجعت الفيديوهات المقترحة على يمين الفيديو في يوتيوب. وحدة من الإشارات اللي انضافت في 0.12.5 ضد رسالة «مانع الإعلانات غير مسموح» كانت توقف يوتيوب عن رسم القائمة، فانشالت، والباقي باقي (لا رسالة ولا إعلانات).

## 0.12.6

### English
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab...) work again while the keyboard is on the Arabic layout: 3zT now reads which key is pressed, not the letter it types, like Chrome.

### العربية
- اختصارات الكيبورد (Ctrl+T و Ctrl+W و Ctrl+L و Ctrl+Tab...) رجعت تشتغل والكيبورد على العربي: 3zT صار يقرأ مكان الزر نفسه مو الحرف اللي يكتبه، زي كروم.

## 0.12.5

### English
- YouTube's "Ad blockers are not allowed" popup no longer shows up: 3zT tells YouTube what uBlock Origin tells it, its changes look built in, and if the popup still opens it is closed and the video keeps playing.
- Much faster updates: when only 3zT's own code changed, the update is a few MB and is swapped in within a second when you close the browser, instead of reinstalling all of Chromium. The full setup is still used when Chromium itself changes.

### العربية
- رسالة يوتيوب «مانع الإعلانات غير مسموح» ما عاد تطلع: 3zT يعطي يوتيوب نفس اللي يعطيه uBlock Origin، وتعديلاته صارت تبان كأنها من المتصفح نفسه، ولو طلعت الرسالة رغم كذا تنقفل لحالها والفيديو يكمل.
- التحديث صار أسرع بكثير: لو التغيير في كود 3zT بس، التحديث كم ميقا ويتركّب في ثانية لما تقفل المتصفح، بدل ما يعيد تثبيت كروميوم كله. التثبيت الكامل يبقى بس لما يتغير كروميوم نفسه.

## 0.12.4

### English
- New switch in Settings → General: "Thmanyah font on every site". It puts the Thmanyah font on the text of websites (YouTube, Google, X...), while icons and code keep their own font. Off by default; needs the Thmanyah font installed on Windows.

### العربية
- زر جديد في الإعدادات ← عام: «خط ثمانية لكل المواقع». يحط خط ثمانية على نصوص المواقع (يوتيوب، قوقل، إكس...)، والأيقونات والأكواد تبقى بخطها. مطفي افتراضياً، ويحتاج خط ثمانية مثبّت على الويندوز.

## 0.12.3

### English
- The search box and the AI button on the new tab (also when it is set to Gemini) now use the Thmanyah font too.

### العربية
- مربع البحث وزر وضع AI في التبويب الجديد (حتى لو حوّلته إلى جيمناي) صاروا بخط ثمانية بعد.

## 0.12.2

### English
- The browser's own pages (top bar, new tab, settings, history, downloads, passwords, tasks) now use the Thmanyah font. It is also a new choice for the clock and date on the new tab. Install the free Thmanyah font from thmanyah.com to see it; without it, the previous font is used.

### العربية
- صفحات المتصفح نفسه (الشريط العلوي، التبويب الجديد، الإعدادات، السجل، التنزيلات، كلمات المرور، المهام) صارت بخط ثمانية، وصار خيار جديد لخط الساعة والتاريخ في التبويب الجديد. ثبّت خط ثمانية المجاني من موقع ثمانية عشان يظهر، وبدونه يرجع للخط السابق.

## 0.12.1

### English
- Past searches in the address bar no longer include your Google AI Mode chats, and a search counts once even when Google opens it a few times, so the list really shows what you search most, then the latest.

### العربية
- عمليات البحث السابقة في الشريط ما عاد تطلع فيها سوالفك مع وضع AI من قوقل، والبحث ينحسب مرة وحدة حتى لو قوقل فتحه أكثر من مرة، فالقائمة صارت فعلاً: اللي تبحث عنه أكثر أول، بعدها آخر اللي بحثت عنه.

## 0.12.0

### English
- Sites that are already dark (like YouTube) now keep their own colours: white controls such as YouTube's volume bar stay white instead of turning black. Light sites are still darkened, and a site switching between light and dark is followed.
- Your past searches show only when you click the empty address bar (not by themselves on a new tab), with the ones you search most often first, then the latest.

### العربية
- المواقع اللي هي أصلاً داكنة (زي يوتيوب) صارت تحتفظ بألوانها: الأزرار البيضاء زي شريط الصوت في يوتيوب تبقى بيضاء وما تتحول سوداء. المواقع الفاتحة لسا تتحول داكنة، ولو الموقع غيّر بين الفاتح والداكن المتصفح يتبعه.
- عمليات البحث السابقة تطلع بس لما تضغط على شريط البحث وهو فاضي (ما تطلع لحالها في التبويب الجديد)، وأول شي اللي تبحث عنها أكثر، بعدها آخر اللي بحثت عنها.

## 0.11.0

### English
- No more white: pages no longer flash white while loading, and every site is dark. Sites with a dark design use it; the rest are darkened automatically (photos and video stay as they are). Can be turned off in Settings → General.
- Address bar: Arabic is written right to left, and your past searches show up (all of them when the bar is empty, matching ones while you type). Arabic Google suggestions work again.
- Faster: a ready page process makes opening sites quicker, the browser connects to a link's site while your mouse is on it (before you click), and extensions load at the same time at start.

### العربية
- وداعاً للأبيض: الصفحات ما عاد تطلع بيضاء وقت التحميل، وكل المواقع صارت داكنة. المواقع اللي عندها وضع داكن تستخدمه، والباقي يتحول داكن تلقائياً (الصور والفيديو تبقى زي ما هي). تقدر تطفيه من الإعدادات ← عام.
- شريط البحث: الكلام العربي يبدأ من اليمين، وتطلع عمليات البحث اللي سويتها قبل (كلها لما يكون الشريط فاضي، واللي تطابق كلامك وأنت تكتب). واقتراحات قوقل العربية رجعت تشتغل.
- أسرع: فيه عملية جاهزة مسبقاً تخلي فتح المواقع أسرع، والمتصفح يتصل بموقع الرابط أول ما تحط الماوس عليه (قبل لا تضغط)، والإضافات تحمّل كلها مع بعض وقت التشغيل.

## 0.10.0

### English
- Site permissions: a small bar under the address bar asks when a site wants your camera, microphone, location, notifications and more. It never blocks the browser and closes by itself after a few seconds (the site is refused that time). Allow and Block are remembered per site.
- The shield panel now shows this site's permissions and lets you change them; Settings lists every site.
- Screen sharing works (Meet, Discord and others): pick a screen or a window. USB, HID and serial devices can be picked too.
- Camera and microphone are asked separately, and sites can no longer read your screen layout without asking.
- Passwords are matched with the official list of web addresses, so different sites on shared hosts (like github.io) never see each other's passwords, and passwords are only ever saved encrypted.
- Updates are now signed: the browser only installs an update carrying the project's signature.
- Lighter: the address bar no longer runs a hidden animation all the time (it used a little CPU even when idle), and the ad counter no longer writes to disk on every blocked ad.

### العربية
- صلاحيات المواقع: شريط صغير تحت شريط العنوان يسألك إذا موقع يبي الكاميرا أو المايك أو موقعك أو الإشعارات أو غيرها. ما يوقف المتصفح، ويختفي لحاله بعد ثواني (وينرفض الطلب هالمرة). السماح والرفض ينحفظون لكل موقع.
- زر الدرع صار يوريك صلاحيات الموقع وتقدر تغيّرها منه، والإعدادات فيها كل المواقع.
- مشاركة الشاشة صارت تشتغل (ميت وديسكورد وغيرها): تختار الشاشة أو النافذة. وأجهزة USB وHID والمنافذ التسلسلية تقدر تختارها بعد.
- الكاميرا والمايك ينطلبون كل واحد بروحه، والمواقع ما عاد تقدر تعرف شاشاتك بدون ما تسألك.
- كلمات السر صارت تتطابق بالقائمة الرسمية لعناوين المواقع، فالمواقع المختلفة على نفس الاستضافة (مثل github.io) ما تشوف كلمات سر بعض، وكلمات السر ما تنحفظ إلا مشفرة.
- التحديثات صارت موقّعة: المتصفح ما يثبت إلا تحديث عليه توقيع المشروع.
- أخف: شريط العنوان كان فيه حركة مخفية شغالة طول الوقت تاخذ شوي من المعالج حتى وأنت ما تسوي شي، وانشالت. وعداد الإعلانات ما عاد يكتب على القرص مع كل إعلان.

## 0.9.0

### English
- Silent updates: 3zT downloads new versions in the background and installs them when you close it. Next time you open it, a short green note says it was updated, with a Details button.
- Download list: press the download button in the bar to see this session's downloads. Click a file to open it, or the folder button to show it in File Explorer. You can pause, resume, cancel and retry from the list.
- Ctrl+J opens the downloads page.

### العربية
- تحديث صامت: المتصفح ينزّل النسخ الجديدة في الخلفية ويثبتها لما تقفله، وأول ما تفتحه تطلع رسالة خضراء صغيرة فيها زر التفاصيل.
- قائمة التنزيلات: اضغط زر التنزيل في الشريط وتطلع لك تنزيلات هالجلسة. اضغط على الملف يفتحه، أو على أيقونة المجلد يفتح لك مكانه في مستكشف الملفات. وتقدر توقف وتكمل وتلغي وتعيد المحاولة من القائمة.
- Ctrl+J يفتح صفحة التنزيلات.

## 0.8.0

### English
- Chrome Web Store: press "Add to 3zT" on any extension to install it; extensions update by themselves.
- New dark installer with a desktop shortcut option; the app is now called 3zT.
- New logo (the monkey only) and a new background video.

### العربية
- متجر كروم: اضغط "Add to 3zT" على أي إضافة وتنضاف، والإضافات تتحدث لحالها.
- سيت اب جديد بواجهة سوداء وفيه خيار اختصار سطح المكتب، والبرنامج صار اسمه 3zT.
- لوقو جديد (القرد بس) وفيديو خلفية جديد.
