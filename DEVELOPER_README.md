# دليل المطور الشامل — منصة الأستاذ يوسف بركات (V2 Architecture)

مرحباً بك! هذا الدليل موجه لأي مبرمج أو مهندس برمجيات يستلم هذا الكود لمراجعته، اختباره، أو تطوير ميزات جديدة عليه.

---

## 1. نظرة عامة على النظام والمعمارية (Architecture Overview)

المنصة مبنية بأحدث معايير الويب التفاعلي لتوفير تجربة تعليمية فائقة السرعة مع حماية كاملة للمحتوى وعدالة التصحيح:

- **الواجهة الأمامية (Frontend)**: React 18 + TypeScript + Vite 5 + TailwindCSS (Single Page Application متكاملة).
- **قاعدة البيانات والمصادقة (Backend / BaaS)**: Google Firebase (Auth + Cloud Firestore).
- **الخادم السحابي الذكي (Serverless Edge)**: Cloudflare Pages (استضافة الـ Frontend وتوزيع الأصول عبر CDN عالمي) + Cloudflare Workers (Worker البوصلة الذكية مع قاعدة بيانات Cloudflare D1 SQL).
- **تطبيق ويب تقدمي (PWA)**: تطبيق قابل للتثبيت على الهواتف (Android / iOS) وأجهزة الكمبيوتر مع Service Worker آمن، دعم وضع عدم الاتصال (Offline Page)، وتحديثات فورية دون كاش معطّل.

---

## 2. هيكل المجلدات داخل هذا الأرشيف (Project Structure)

```text
├── v2-app/                         # التطبيق الرئيسي الكامل (React + Vite)
│   ├── public/                     # الأصول الثابتة، الأيقونات، PWA Manifest، Service Worker
│   │   ├── icons/                  # أيقونات التطبيق بدقة 192px و 512px و Apple Touch
│   │   ├── manifest.webmanifest    # تعريف PWA
│   │   ├── offline.html            # صفحة عدم الاتصال بالإنترنت
│   │   ├── sw.js                   # Service Worker الذكي
│   │   └── _headers                # إعدادات كاش Cloudflare Pages الأمنية
│   ├── src/
│   │   ├── components/             # المكونات التفاعلية (Layout, UI, Home, Admin, Student, PWA)
│   │   │   ├── admin/              # محررات الكورسات، الأسئلة، والمودالات
│   │   │   ├── home/               # بطاقات الدروس وصورة المعلم الإحصائية
│   │   │   ├── pwa/                # زر التثبيت الذكي <InstallAppButton />
│   │   │   └── ui/                 # مكونات التصميم الأساسية (Buttons, Cards, Inputs, Modals, Badges)
│   │   ├── hooks/                  # React Custom Hooks (useAuth, useCourses, useTheme, etc.)
│   │   ├── layouts/                # تخطيطات الواجهة (StudentLayout, AdminLayout, PublicLayout)
│   │   ├── lib/                    # النواة المنطقية للمنصة (Pure Functions & Engines)
│   │   │   ├── arabicNormalize.ts  # محرك التطبيع اللغوي العربي الصارم
│   │   │   ├── grading.ts          # محرك التصحيح الذهبي للامتحانات
│   │   │   ├── courseNormalize.ts  # محرك تطبيع محتوى الكورسات (layoutVersion: 2)
│   │   │   ├── contentRules.ts     # قواعد القفل التسلسلي واستثناء الطلاب القدامى
│   │   │   ├── videoProgress.ts    # متتبع مشاهدة الفيديو الحقيقي المانع للتخطي (Anti-Seek)
│   │   │   ├── questionImport.ts   # محرك الرفع السريع الذكي (Word .docx, JSON, TXT)
│   │   │   ├── revisionEngine.ts   # محرك التكرار المتباعد للبوصلة (SM-2)
│   │   │   └── firebase.ts         # تهيئة اتصال Firebase
│   │   ├── pages/                  # صفحات المنصة (Public, Student, Admin)
│   │   │   ├── admin/              # لوحة التحكم، الكورسات، الطلاب، المدفوعات، الرفع السريع
│   │   │   ├── student/            # صفحات كورساتي، تفاصيل الكورس، مشاهدة المحاضرة، حل الامتحان
│   │   │   └── public/             # الرئيسية، تسجيل الدخول، إنشاء الحساب، استعادة كلمة المرور
│   │   ├── pwa/                    # التقاط حدث التثبيت BeforeInstallPrompt وتسجيل الـ SW
│   │   ├── services/               # طبقة الاتصال ببيانات Firestore (Courses, Students, Payments, etc.)
│   │   ├── App.tsx                 # نقطة التجميع وإدارة الحالات والجلسات
│   │   └── main.tsx                # مدخل التطبيق وتثبيت الـ Root
│   ├── tests/                      # 53 اختبار وحدة مؤتمت (Automated Unit Tests)
│   ├── package.json                # التبعيات والأوامر
│   ├── vite.config.ts              # إعدادات التجميع وتجزئة الحزم
│   └── tsconfig.json               # إعدادات مترجم TypeScript
│
├── bot-worker/                     # كود Cloudflare Worker لخادم البوصلة الذكية
│   ├── src/                        # منطق الـ Worker ومعالجة الاستفسارات
│   ├── migrations/                 # ترحيلات قاعدة بيانات D1 SQL
│   ├── schema.sql                  # مخطط جداول قاعدة البيانات
│   └── wrangler.toml               # إعدادات نشر الـ Worker على Cloudflare
│
├── tools/                          # أدوات مساعدة وتشخيصية للمطورين
│   ├── activate-content-rules.mjs  # أداة فحص وتفعيل قواعد المحتوى
│   └── get-preview-url.mjs         # أداة فحص نشرات Cloudflare Pages البرمجية
│
├── firestore.rules                 # القواعد الأمنية المعتمدة لقاعدة بيانات Cloud Firestore
├── DEPLOY-RULES.md                 # قواعد وسياسات النشر الصارمة لمنع أي انتكاس
└── DEVELOPER_README.md             # هذا الدليل الشامل
```

