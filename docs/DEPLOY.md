# دليل نشر بوت "البوصلة" (Cloudflare Worker Deployment Guide)

> **تحذير أمني وقواعد صارمة**: لا تقم بتنفيذ أي نشر حي أو أي أمر على قاعدة البيانات الحية (`--remote`) دون تفويض وموافقة صريحة مسبقة من مستر يوسف بركات. يجب تنفيذ الخطوات بالترتيب الدقيق الموضح أدناه، وخاصة أخذ النسخة الاحتياطية من D1 وتطبيق الـ Migration **قبل** أي نشر للـ Worker لتفادي توقف الخدمة.

---

## 📋 المتطلبات السابقة (Pre-requisites)

1. توفر بيئة Node.js (الإصدار 20 أو 22) وأداة `wrangler`.
2. التحقق من تسجيل الدخول إلى Cloudflare عبر الأمر:
   ```bash
   npx wrangler whoami
   ```
   *يجب التأكد من ظهور الحساب المصرح له بإدارة الـ Worker وقاعدة `bousala-db`*.
3. التحقق من وجود السر `GROQ_API_KEY` مضبوطاً مسبقاً في الـ Worker:
   ```bash
   npx wrangler secret list
   ```
   *يجب التأكد من ظهور `GROQ_API_KEY` في القائمة*.

---

## 🚀 خطوات النشر بالترتيب الصارم (Deployment Steps)

### الخطوة 0: أخذ نسخة احتياطية كاملة من قاعدة D1 الحية (قبل أي أمر --remote) 💾
لضمان الأمان التام واستعادة البيانات في أي ظرف طارئ، يتم تصدير نسخة كاملة من قاعدة البيانات الحية قبل تنفيذ أي أمر تعديل:

```bash
cd bot-worker
npx wrangler d1 export bousala-db --remote --output=backup.sql
```
*يجب التأكد من اكتمال التصدير وظهور ملف `backup.sql` واحتوائه على جداول وبيانات المنظومة قبل المتابعة*.

---

### الخطوة 1: تطبيق الـ Migration على قاعدة D1 الحية (قبل النشر إلزاميًا) ⚠️
> **السبب التقني الحرج**: الكود الجديد للـ Worker يستعلم ويحدث جدول `conversation_states` لإدارة حالة التدخل المباشر للمعلم. لو تم نشر الـ Worker قبل إنشاء الجدول، ستفشل استعلامات `/chat` فوراً بخطأ `no such table: conversation_states`.

من داخل مجلد `bot-worker`:
```bash
cd bot-worker
npx wrangler d1 execute bousala-db --remote --file=./migrations/0002_conversation_states.sql
```

**التحقق من نجاح تطبيق المايجريشن**:
نفّذ الاستعلام التالي للتأكد من وجود الجدول والفهارس:
```bash
npx wrangler d1 execute bousala-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_states';"
```
*النتيجة المتوقعة:* جدول باسم `conversation_states`.

---

### الخطوة 2: بناء ونشر الـ Worker على Cloudflare
بعد نجاح المايجريشن فقط، يتم بناء TypeScript ونشر الـ Worker:

```bash
cd bot-worker
npm run build
npx wrangler deploy
```

*ستعرض الأداة رابط الـ Worker بعد النشر (مثلاً: `https://bot-worker.<subdomain>.workers.dev`).*

---

### الخطوة 3: فحص نقطة الحالة الصحية العامة (/health)
تحقق من عمل خادم الـ Worker والاتصال بالسر المشفر وقاعدة البيانات:

```bash
curl -s https://bot-worker.<subdomain>.workers.dev/health
```

**الاستجابة المتوقعة (JSON)**:
```json
{
  "status": "ok",
  "service": "bousala-bot-worker",
  "groqConfigured": true,
  "geminiConfigured": false,
  "timestamp": "2026-10-...Z"
}
```
*يجب التأكد من أن `status: "ok"` و `groqConfigured: true`*.

---

