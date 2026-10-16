# 🏛️ وثيقة التشريح الشامل وبروتوكول الاستبدال الآمن لمنصة «يوسف بركات التعليمية»
### (Master Architectural Blueprint & Zero-Downtime Migration Protocol)

> **موجهة إلى:** نماذج الذكاء الاصطناعي (Claude 3.7 / Kimi k1.5 / GPT-4o) أو أي فريق تطوير برمجيات.  
> **الهدف:** إعادة بناء وتطوير واجهات المنصة بالكامل (UI/UX) وتحسين الأداء والذكاء، مع **الربط المباشر بنفس قاعدة بيانات Firebase الحالية دون فقدان أي عميل أو اشتراك، وبلا تسجيل خروج للطلاب، ودون المساس بترتيب الموقع القوي في محركات بحث Google (SEO)**.

---

## ⚡ توجيه الإطلاق المباشر (Prompt for Claude / Kimi)
*انسخ هذا الصندوق وضعه في أول رسالتك للموديل قبل محتوى الوثيقة:*

```text
أنت الآن المهندس المعماري الرئيسي المسؤول عن إعادة تطوير وتحديث منصة "يوسف بركات التعليمية".
لديك في هذا المستند التشريح الكامل والنهائي للمنصة الحالية بالملي.
مهمتك:
1. بناء واجهات عصرية فائقة الجمال والسرعة (Ultra Modern UI/UX) متجاوبة 100% مع الموبايل والشاشات.
2. حل جميع الأخطاء البرمجية السابقة وتطوير ذكاء المنصة وسرعتها.
3. الالتزام الصارم والكامل بهياكل البيانات (Firestore Schema) والمعادلات الإحصائية الواردة أدناه حرفياً.
4. عدم تغيير أي رابط من روابط المنصة الأساسية أو ملفات إثبات ملكية جوجل للحفاظ على أرشفة Google (SEO).
5. الحفاظ على نفس جلسات دخول الطلاب الحاليين ونفس آلية تسجيل الدخول دون إجبار أي طالب على إنشاء حساب جديد.
ابدأ فوراً ببناء وهيكلة المشروع وفق المواصفات التالية دون أي تعديل على بنية البيانات الخلفية.
```

---

# 1. الهوية العامة وبيانات مشروع Firebase النشط

```javascript
// إعدادات Firebase الرسمية للإنتاج (Production Config)
const firebaseConfig = {
    apiKey: "AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs",
    authDomain: "youssefbarakatplatform-8abff.firebaseapp.com",
    projectId: "youssefbarakatplatform-8abff",
    storageBucket: "youssefbarakatplatform-8abff.firebasestorage.app",
    messagingSenderId: "861961495531",
    appId: "1:861961495531:web:303098945fd4bdbf0eefae"
};
```

* **التخصص التعليمي:** مادة الدراسات الاجتماعية (التاريخ والجغرافيا) لطلاب المرحلة الإعدادية والثانوية في مصر.
* **المراحل الدراسية المعتمدة (Grade Keys):**
  * `prep1`: الصف الأول الإعدادي
  * `prep2`: الصف الثاني الإعدادي
  * `prep3`: الصف الثالث الإعدادي
  * `sec1`: الصف الأول الثانوي
  * `sec2`: الصف الثاني الثانوي
  * `sec3`: الصف الثالث الثانوي

---

# 2. بروتوكول حماية الـ SEO وأرشفة جوجل (Google Rank Preservation)

المنصة متصدرة محركات البحث وذات انتشار واسع. لضمان عدم فقدان تصدر جوجل، **يجب الالتزام بالآتي:**

### أ. ثبات بنية الروابط (URL Structure):
ممنوع تحويل الروابط إلى Single Page Router يغير الامتدادات دون دعم روابط الـ HTML الحالية:
* الرئيسية: `/` أو `index.html`
* الكورسات: `courses.html`
* تفاصيل ومحتوى الكورس: `course-details.html?id=[COURSE_ID]` *(يجب الحفاظ على الباراميتر `?id=`)*
* الحسابات: `login.html` و `register.html`
* لوحة تحكم الطالب: `dashboard.html`
* صفحة الدعم والبوصلة: `support.html`

### ب. ملفات إثبات ملكية Google Search Console في الروت:
يجب بقاء هذه الملفات بنصها ومسارها في المجلد الجذري للموقع:
* `google59a34333e725c2ef.html` -> يحتوي على: `google-site-verification: google59a34333e725c2ef.html`
* `google8b1d992ac3b7c694.html` -> يحتوي على: `google-site-verification: google8b1d992ac3b7c694.html`

