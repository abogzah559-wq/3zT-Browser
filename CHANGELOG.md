# Changelog

Each version has an English and an Arabic part. The release notes and the "Details" button in
the browser's "updated" note are made from these sections.

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
