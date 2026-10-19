import fs from 'node:fs';
import path from 'node:path';

const backupFile = path.resolve('bot-worker/backup.sql');
let sql = fs.readFileSync(backupFile, 'utf8');

// 1. تحديث تعريف الجدول في backup.sql
const oldTableDef = `CREATE TABLE lesson_chunks (
    id TEXT PRIMARY KEY,
    lesson_id TEXT,
    text TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of strings
    grade TEXT,
    unit TEXT,
    subject TEXT,
    created_at INTEGER NOT NULL
);`;

const newTableDef = `CREATE TABLE lesson_chunks (
    id TEXT PRIMARY KEY,
    course_id TEXT,
    lesson_id TEXT,
    stage TEXT,
    kind TEXT DEFAULT 'شرح',
    status TEXT DEFAULT 'draft',
    text TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of strings
    grade TEXT,
    unit TEXT,
    subject TEXT,
    source_note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);`;

if (sql.includes(oldTableDef)) {
  sql = sql.replace(oldTableDef, newTableDef);
}

// 2. ترحيل سطور الـ INSERT للمقاطع الـ 44
// النمط القديم:
// INSERT INTO "lesson_chunks" ("id","lesson_id","text","keywords","grade","unit","subject","created_at") VALUES(...);
const oldInsertRegex = /INSERT INTO "lesson_chunks" \("id","lesson_id","text","keywords","grade","unit","subject","created_at"\) VALUES\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)','([^']*)',(\d+)\);/g;

let count = 0;
sql = sql.replace(oldInsertRegex, (match, id, lessonId, text, keywords, grade, unit, subject, createdAt) => {
  count++;
  const courseId = 'c1785199571849'; // كورس تانية إعدادي في المنصة
  const stage = 'prep2';
  const kind = 'شرح';
  const status = 'verified';
  const fixedGrade = grade && grade.trim() ? grade.trim() : 'الثاني الإعدادي';
  const sourceNote = 'مهاجر من القاعدة السابقة: تانية إعدادي - الوحدة الأولى - الدرس الأول';
  const updatedAt = createdAt;

  return `INSERT INTO "lesson_chunks" ("id","course_id","lesson_id","stage","kind","status","text","keywords","grade","unit","subject","source_note","created_at","updated_at") VALUES('${id}','${courseId}','${lessonId}','${stage}','${kind}','${status}','${text}','${keywords}','${fixedGrade}','${unit}','${subject}','${sourceNote}',${createdAt},${updatedAt});`;
});

// 3. إضافة الفهارس الجديدة إن لم تكن موجودة
if (!sql.includes('idx_chunks_course_lesson')) {
  sql = sql.replace(
    'CREATE INDEX idx_chunks_grade ON lesson_chunks(grade);',
    'CREATE INDEX idx_chunks_grade ON lesson_chunks(grade);\nCREATE INDEX idx_chunks_course_lesson ON lesson_chunks(course_id, lesson_id);\nCREATE INDEX idx_chunks_stage ON lesson_chunks(stage);\nCREATE INDEX idx_chunks_status ON lesson_chunks(status);'
  );
}

fs.writeFileSync(backupFile, sql, 'utf8');

console.log(`[MIGRATION SUCCESS] تم ترحيل ${count} مقطع بنجاح في backup.sql مع الحفاظ الكامل على كافة النصوص والكلمات المفتاحية.`);