### ج. ملفات `sitemap.xml` و `robots.txt`:
* رابط الخريطة الرسمي المؤرشف: `https://youssefbarakat.pages.dev/sitemap.xml`
* منع زواحف جوجل فقط من لوحات الأدمن: `Disallow: /admin-*`

---

# 3. بروتوكول الحفاظ على جلسات وحسابات الطلاب (Zero-Downtime Auth)

### أ. استمرار تسجيل الدخول التلقائي للطلاب الحاليين:
جلسات تسجيل دخول الطلاب مسجلة في المتصفحات عبر `IndexedDB` الخاص بـ Firebase Auth. طالما تستخدم نفس الـ `apiKey` ونفس الـ `projectId` مع:
```javascript
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
```
**فلن يُطلب من أي طالب حالي إعادة تسجيل الدخول مطلقاً.**

### ب. خوارزمية الدخول الهجينة (Hybrid Login & Ghost Accounts):
الطلاب في المنصة نوعان: طلاب سجلوا برقم هاتف فقط، وطلاب سجلوا ببريد إلكتروني حقيقي. لمنع فشل دخول أي طالب قديم، تعتمد المنصة تحويل أرقام الموبايل المصرية إلى بريد مصطنع:

```javascript
async function loginStudentSafe(identifier, password) {
    const raw = identifier.trim().toLowerCase();
    const cleanPhone = raw.replace(/^\+20/, '0').replace(/^0020/, '0').replace(/[^0-9]/g, '');
    
    let candidateEmails = [];
    if (raw.includes('@')) {
        candidateEmails.push(raw);
    } else {
        candidateEmails.push(`${cleanPhone}@student.youssefbarakat.com`);
        candidateEmails.push(`${raw}@student.youssefbarakat.com`);
    }

    let userCredential = null;
    let lastError = null;

    for (let email of candidateEmails) {
        try {
            userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            if (userCredential) break;
        } catch (e) {
            lastError = e;
        }
    }

    if (!userCredential) throw lastError;

    // جلب ملف الطالب من Firestore
    const uid = userCredential.user.uid;
    let snap = await firebase.firestore().collection('students').doc(uid).get();
    
    // فحص احتياطي إذا كان الـ Document ID هو رقم الهاتف
    if (!snap.exists) {
        const phoneSnap = await firebase.firestore().collection('students').where('phone', '==', cleanPhone).limit(1).get();
        if (!phoneSnap.empty) snap = phoneSnap.docs[0];
    }
    
    return snap.exists ? snap.data() : null;
}
```

---

# 4. تشريح هيكل قاعدة البيانات الكامل (Cloud Firestore Schema بالملي)

## أ. مجموعة الطلاب: `students`
* **Document ID:** هو `uid` الصادر من Firebase Auth (أو رقم هاتف الطالب `phone`).
* **الحقول الكاملة:**

| الحقل | النوع | الوصف |
| :--- | :--- | :--- |
| `uid` | `string` | معرف الطالب الفريد من Firebase Auth |
| `name` | `string` | اسم الطالب الكامل |
| `phone` | `string` | رقم هاتف الطالب (المفتاح الأساسي للبحث والتواصل) |
| `parentPhone` | `string` | رقم ولي الأمر (لإرسال التقارير والواتساب) |
| `email` | `string` | البريد الإلكتروني (الحقيقي أو المصطنع `@student.youssefbarakat.com`) |
| `plainPassword` | `string` | كلمة المرور الصريحة (محفوظة لإدارة المنصة واسترجاع الحسابات) |
| `grade` | `string` | الصف الدراسي (`prep1`, `prep2`, `prep3`, `sec1`, `sec2`, `sec3`) |
| `gov` | `string` | المحافظة |
| `studentCode` | `string` | كود الطالب المولد، مثال: `ST-9X2A8F` |
| `role` | `string` | دائماً `"student"` |
| `courses` | `string[]` | مصفوفة بمعرفات الكورسات المفعلة للطالب `["c1", "c1728001"]` |
| `completedItems` | `string[]` | مصفوفة بمعرفات الفيديوهات والملفات والامتحانات المكتملة |
| `watchProgress` | `Map<string, number>` | نسبة مشاهدة كل فيديو، مثل: `{"v_01": 95}` |
| `progress` | `Map<string, Object>` | إنجاز الكورسات: `{ [courseId]: { done: string[], lastWatchTime: number } }` |
| `examResults` | `Object[]` | السجل الأكاديمي الكامل للامتحانات والواجبات (انظر التفصيل أدناه) |
| `notifications` | `Object[]` | قائمة إشعارات الطالب: `[{ id, title, message, timestamp, read, courseId }]` |
| `fcmToken` | `string` | رمز الإشعارات اللحظية Push Notifications |
| `profilePic` | `string` | رابط الصورة الشخصية أو Data URL |
| `createdAt` | `string` | تاريخ إنشاء الحساب (ISO String) |
| `lastActive` | `string` | تاريخ آخر ظهور (لحساب حالة الاتصال أونلاين/أوفلاين) |
| `lastUpdatedAcademicYear`| `number` | السنة الدراسية للترقية الآلية السنوية |
| `banned` | `boolean` | حالة حظر الحساب عند المخالفة |

