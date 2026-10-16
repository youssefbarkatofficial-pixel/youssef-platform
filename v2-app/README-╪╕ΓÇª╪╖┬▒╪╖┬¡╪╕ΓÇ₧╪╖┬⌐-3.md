# تسليم المرحلة 3 (الدفع) — تعليمات التنفيذ

الفولدر ده فيه ملفات جاهزة. انسخها لنفس المسارات بالظبط داخل المشروع، من غير تغيير في الكود.

## خريطة النسخ

| الملف في الـ zip | يُنسخ إلى | النوع |
|---|---|---|
| v2-app/src/lib/image.ts | v2-app/src/lib/image.ts | جديد |
| v2-app/src/services/payments.ts | v2-app/src/services/payments.ts | جديد |
| v2-app/src/pages/student/CheckoutPage.tsx | v2-app/src/pages/student/CheckoutPage.tsx | جديد |
| v2-app/src/pages/student/PaymentRequestsPage.tsx | v2-app/src/pages/student/PaymentRequestsPage.tsx | جديد |
| v2-app/src/pages/admin/PaymentsPage.tsx | نفس المسار | استبدال كامل |
| v2-app/src/pages/public/CourseDetailsPage.tsx | نفس المسار | استبدال كامل |
| v2-app/src/layouts/StudentLayout.tsx | نفس المسار | استبدال كامل |
| v2-app/src/routes/AppRoutes.tsx | نفس المسار | استبدال كامل |
| functions/package.json | functions/package.json (في جذر المشروع، بجانب v2-app) | جديد، غير منشور |
| functions/index.js | functions/index.js | جديد، غير منشور |
| firestore.rules.new | firestore.rules.new (في الجذر) | استبدال كامل، غير منشور |
| storage.rules.new | storage.rules.new (في الجذر) | استبدال كامل، غير منشور |

## قواعد صارمة

1. لا تنشر شيئًا: لا `firebase deploy` ولا للقواعد ولا للدوال. القواعد والدوال ملفات فقط حتى يقول المالك "نفّذ الاستبدال".
2. لا تحذف أي ملف أو بيانات. المشروع على Firebase حقيقي فيه طلاب حقيقيون.
3. لا تعدّل محتوى الملفات إلا لو الـ build فشل بسبب تعارض واضح مع ملفات المراحل السابقة (مثلًا اسم مكوّن أو hook مختلف). في الحالة دي أصلح أقل تغيير ممكن، وسجّل بالظبط إيه اللي غيّرته.
4. لو ملف من الملفات المستبدلة (CourseDetailsPage / StudentLayout / AppRoutes / PaymentsPage) عندك فيه تعديلات أحدث من المرحلة 2، قارن قبل الاستبدال وادمجها بدل ما تفقدها.

## بعد النسخ

1. شغّل `npm run build` داخل v2-app، وابعت لي أي خطأ بنصه كامل.
2. التجربة: بحساب طالب تجريبي وكورس منشور، ثم موافقة أو رفض الطلب التجريبي من لوحة الأدمن حتى لا يبقى معلّقًا. لا توافق على طلب قديم حقيقي إلا بإذن المالك.

## ملاحظات للمراجعة قبل يوم الاستبدال

- storage.rules.new: أُضيفت قراءة فقط لمساري videos/ و pdfs/ لأن المنصة القديمة تستخدمهما.
- تأكد أن معرّفات مجموعة platformAdmins حروفها صغيرة (القواعد الجديدة تستخدم lower()).
- الطلبات القديمة التي ينقصها createdAt لن تظهر في قائمة الأدمن (الترتيب بـ createdAt).
- region في functions/index.js لازم يطابق موقع Firestore قبل أي نشر.
