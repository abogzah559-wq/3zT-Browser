# Changelog

Each version has an English and an Arabic part. The release notes and the "Details" button in
the browser's "updated" note are made from these sections.

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