### تفصيل كائن النتيجة داخل `examResults`:
```typescript
{
    courseId: string;           // معرف الكورس
    examId: string;             // معرف الامتحان أو الواجب
    examTitle: string;          // اسم الامتحان
    percent: number;            // النسبة المئوية المحققة (مثال: 90)
    earnedPoints: number;       // الدرجة الفعلية المحققة
    totalPoints: number;        // الدرجة الكلية للورقة
    effectivePercent: number;   // الدرجة المعتمدة (بعد الغرامات أو المحاولة الرسمية)
    penalized: boolean;         // هل طُبقت غرامة إعادة
    attemptNumber: number;      // رقم المحاولة (1, 2, 3..)
    isOfficial: boolean;        // true فقط للمحاولة الأولى (Official Grade)
    autoSubmit: boolean;        // هل تم الإغلاق التلقائي لانتهاء الوقت
    ts: number;                 // Timestamp تاريخ التسليم
    isTraining: boolean;        // هل هو تدريب تجريبي
    isHomework: boolean;        // هل هو واجب منزلي
    needsReview: boolean;       // هل يحتاج تصحيح يدوي من المعلم
    reviewReason?: string;      // سبب طلب المراجعة
    details?: Array<{           // تفاصيل إجابات الأسئلة الفردية
        qId: string;
        question: string;
        studentAnswer: string;
        correctAnswer: string;
        score: number;
        feedback: string;
        isCorrect: boolean;
    }>;
}
```

---

## ب. مجموعة الكورسات: `courses`
* **Document ID:** معرف الكورس الفريد (مثل: `c1` أو `c17192837482`).
* **الحقول الكاملة:**

```typescript
interface CourseDocument {
    id: string;
    title: string;                   // اسم الكورس
    desc: string;                    // الوصف الأكاديمي
    price: string | number;          // السعر الأساسي بالجنيه
    hasDiscount?: boolean;           // تفعيل تخفيض
    discountPrice?: string | number; // السعر بعد الخصم
    discountExpiry?: number;         // موعد انتهاء الخصم (Timestamp للعداد التنازلي)
    grade: "prep1" | "prep2" | "prep3" | "sec1" | "sec2" | "sec3";
    image: string;                   // غلاف الكورس (Cloud Storage URL)
    hidden: boolean;                 // إخفاء الكورس من العرض
    finished: boolean;               // كورس منتهي (أرشيف)
    courseStatus?: string;           // "يبدأ فوراً" أو "15 أكتوبر"
    lecSchedule?: string;            // موعد المحاضرات (مثال: "السبت 8:00 م")
    hwSchedule?: string;             // موعد الواجبات
    examSchedule?: string;           // موعد الامتحانات
    contents: {
        sections: Array<{            // الأقسام الحديثة
            id: string;              // "sec_lectures", "sec_homeworks", إلخ
            title: string;           // عنوان القسم
            items: Array<CourseItem>;// قائمة العناصر
        }>;
        // التوافق الرجعي للكورسات القديمة (Legacy Arrays):
        lectures?: any[];
        homeworks?: any[];
        exams?: any[];
        trainings?: any[];
        customSections?: any[];
    };
}
```

### عناصر المحتوى (`CourseItem`):
* **فيديو:** `{ id, title, type: 'video', videoUrl, youtubeUrl, duration, availableFrom, availableUntil, attachedToLectureId }`
* **مذكرة PDF:** `{ id, title, type: 'pdf', pdfUrl, fileSize, attachedToLectureId }`
* **واجب / تدريب:** `{ id, title, type: 'task'|'homework', questions: [...], totalPoints, passingScore, timeLimit }`
* **امتحان شامل:** `{ id, title, type: 'quiz'|'exam', questions: [...], totalPoints, passingScore, timeLimit }`
* **عنوان رئيسي:** `{ id, title, type: 'header', thumbnail }`

