/**
 * tools/bot-import.js
 * سكربت استيراد بيانات البوصلة من tools/bot-export إلى Cloudflare D1
 * افتراضيًا: --dry-run (آمن بدون تنفيذ)
 * للتنفيذ المحلي: node tools/bot-import.js --execute --local
 * للتنفيذ السحابي: node tools/bot-import.js --execute --remote
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const exportDir = path.join(__dirname, 'bot-export');

const isExecute = process.argv.includes('--execute');
const isRemote = process.argv.includes('--remote');
const targetFlag = isRemote ? '--remote' : '--local';

function escapeSql(str) {
  if (str === null || str === undefined) return "''";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function norm(t) {
  if (!t) return '';
  return t
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  console.log('='.repeat(65));
  console.log('بوابة العلم — سكربت استيراد بيانات البوصلة إلى Cloudflare D1');
  console.log(`الوضع: ${isExecute ? `تنفيذ فعلي (${isRemote ? 'Remote Cloudflare' : 'Local SQLite'})` : 'Dry-Run تجريبي (لا كتابة)'}`);
  console.log('='.repeat(65));

  const sqlStatements = [];

  // 1. استيراد الإعدادات الافتراضية
  const defaultSettings = [
    { key: 'enabled', value: 'true', desc: 'حالة تشغيل البوت' },
    { key: 'daily_student_limit', value: '30', desc: 'الحد اليومي لرسائل الطالب' },
    { key: 'global_daily_cap', value: '4000', desc: 'السقف اليومي العام للبوت' },
    { key: 'schedule_prep', value: 'مواعيد المنصة الثابتة: للمرحلة الإعدادية (شرح وتدريب يوم الخميس، واجب يوم الثلاثاء، امتحان يوم الأربعاء الساعة 9 مساءً).', desc: 'مواعيد المرحلة الإعدادية' },
    { key: 'schedule_sec', value: 'للمرحلة الثانوية (شرح وتدريب يوم الجمعة، واجب يوم الثلاثاء، امتحان يوم الأربعاء الساعة 9 مساءً).', desc: 'مواعيد المرحلة الثانوية' },
    { key: 'groq_primary_model', value: 'llama-3.3-70b-versatile', desc: 'النموذج الذكي للأسئلة المعقدة' },
    { key: 'groq_fast_model', value: 'llama-3.1-8b-instant', desc: 'النموذج السريع للأسئلة البسيطة' }
  ];

  const now = Date.now();
  for (const s of defaultSettings) {
    sqlStatements.push(
      `INSERT INTO settings (key, value, description, updated_at) VALUES (${escapeSql(s.key)}, ${escapeSql(s.value)}, ${escapeSql(s.desc)}, ${now}) ON CONFLICT(key) DO UPDATE SET value = ${escapeSql(s.value)}, updated_at = ${now};`
    );
  }

  // 2. استيراد الدروس والتقطيع الأكاديمي مقابل أسئلة الطلاب (التعلم الذاتي)
  const lessonsFile = path.join(exportDir, 'lessons.json');
  let academicCount = 0;
  let selfLearningCount = 0;

  if (fs.existsSync(lessonsFile)) {
    const lessons = JSON.parse(fs.readFileSync(lessonsFile, 'utf8'));
    
    // إنشاء كورس/درس جامع في جدول lessons
    const academicLessonId = 'lesson_prep2_u1_l1';
    sqlStatements.push(
      `INSERT INTO lessons (id, subject, grade, unit, title, archived, created_at) VALUES (${escapeSql(academicLessonId)}, 'دراسات اجتماعية', 'الثاني الإعدادي', 'الوحدة الأولى', 'الدرس الأول: جبال وهضاب الوطن العربي', 0, ${now}) ON CONFLICT(id) DO NOTHING;`
    );

    for (const l of lessons) {
      const isSelfLearning = (l.grade && l.grade.includes('تعلم ذاتي')) || (l.unit && l.unit.includes('أسئلة الطلاب'));
      const kwJson = JSON.stringify(l.keywords || []);

      if (isSelfLearning) {
        selfLearningCount++;
        sqlStatements.push(
          `INSERT INTO self_learning_pending (id, text, keywords, grade, unit, subject, status, created_at) VALUES (${escapeSql(l.id)}, ${escapeSql(l.text)}, ${escapeSql(kwJson)}, ${escapeSql(l.grade)}, ${escapeSql(l.unit)}, ${escapeSql(l.subject)}, 'pending', ${l.createdAt || now}) ON CONFLICT(id) DO NOTHING;`
        );
      } else {
        academicCount++;
        sqlStatements.push(
          `INSERT INTO lesson_chunks (id, lesson_id, text, keywords, grade, unit, subject, created_at) VALUES (${escapeSql(l.id)}, ${escapeSql(academicLessonId)}, ${escapeSql(l.text)}, ${escapeSql(kwJson)}, ${escapeSql(l.grade)}, ${escapeSql(l.unit)}, ${escapeSql(l.subject)}, ${l.createdAt || now}) ON CONFLICT(id) DO NOTHING;`
        );
      }
    }
  }

  // 3. استيراد النوايا (Semantic Intents)
  const intentsFile = path.join(exportDir, 'bousala-intents.json');
  let intentsCount = 0;
  if (fs.existsSync(intentsFile)) {
    const intentsData = JSON.parse(fs.readFileSync(intentsFile, 'utf8'));
    const coreQuestions = intentsData.core_questions || [];
    intentsCount = coreQuestions.length;

    for (const q of coreQuestions) {
      const varsJson = JSON.stringify(q.variations || []);
      sqlStatements.push(
        `INSERT INTO intents (core_id, intent, category, answer, variations) VALUES (${escapeSql(q.core_id)}, ${escapeSql(q.intent)}, ${escapeSql(q.category)}, ${escapeSql(q.answer)}, ${escapeSql(varsJson)}) ON CONFLICT(core_id) DO UPDATE SET answer = ${escapeSql(q.answer)}, variations = ${escapeSql(varsJson)};`
      );
    }
  }

  // 4. استيراد الإجابات المعتمدة من الأدمن
  const learningFile = path.join(exportDir, 'global_learning.json');
  let learnedCount = 0;
  if (fs.existsSync(learningFile)) {
    const learningMap = JSON.parse(fs.readFileSync(learningFile, 'utf8'));
    for (const [question, answer] of Object.entries(learningMap)) {
      learnedCount++;
      const id = 'learned_' + learnedCount;
      const qNorm = norm(question);
      sqlStatements.push(
        `INSERT INTO learned_answers (id, question, question_norm, answer, created_at, updated_at) VALUES (${escapeSql(id)}, ${escapeSql(question)}, ${escapeSql(qNorm)}, ${escapeSql(answer)}, ${now}, ${now}) ON CONFLICT(id) DO UPDATE SET answer = ${escapeSql(answer)};`
      );
    }
  }

  console.log('تقرير التجهيز:');
  console.log(`- إعدادات النظام: ${defaultSettings.length} إعداد.`);
  console.log(`- مقاطع المنهج الأكاديمية (تدخل RAG و lesson_chunks): ${academicCount} مقطع.`);
  console.log(`- مقاطع أسئلة الطلاب (مفصولة في self_learning_pending للمراجعة): ${selfLearningCount} مقطع.`);
  console.log(`- نوايا بنك الأسئلة (intents): ${intentsCount} نية.`);
  console.log(`- إجابات معتمدة من الأدمن (learned_answers): ${learnedCount} إجابة.`);
  console.log(`- إجمالي جمل SQL المجهزة: ${sqlStatements.length} جملة.`);

  if (!isExecute) {
    console.log('\n[Dry-Run انتهى بنجاح]. لم يتم إرسال أي أوامر للـ Database.');
    console.log('للتنفيذ الفعلي:');
    console.log('  محلياً: node tools/bot-import.js --execute --local');
    console.log('  سحابياً: node tools/bot-import.js --execute --remote');
    return;
  }

  // التنفيذ الفعلي
  console.log(`\nجاري تطبيق الـ Schema أولاً (${targetFlag})...`);
  const workerDir = path.join(__dirname, '..', 'bot-worker');
  const schemaFile = path.join(workerDir, 'schema.sql');
  const envCmd = 'set PATH=C:\\Users\\mohammed\\.node22\\node-v22.23.3-win-x64;%PATH%';

  execSync(`${envCmd} && npx wrangler d1 execute bousala-db ${targetFlag} --file="${schemaFile}"`, {
    cwd: workerDir,
    stdio: 'inherit'
  });

  console.log('\nجاري تنفيذ بيانات الاستيراد عبر D1 batch...');
  const tmpSqlFile = path.join(workerDir, 'temp_import.sql');
  fs.writeFileSync(tmpSqlFile, sqlStatements.join('\n'), 'utf8');

  try {
    execSync(`${envCmd} && npx wrangler d1 execute bousala-db ${targetFlag} --file="${tmpSqlFile}"`, {
      cwd: workerDir,
      stdio: 'inherit'
    });
    console.log('\n✅ تم استيراد كافة البيانات بنجاح في Cloudflare D1!');
  } finally {
    if (fs.existsSync(tmpSqlFile)) {
      fs.unlinkSync(tmpSqlFile);
    }
  }
}

main().catch(err => {
  console.error('حدث خطأ أثناء الاستيراد:', err);
  process.exit(1);
});