### الخطوة 4: اختبار حي لتجربة الطالب عبر التطبيق (v2-app على localhost:5173) 🧭
بدلاً من محاولة استدعاء `/chat` يدوياً بأمر curl الذي يتطلب توكن Firebase ID Token معقد الصلاحية، يتم الاختبار مباشرة من واجهة الطالب الحقيقية:

1. في مجلد `v2-app`، اضبط متغير البيئة ليشير إلى الـ Worker الحي في ملف `.env.local`:
   ```bash
   VITE_BOT_URL=https://bot-worker.<subdomain>.workers.dev
   ```
2. شغّل خادم التطوير المحلي للمنصة:
   ```bash
   cd v2-app
   npm run dev
   ```
3. افتح المتصفح على `http://localhost:5173`، وسجّل الدخول بحساب الطالب التجريبي.
4. افتح درج شات البوصلة (🧭) واطرح سؤالاً منهجياً (مثال: *"ما هي حدود الوطن العربي شمالاً؟"*).
5. **التحقق المطلوب**:
   - استقبال رد فوري من البوصلة معتمد على RAG ومنهج مستر يوسف بركات.
   - التحقق من تحديث رصيد الطالب اليومي في رأس درج المحادثة.
   - تجربة إرسال تقييم 👍 أو 👎 على الرد والتحقق من حفظه.
   - فتح شاشة المعلم `/admin/bot` والتأكد من ظهور المحادثة الجديدة وحالتها.

---

### الخطوة 5: قياس استهلاك المعالج (CPU Time) في Cloudflare Dashboard
بعد إرسال 20 رسالة تجريبية متنوعة (أسئلة عامة، أسئلة منهجية RAG، نوايا ترحيبية):

1. افتح لوحة تحكم Cloudflare:
   `Cloudflare Dashboard -> Workers & Pages -> bot-worker -> Metrics / Analytics`.
2. راجع الرسوم البيانية التالية:
   - **Median CPU time (p50)**: يجب أن يكون أقل من 3ms.
   - **99th Percentile CPU time (p99)**: يجب أن يكون أقل من 8ms (الحد الأقصى المسموح للباقة المجانية هو 10ms).
   - **Success rate (2xx/3xx)**: يجب أن يكون 100% بدون أخطاء 5xx.
   - **Invocation count**: يظهر 20+ استدعاء مسجل.

---

### الخطوة 6: خطة التراجع السريع للطوارئ (Rollback Plan) 🔄

في حال حدوث أي سلوك غير متوقع أو بطء في الأداء:

1. **تراجع فوري عن نشر كود الـ Worker**:
   - من سطر الأوامر:
     ```bash
     cd bot-worker
     npx wrangler rollback
     ```
     *(يتم اختيار الإصدار السابق وتأكيد الرجوع فورياً خلال ثوانٍ)*.
   - أو من لوحة تحكم Cloudflare:
     `Workers & Pages -> bot-worker -> Deployments -> Rollback to previous version`.

2. **أمان قاعدة بيانات D1 عند التراجع**:
   - التعديل رقم `0002` هو إضافة جدول وفهارس جديدة فقط (`CREATE TABLE IF NOT EXISTS conversation_states`).
   - الكود السابق للـ Worker لا يستخدم جدول `conversation_states` نهائياً، وبالتالي فإن التراجع عن كود الـ Worker آمن بنسبة 100% ولا يتطلب حذف أو تعديل أي بيانات في D1.

3. **تعطيل البوت مؤقتاً في حال استمرار المشكلة**:
   - **الخيار الأول (الأسهل)**: من لوحة تحكم المنصة (`/admin/bot`) -> تبويب "الإعدادات" -> ضبط "تشغيل خدمة البوت" على "معطّل" والضغط على حفظ.
   - **الخيار الثاني (مباشرة عبر D1)**: استخدام استعلام D1 الموحد بتوقيت المللي ثانية (`Date.now()`):
     ```bash
     npx wrangler d1 execute bousala-db --remote --command="INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('enabled', 'false', strftime('%s', 'now') * 1000);"
     ```
     *(تعبير `strftime('%s', 'now') * 1000` يولد توقيت Unix بالمللي ثانية المطابق تماماً لـ `Date.now()` في JavaScript)*.