### هيكل الأسئلة (`ExamQuestion`):
* **اختيار من متعدد (`choose`):** `{ id, type: 'choose', text, image?, points: 1, options: { a, b, c, d }, answer: 'a'|'b'|'c'|'d' }`
* **صح أو خطأ (`tf`):** `{ id, type: 'tf', text, points: 1, answer: 'true'|'false' }`
* **أكمل أو مقالي (`fill` أو `text`):** `{ id, type: 'fill'|'text', text, points: 1, answer: 'النص النموذجي', keywords: [] }`

---

## ج. مجموعة طلبات الدفع: `paymentRequests`
* **Document ID:** معرف مولد تلقائياً (`doc().id`).
* **الحقول:**
```typescript
interface PaymentRequest {
    id: string;
    userId: string;                  // هاتف الطالب أو UID
    userPhone: string;               // رقم هاتف الطالب
    userName: string;                // اسم الطالب
    courseId: string;                // معرف الكورس المطلوب
    courseName?: string;             // اسم الكورس
    amount?: number | string;        // المبلغ
    paymentMethod: "vodafone_cash" | "fawry" | "wallet";
    senderPhone?: string;            // الرقم المحول منه
    receiptNumber?: string;          // رقم الحوالة إن وجد
    proofImage?: string;             // Data URL أو رابط Storage
    proofImageUrl?: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    archived_revenue?: boolean;      // true إذا صُفر العداد دون حذف الطلب
    createdAt: string;               // ISO String
}
```

---

## د. حسابات الإدارة: `platformAdmins`
* **Document ID:** البريد الإلكتروني للمسؤول بأحرف صغيرة: `doc("email@domain.com")`.
* **الحقول:** `{ name: string, email: string, role: "admin" | "assistant" }`.
* **قاعدة الصلاحيات:** دور `assistant` تُحجب عنه شاشات البوصلة وتصفير الأرباح والشكاوى الحساسة.

---

## هـ. إعدادات المنصة: `settings`
1. مستند `paymentSettings`: `{ vCashNum: "01023675235", paymentInstructions: "...", enableFawry: boolean }`
2. مستند `generalSettings`: `{ allowRegistration: boolean, welcomeMessage: "...", courseStatus: "..." }`

---

## و. الذكاء الاصطناعي والألعاب والدعم:
* `bot_chats`: معرف المستند هو رقم هاتف الطالب `{ messages: [{ sender, text, timestamp }], updatedAt }`.
* `bot_settings`: مستند `config` يحتوي على `{ geminiApiKey }`.
* `support_tickets`: تذاكر شكاوى الطلاب `{ id, userId, user, message, ts, status, replies }`.
* `users`: مخصصة لمحرك لعبة صراع البوصلة `{ name, gameXp, gameWins, gameLosses, gamesPlayed, grade }`.

---

# 5. المعادلات الحسابية والإحصائية الرسمية (Exact Formulas)

### 1. معدل الالتزام (Commitment Score) في لوحة الطالب:
$$\text{Commitment} = \text{round}\left(\frac{\sum \text{Official Exam Scores}}{\text{Number of Unique Exams}}\right)\%$$

### 2. مصفوفة تقييم ومستويات الطلاب في لوحة الإدارة (`calcOverallLevel`):
* متوسط الامتحانات الشاملة (Exams): **40%**
* متوسط الواجبات المنزلية (Homeworks): **30%**
* متوسط التدريبات الأسبوعية (Trainings): **20%**
* نسبة مشاهدة المحاضرات (Watch Percentage): **10%**

$$\text{Overall Score} = (0.40 \times \text{AvgExam}) + (0.30 \times \text{AvgHW}) + (0.20 \times \text{AvgTrain}) + (0.10 \times \text{WatchPct})$$

**التصنيف:**
* $\ge 80\%$: **متفوق (Top)** 🌟
* $50\% - 79\%$: **متوسط (Mid)** 📊
* $< 50\%$: **ضعيف (Low)** 📉

### 3. حساب إجمالي الدخل المالي للمنصة:
$$Total Revenue = \sum_{r \in ApprovedRequests \land !r.archived\_revenue} Price(r.courseId)$$
* مع فحص الخصم: إذا كان `hasDiscount == true` و `discountExpiry > now` يُحسب `discountPrice`.

### 4. خوارزمية التصحيح المقالي العربي (`PF_Grader`):
1. **تطبيع النص العربي:** إزالة التشكيل، توحيد الهمزات والألف المقصورة والتاء المربوطة.
2. **استبعاد الكلمات العامة (Stopwords).**
3. **معادلة الدرجة:**
$$Score = (0.40 \times KeywordCoverage) + (0.35 \times JaccardSimilarity) + (0.25 \times LevenshteinSimilarity)$$
* مطابقة الكلمات المفتاحية $\ge 80\%$ تمنح مكافأة $+10\%$.
* احتواء جوهر الإجابة (Containment) يمنح درجة $\ge 82\%$ تلقائياً.

