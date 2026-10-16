# منصة يوسف بركات التعليمية

منصة تعليمية للدراسات الاجتماعية (تاريخ وجغرافيا) من السادس الابتدائي حتى الأول الثانوي.
المرحلة الحالية: **0 (الهيكل ونظام التصميم)**. الصفحات ما عدا الرئيسية فيها عبارة «قيد البناء».

## المتطلبات
- برنامج Node.js (النسخة LTS) من https://nodejs.org
- برنامج Visual Studio Code

## التشغيل
1. افتح فولدر المشروع في VS Code.
2. افتح الطرفية من القائمة Terminal ثم New Terminal.
3. اكتب `npm install` لتنزيل المكتبات (مرة واحدة فقط).
4. اكتب `npm run dev` لتشغيل الموقع.
5. افتح الرابط الذي يظهر، وهو غالبًا http://localhost:5173

لإيقاف الموقع اضغط Ctrl + C في الطرفية.

## إعداد Firebase (ليس مطلوبًا في المرحلة 0)
انسخ `.env.example` باسم `.env` واملأ القيم. ملف `.env` لا يُرفع على المستودع.

## روابط الصفحات للتجربة
- العامة: `/` و`/courses` و`/courses/1` و`/login` و`/register` و`/forgot-password`
- الطالب: `/student` و`/student/my-courses` و`/student/exams` و`/student/stats` و`/student/leaderboard` و`/student/profile` و`/student/support`
- الأدمن: `/admin/login` و`/admin` و`/admin/courses` و`/admin/quick-upload` و`/admin/students` و`/admin/students/1` و`/admin/payments` و`/admin/notifications` و`/admin/settings` و`/admin/bot` و`/admin/game`

## البناء والنشر
- `npm run build` ينتج فولدر `dist`.
- النشر على Cloudflare Pages: أمر البناء `npm run build` والمخرجات `dist`.

## الهيكل
- `src/lib` إعدادات Firebase وأدوات مساعدة
- `src/components` المكوّنات المشتركة
- `src/layouts` التخطيطات (عام، طالب، أدمن)
- `src/pages` الصفحات
- `src/routes` التوجيه
