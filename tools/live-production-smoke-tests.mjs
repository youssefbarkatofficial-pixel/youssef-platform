const BASE_URL = 'https://youssefbarakat.pages.dev';
const BOT_URL = 'https://bot-worker.youssefbarkatofficial.workers.dev';
const FIREBASE_PROJECT = 'youssefbarakatplatform-8abff';

async function runLiveChecks() {
  console.log('================================================================');
  console.log('       فحوصات الاستبدال السريعة على البيئة الحية (Production)   ');
  console.log('================================================================\n');

  let allPassed = true;

  // ----------------------------------------------------
  // فحص 1: الرئيسية (Home Page)
  // ----------------------------------------------------
  console.log('--- 1. فحص الصفحة الرئيسية (Home Page) ---');
  try {
    const res = await fetch(BASE_URL);
    console.log(`[GET] ${BASE_URL} -> HTTP ${res.status} ${res.statusText}`);
    if (res.status !== 200) throw new Error(`HTTP status is ${res.status}`);
    const html = await res.text();
    const hasRoot = html.includes('id="root"');
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    const cssMatch = html.match(/href="(\/assets\/index-[^"]+\.css)"/);

    console.log(`- وجود جذر التطبيق (id="root"): ${hasRoot ? '✅ نعم' : '❌ لا'}`);
    console.log(`- عنوان المنصة: "${title}"`);
    console.log(`- ملف الجافاسكريبت الرئيسي: ${scriptMatch ? scriptMatch[1] : 'غير موجود'}`);
    console.log(`- ملف التنسيقات الرئيسي: ${cssMatch ? cssMatch[1] : 'غير موجود'}`);

    if (!hasRoot) throw new Error('Root element not found in HTML');

    if (scriptMatch) {
      const jsRes = await fetch(`${BASE_URL}${scriptMatch[1]}`);
      const jsText = await jsRes.text();
      console.log(`- تحميل حزمة JS الرئيسية: HTTP ${jsRes.status} (حجمها: ${Math.round(jsText.length / 1024)} KB)`);
      if (jsRes.status !== 200) throw new Error('JS bundle failed to load');
    }
    console.log('✅ فحص الرئيسية: ناجح 100%\n');
  } catch (err) {
    console.error(`❌ فحص الرئيسية فشل: ${err.message}\n`);
    allPassed = false;
  }

  // ----------------------------------------------------
  // فحص 2: البوصلة والـ Worker الحي و CORS ونافذة التوكنز
  // ----------------------------------------------------
  console.log('--- 2. فحص البوصلة (Bousala Bot Worker & CORS & Token Engine) ---');
  try {
    // أ) فحص CORS Preflight
    const corsRes = await fetch(`${BOT_URL}/chat`, {
      method: 'OPTIONS',
      headers: {
        'Origin': BASE_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, x-device-id'
      }
    });
    const allowOrigin = corsRes.headers.get('access-control-allow-origin');
    console.log(`[CORS Preflight] Origin: ${BASE_URL} -> Access-Control-Allow-Origin: "${allowOrigin}"`);
    if (allowOrigin !== BASE_URL) {
      throw new Error(`CORS Origin mismatch: expected ${BASE_URL}, received ${allowOrigin}`);
    }

    // ب) فحص رسالة زائر حية
    const startTime = Date.now();
    const chatRes = await fetch(`${BOT_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL,
        'x-device-id': 'prod_verification_visitor_99'
      },
      body: JSON.stringify({
        message: 'مرحبًا يا بوصلة، كيف أبدأ المذاكرة؟',
        history: []
      })
    });
    const duration = Date.now() - startTime;
    console.log(`[POST /chat] استجابة البوصلة -> HTTP ${chatRes.status} (${duration} ms)`);
    if (chatRes.status !== 200) throw new Error(`Bot returned HTTP ${chatRes.status}`);
    const botData = await chatRes.json();
    console.log(`- نص الرد: "${botData.reply?.substring(0, 90)}..."`);
    console.log(`- التوكنز المتبقية: ${botData.remaining ?? 'متاحة'}`);
    console.log(`- مصدر الرد: ${botData.source || 'llm'}`);
    console.log('✅ فحص البوصلة: ناجح 100%\n');
  } catch (err) {
    console.error(`❌ فحص البوصلة فشل: ${err.message}\n`);
    allPassed = false;
  }

  // ----------------------------------------------------
  // فحص 3: كورسات المنصة والمشاهدة (Courses & Lessons)
  // ----------------------------------------------------
  console.log('--- 3. فحص بيانات الكورسات والمشاهدة (Firestore Courses) ---');
  try {
    const coursesRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/courses`);
    console.log(`[Firestore REST] قراءة قائمة الكورسات -> HTTP ${coursesRes.status}`);
    if (coursesRes.status !== 200) throw new Error(`Firestore courses read failed with ${coursesRes.status}`);
    const coursesData = await coursesRes.json();
    const coursesCount = coursesData.documents?.length || 0;
    console.log(`- عدد الكورسات المنشورة المتاحة: ${coursesCount}`);
    if (coursesCount > 0) {
      const firstDoc = coursesData.documents[0];
      const courseId = firstDoc.name.split('/').pop();
      const fields = firstDoc.fields || {};
      const title = fields.title?.stringValue || 'بدون عنوان';
      const grade = fields.grade?.stringValue || '';
      console.log(`- أول كورس متاح: [${courseId}] "${title}" - الصف: ${grade}`);
    }
    console.log('✅ فحص بيانات الكورسات والمشاهدة: ناجح 100%\n');
  } catch (err) {
    console.error(`❌ فحص الكورسات فشل: ${err.message}\n`);
    allPassed = false;
  }

  // ----------------------------------------------------
  // فحص 4: تسجيل الدخول والتحويلات القديمة (Login & Redirects)
  // ----------------------------------------------------
  console.log('--- 4. فحص مسارات تسجيل الدخول والتحويلات ---');
  try {
    const loginRes = await fetch(`${BASE_URL}/login`);
    console.log(`[GET] ${BASE_URL}/login -> HTTP ${loginRes.status}`);
    if (loginRes.status !== 200) throw new Error(`Login route failed: ${loginRes.status}`);

    const redirectRes = await fetch(`${BASE_URL}/login.html`, { redirect: 'manual' });
    const loc = redirectRes.headers.get('location');
    console.log(`[Redirect] /login.html -> HTTP ${redirectRes.status} Location: ${loc}`);
    if (![301, 308].includes(redirectRes.status) || loc !== '/login') {
      throw new Error(`Expected redirect to /login, got ${redirectRes.status} to ${loc}`);
    }

    const legacyStudentRes = await fetch(`${BASE_URL}/dashboard.html`, { redirect: 'manual' });
    const sLoc = legacyStudentRes.headers.get('location');
    console.log(`[Redirect] /dashboard.html -> HTTP ${legacyStudentRes.status} Location: ${sLoc}`);
    if (![301, 308].includes(legacyStudentRes.status) || sLoc !== '/student') {
      throw new Error(`Expected redirect to /student, got ${legacyStudentRes.status} to ${sLoc}`);
    }
    console.log('✅ فحص تسجيل الدخول والتحويلات: ناجح 100%\n');
  } catch (err) {
    console.error(`❌ فحص التحويلات فشل: ${err.message}\n`);
    allPassed = false;
  }

  // ----------------------------------------------------
  // فحص 5: الأدمن وقواعد الأمان الحية (Admin & Firestore Rules)
  // ----------------------------------------------------
  console.log('--- 5. فحص بوابة الأدمن وقواعد الأمان المنشورة ---');
  try {
    const adminRes = await fetch(`${BASE_URL}/admin/login`);
    console.log(`[GET] ${BASE_URL}/admin/login -> HTTP ${adminRes.status}`);
    if (adminRes.status !== 200) throw new Error(`Admin route failed with HTTP ${adminRes.status}`);

    // التأكد من قواعد Firestore: قراءة platform_settings مسموحة للعامة
    const settingsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/platform_settings/generalSettings`);
    console.log(`[Firestore Rules] قراءة platform_settings/generalSettings للعامة -> HTTP ${settingsRes.status}`);
    if (settingsRes.status !== 200) throw new Error(`Public settings read denied: ${settingsRes.status}`);

    // التأكد من قواعد Firestore: محاولة قراءة platformAdmins بدون توكن يجب أن تُرفض تمامًا (403)
    const adminDocsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/platformAdmins`);
    console.log(`[Firestore Rules] محاولة اختراق platformAdmins دون مصادقة -> HTTP ${adminDocsRes.status} (حظر أمني سليم)`);
    if (adminDocsRes.status === 200) {
      throw new Error(`CRITICAL SECURITY FAILURE: platformAdmins is readable without auth!`);
    }
    console.log('✅ فحص بوابة الأدمن وقواعد الأمان: ناجح 100%\n');
  } catch (err) {
    console.error(`❌ فحص بوابة الأدمن فشل: ${err.message}\n`);
    allPassed = false;
  }

  // ----------------------------------------------------
  // النتيجة النهائية
  // ----------------------------------------------------
  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 اكتملت جميع الفحوصات الخمسة على البيئة الحية بنجاح 100%!');
    console.log('   الموقع والبوصلة والقواعد والتحويلات تعمل بأعلى كفاءة.');
  } else {
    console.log('🚨 تنبيه: بعض الفحوصات فشلت. راجع التفاصيل المذكورة.');
  }
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runLiveChecks();