---

# 6. محول الكورسات القديمة والحديثة (Course Adapter Function)

يجب وضع هذه الدالة في كود الواجهة لقراءة جميع الكورسات بالتساوي دون تعديل قواعد البيانات:

```javascript
function normalizeCourseContents(course) {
    const c = course.contents || {};
    if (Array.isArray(c.sections) && c.sections.length > 0) {
        return c.sections;
    }
    let sections = [];
    if (c.lectures && c.lectures.length) sections.push({ id: 'sec_lectures', title: 'المحاضرات', items: c.lectures });
    if (c.homeworks && c.homeworks.length) sections.push({ id: 'sec_homeworks', title: 'الواجبات', items: c.homeworks });
    if (c.exams && c.exams.length) sections.push({ id: 'sec_exams', title: 'الامتحانات', items: c.exams });
    if (c.trainings && c.trainings.length) sections.push({ id: 'sec_trainings', title: 'التدريبات', items: c.trainings });
    if (c.customSections && c.customSections.length) {
        c.customSections.forEach((cs, i) => {
            sections.push({ id: cs.id || 'sec_custom_' + i, title: cs.name || 'قسم مخصص', items: cs.items || [] });
        });
    }
    return sections;
}
```

---

# 7. حل معضلة الكاش والـ Service Worker (`sw.js`)

لتفادي بقاء الشكل القديم أو الشاشة البيضاء في أجهزة الطلاب القدامى:
1. تغيير نسخة الكاش في `sw.js` إلى `v29_unified_cache` (أو أعلى).
2. استدعاء `self.skipWaiting()` و `caches.delete()` لجميع النسخ السابقة عند التفعيل.
3. تضمين أمر إجباري في الـ `<head>` لتحديث الـ Service Worker فور تحميل الصفحة:
```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
        for (let r of regs) r.update();
    });
}
```

---

# 8. منظومة حماية المحتوى من القرصنة (Anti-Piracy Stack)

1. **العلامة المائية العائمة المتحركة:**  
   كود الطالب ورقم هاتفه يتحركان عشوائياً فوق مشغل الفيديو كل 7 ثوانٍ بشفافية منخفضة لمنع تصوير الشاشة.
2. **المنع البرمجي:**  
   تعطيل النقر بزر الماوس الأيمن (`contextmenu`)، وتعطيل النسخ والتحديد، وتعطيل زر `PrintScreen`.
3. **رمز التتبع الخفي (Invisible Tracker):**  
   شريط مشفر Base64 خافت جداً أسفل الشاشة يحمل بيانات الحساب المشاهد لاكتشاف مسرب الفيديوهات في حال التصوير الخارجي.

---

# 9. ذكاء بوت "البوصلة" والدوال السحابية (Firebase Functions)

* **الدالة السحابية النشطة:** `askAlBouslaLLM` في مجلد `_firebase_functions`.
* تعمل بنظام **RAG** موثق بذاكرة تدريبية تمنع الهلوسة وتجيب حصرياً من منهج التاريخ والجغرافيا الخاص بالأستاذ يوسف بركات.
* **إشعارات القبول التلقائية:** الدالة `onPaymentRequestApproved` تستمع لأي تعديل في `paymentRequests` بحالة `approved` وتقوم بإرسال Push Notification فوري لهاتف الطالب وتضيف الكورس له في `students/{phone}.courses`.

---

# 10. التوجيهات الختامية لإعادة التصميم (Claude & Kimi Guidelines)

1. **تصميم عصري ملكي (Royal Luxury UI):**  
   استخدم تدرجات الكحلي الملكي الفاخر (`#071326`, `#0a1e3a`) مع لمسات الذهب الأنيق (`#D4A64F`, `#b8860b`) والزجاج الشفاف (Glassmorphism).
2. **الأداء المتفوق وخفة الحركة:**  
   تقليل حجم ملفات الـ CSS/JS، واستخدام Lazy Loading للصور، وضمان سرعة فتح 100/100 على الموبايل.
3. **صفر أخطاء وتوافق مطلق:**  
   تم تصميم هذه الوثيقة لتمكينك من استبدال الفرونت إند بالكامل وأنت مطمئن بنسبة 100% أن قاعدة البيانات والسيرفر والطلاب والأرباح ستعمل بتوافق كامل دون توقف لحظة واحدة.