---

## 3. المتطلبات الأساسية (Prerequisites)

- **Node.js**: إصدار `v20.x` أو أعلى (يوصى بـ `v22.x` أو `v24.x`).
- **مدير الحزم**: `npm` (مرفق تلقائياً مع Node.js).
- **المحرر**: VS Code أو أي محرر يدعم TypeScript و Tailwind CSS.

---

## 4. التشغيل والتطوير المحلي (Quick Start)

### أ) تشغيل تطبيق الويب (`v2-app`)
1. ادخل إلى مجلد التطبيق:
   ```bash
   cd v2-app
   ```
2. تثبيت الحزم:
   ```bash
   npm install
   ```
3. تشغيل خادم التطوير المحلي:
   ```bash
   npm run dev
   ```
   سيفتح الموقع محلياً على: `http://localhost:5173`.

### ب) فحص الأخطاء البرمجية والأنواع (Type Check)
```bash
npx tsc --noEmit
```
*يجب أن ينتهي بدون أي أخطاء (Exit code 0).*

### ج) تشغيل جناح الاختبارات المؤتمتة (Unit Tests)
```bash
npm test
```
*يشغّل 53 اختباراً دقيقاً تغطي التطبيع العربي، محرك التصحيح، التكرار المتباعد، الرفع السريع، منع التخطي، وسلامة الـ PWA.*

### د) بناء نسخة الإنتاج (Production Build)
```bash
npm run build
```
*ينتج ملفات الإنتاج المحسّنة والمجزأة داخل مجلد `dist/`.*

---

## 5. متغيرات البيئة (Environment Variables)

