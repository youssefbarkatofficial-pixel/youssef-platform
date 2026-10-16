# تسليم المرحلة 4أ (الامتحانات والتدريبات والواجبات: جهة الطالب) — تعليمات التنفيذ

الفولدر ده فيه 15 ملف جاهزين. انسخهم لنفس المسارات بالظبط داخل المشروع، من غير تغيير في الكود.
(الملفات دي هي النسخة النهائية الكاملة، اتفرزت من ردود الوكيل اللي اتقطّع بعضها.)

## خريطة النسخ

| الملف في الـ zip | يُنسخ إلى | النوع |
|---|---|---|
| v2-app/src/lib/grading.ts | نفس المسار | جديد |
| v2-app/src/services/assessments.ts | نفس المسار | جديد |
| v2-app/src/components/exam/ExamTaker.tsx | نفس المسار | جديد |
| v2-app/src/components/exam/ExamResultView.tsx | نفس المسار | جديد |
| v2-app/src/pages/student/AssessmentPage.tsx | نفس المسار | جديد |
| v2-app/src/services/courses.ts | نفس المسار | استبدال كامل |
| v2-app/src/services/students.ts | نفس المسار | استبدال كامل |
| v2-app/src/components/course/SectionList.tsx | نفس المسار | استبدال كامل |
| v2-app/src/pages/student/ExamsPage.tsx | نفس المسار | استبدال كامل |
| v2-app/src/routes/AppRoutes.tsx | نفس المسار | استبدال كامل |
| v2-app/src/vite-env.d.ts | نفس المسار | استبدال كامل |
| v2-app/.env.example | نفس المسار | استبدال كامل |
| functions/grading.js | functions/grading.js (جذر المشروع) | جديد، غير منشور |
| functions/index.js | functions/index.js | استبدال كامل، غير منشور |
| firestore.rules.new | firestore.rules.new (الجذر) | استبدال كامل، غير منشور |

لا حاجة لتغيير `functions/package.json` ولا `storage.rules.new` (نفس المرحلة 3).

## قواعد صارمة

1. لا تنشر شيئًا: لا `firebase deploy` لا للقواعد ولا للدوال. القواعد والدوال ملفات فقط حتى يقول المالك "نفّذ الاستبدال".
2. لا تحذف أي ملف أو بيانات. المشروع على Firebase حقيقي فيه طلاب حقيقيون.
3. لا تعدّل محتوى الملفات إلا لو الـ build فشل بسبب تعارض واضح مع ملفات المراحل السابقة. أصلح أقل تغيير ممكن وسجّل بالظبط إيه اللي غيّرته.
4. الملفات المستبدلة (courses.ts و students.ts و SectionList.tsx و ExamsPage.tsx و AppRoutes.tsx و firestore.rules.new و functions/index.js) قارنها بنسختك الحالية قبل الاستبدال. لو عندك فيها تعديلات أحدث، ادمجها بدل ما تضيع. (راجعتها أنا مقابل نسخة المرحلة 3: التغييرات في AppRoutes وfunctions/index.js وfirestore.rules.new إضافات فقط، ومفيش حاجة اتشالت.)

## الإعداد

- انسخ `.env.example` إلى `.env` واملأ قيم Firebase (لو لسه مش عامله).
- `VITE_CLIENT_GRADING_FALLBACK=true` للتجربة الآن فقط (المصحّح المؤقت في المتصفح، للامتحانات القديمة). **لازم تبقى false في أي build نهائي.**

## بعد النسخ

1. شغّل `npm run build` داخل v2-app، وابعت أي خطأ بنصه كامل.
2. التجربة: بحساب طالب **تجريبي**، وعلى امتحان **قديم** (إجاباته في مستند الكورس). الامتحانات الجديدة بتتصحح بالدالة بس، ومش هتتصحح قبل النشر.
3. التجربة بتكتب في `examResults` عند الطالب التجريبي فقط. متجرّبش على حساب طالب حقيقي.

## ملاحظات للمراجعة قبل يوم الاستبدال

- انشر القواعد والدوال **معًا** في نفس الوقت، وخلّي `VITE_CLIENT_GRADING_FALLBACK=false`. لو الدالة اشتغلت والقواعد لسه القديمة والمصحّح المؤقت شغال، ممكن محاولة تتسجل مرتين.
- الأسئلة المقالية (explain / result / prove / relation / whatif / meaning) بتتعلّم `needsReview` وتاخد صفر لحد المراجعة اليدوية. أداة مراجعة الأدمن مش في 4أ.
- الامتحانات الجديدة محتاجة المستندين `examContent` (بدون إجابات) و`examKeys` (للأدمن والسيرفر فقط). إنشاؤها من لوحة الأدمن في 4ب.
- الدالة `gradeExamSubmission` بتحسب وقت التسليم من وقت إنشاء المستند على السيرفر، فمفيش تلاعب بالتوقيت من المتصفح.
- region في functions/index.js لازم يطابق موقع Firestore قبل أي نشر.