يحتاج تطبيق `v2-app` لمتغيرات بيئة Firebase (توضع داخل ملف `.env` في مجلد `v2-app` أو في إعدادات Cloudflare Pages):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=youssef-barakat-platform.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=youssef-barakat-platform
VITE_FIREBASE_STORAGE_BUCKET=youssef-barakat-platform.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_BOT_WORKER_URL=https://...workers.dev
```

---

## 6. أهم المعماريات والأنظمة الداخلية (Core Systems)

### 1) محرك التصحيح الذهبي (`v2-app/src/lib/grading.ts` و `arabicNormalize.ts`)
- يدعم الأسئلة الموضوعية (اختيار من متعدد، صح وخطأ، اختيار متعدد، إكمال).
- يحتوي على محرك تطبيع عربي ذكي يوحد الهمزات، ويزيل التشكيل والتنوين والشدة، ويحول الأرقام الهندية للعربية، ويعالج تشوهات نصوص الـ PDF المعكوسة.
- يدعم وضع الظل (Shadow Mode) للأسئلة المقالية لحمايتها من الـ Prompt Injection واحتجازها لمراجعة المعلم.

### 2) قواعد حماية المحتوى ومواعيد النشر (`v2-app/src/lib/contentRules.ts` و `videoProgress.ts`)
- **القفل التسلسلي**: لا تفتح المحاضرة التالية إلا بعد إتمام مشاهدة السابقة وحل تدريبها.
- **استثناء الطلاب القدامى**: الطلاب المسجلون قبل تاريخ تفعيل النظام معفيون تلقائياً من القفل، لحماية حقوقهم وعدم تعطيل دراستهم.
- **مانع تخطي الفيديو (Anti-Seek)**: خوارزمية ذكية تحتسب فترات المشاهدة الحقيقية وتمنع القفز للأمام أو تسريع الفيديو لأكثر من 2x أو ترك التبويب في الخلفية.
- **الفتح المجدول (`openAt`)**: فتح تلقائي للمحاضرة في موعد وتاريخ محدد بتوقيت القاهرة.

### 3) الرفع السريع للمحتوى (`v2-app/src/lib/questionImport.ts` و `QuickUploadPage.tsx`)
- محرك استخراج فريد يعمل بالكامل داخل المتصفح، يفك ضغط ملفات Word (`.docx`) ويستخرج نصوص الأسئلة دون الحاجة لأي مكتبات خارجية ثقيلة.
- يدعم استيراد أسئلة منظمة من نصوص TXT أو ملفات JSON.
- يدعم الرفع المجمّع للدروس وترتيبها تلقائياً من روابط الفيديوهات أو أسماء الملفات.

### 4) أداء لوحة الإدارة (`AdminDashboardPage.tsx` و `students.ts`)
- استخدام كاش SWR (Stale-While-Revalidate) للبيانات الثقيلة لمنع استهلاك قراءات Firebase Spark.
- تحميل تدريجي (Progressive Loading) يعرض الإحصائيات والإيرادات فوراً مع هيكل تحميل Skeleton ناعم.

---

## 7. سياسة النشر الصارمة (Deploy Rules)

- **الإنتاج دائمًا هو فرع `main`** المرتبط بـ Cloudflare Pages.
- **أي تعديل أو ميزة جديدة** يتم تطويرها أولاً على فرع مستقل (`feature/...` أو `fix/...`).
- يتم فحص الكود محلياً بـ `tsc` و `npm test` و `npm run build`.
- يُرفع الفرع لـ GitHub لاختبار رابط المعاينة (Cloudflare Preview).
- بعد التأكد والمراجعة يُدمج في `main` ليُنشر تلقائياً على الإنتاج.
- يمنع منعاً باتاً نشر أي كود قديم أو استخدام wrangler المباشر خارج `v2-app`.

---
*تم إعداد هذا الدليل لضمان تسليم سلس وواضح ومريح لأي فريق تطوير مستقبلي.*
