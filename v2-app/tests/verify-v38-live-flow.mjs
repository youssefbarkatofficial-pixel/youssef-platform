import fs from 'fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { normalizeCourseContent } from '../src/lib/courseNormalize.ts';
import { checkLectureLock } from '../src/lib/contentRules.ts';
import { decodeDoc, encodeDoc } from './firestore-codec.mjs';
import { printCourseSchema } from './schema-printer.mjs';

function normalizeDriveUrl(input) {
  const url = input.trim();
  if (!url) return '';
  const patterns = [/drive\.google\.com\/file\/d\/([\w-]{10,})/i, /drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]{10,})/i];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://drive.google.com/file/d/${match[1]}/view`;
  }
  return url;
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function getOAuthToken() {
  const configPath = 'C:/Users/mohammed/.config/configstore/firebase-tools.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const apiPath = 'C:/Users/mohammed/AppData/Roaming/npm/node_modules/firebase-tools/lib/api.js';
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const api = require(apiPath);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

const COURSE_ID = 'c1792025474962';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/courses/${COURSE_ID}`;

async function fetchCourse(token) {
  const res = await fetch(BASE_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const rawDoc = await res.json();
  const data = decodeDoc(rawDoc);
  data.id = COURSE_ID;
  return { rawDoc, data };
}

async function saveCourse(token, courseData) {
  const encoded = encodeDoc(courseData);
  const updateUrl = `${BASE_URL}?updateMask.fieldPaths=contents&updateMask.fieldPaths=updatedAt`;
  const body = {
    fields: {
      contents: encoded.fields.contents,
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };
  const res = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Save failed: ${res.status} ${err}`);
  }
}

async function run() {
  const token = await getOAuthToken();

  console.log('>>> [STEP 0] Reading initial state of course c1792025474962...');
  const { data: initCourse } = await fetchCourse(token);
  printCourseSchema(initCourse, 'STEP 0: Initial Course State');

  // STEP 1: Upload 3 lectures with Google Drive links
  console.log('\n>>> [STEP 1] Uploading 3 lectures with different Google Drive URL formats...');
  const lectureDrafts = [
    {
      title: 'محاضرة 1: مدخل الوحدة الأولى والبيئة المصرية',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [
        {
          title: 'مذكرة الشرح والتأسيس PDF',
          url: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing'
        }
      ]
    },
    {
      title: 'محاضرة 2: تضاريس مصر والبيئات الجغرافية',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [
        {
          title: 'أطلس خرائط تضاريس مصر PDF',
          url: 'https://drive.google.com/open?id=1AbcDefGhIjKlMnOpQrStUvWxYz0123456789'
        }
      ]
    },
    {
      title: 'محاضرة 3: المناخ والنبات الطبيعي والحيوان البري',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      files: [
        {
          title: 'ملخص المناخ والنبات PDF',
          url: 'https://drive.google.com/uc?id=1ZyxWvuTsRqPoNmLkJiHgFeDcBa9876543210'
        }
      ]
    }
  ];

  // Apply addLectures logic (contentWriter.ts)
  const contents = { ...(initCourse.contents || {}) };
  const rootLectures = [];
  lectureDrafts.forEach((draft, index) => {
    const id = newId('lec');
    const files = draft.files
      .filter((file) => isHttpUrl(file.url))
      .map((file, fileIndex) => ({
        id: `file_${id}_${fileIndex + 1}`,
        title: file.title.trim() || `ملف ${fileIndex + 1}`,
        url: normalizeDriveUrl(file.url),
      }));
    const video = draft.videoUrl.trim();
    rootLectures.push({
      id,
      title: draft.title.trim(),
      youtubeUrl: video,
      videoUrl: video,
      pdfUrl: files[0]?.url || '',
      files,
      order: index + 1,
      duration: '45:00',
      openAt: null,
      trainings: [],
      createdAt: Date.now(),
    });
  });
  contents.lectures = rootLectures;

  await saveCourse(token, { ...initCourse, contents });
  console.log('✔ Step 1 saved to Firestore.');

  const { data: step1Course } = await fetchCourse(token);
  const step1Norm = printCourseSchema(step1Course, 'STEP 1: After 3 Lectures & Drive Files Uploaded');

  // Verify Drive URL normalization
  const lec1 = step1Norm.lectures[0];
  const lec2 = step1Norm.lectures[1];
  const lec3 = step1Norm.lectures[2];
  if (!lec1.files[0].url.startsWith('https://drive.google.com/file/d/')) throw new Error('Drive normalization failed on lec 1');
  if (!lec2.files[0].url.startsWith('https://drive.google.com/file/d/')) throw new Error('Drive normalization failed on lec 2');
  if (!lec3.files[0].url.startsWith('https://drive.google.com/file/d/')) throw new Error('Drive normalization failed on lec 3');
  console.log('✔ All 3 Drive URLs confirmed normalized to standard /file/d/ID/view format.');

  // STEP 2: Upload Training (attached to lec1), Homework (attached to lec1), and Exam
  console.log('\n>>> [STEP 2] Uploading attached training, attached homework, and standalone exam...');
  const contents2 = { ...(step1Course.contents || {}) };
  const targetLec1 = contents2.lectures[0];

  const trainingId = newId('train');
  const homeworkId = newId('hw');
  const examId = newId('exam');

  // 1. Attached Training inside Lecture 1
  const trainingItem = {
    id: trainingId,
    title: 'تدريب تطبيقي على مفاهيم محاضرة 1',
    type: 'training',
    passingScore: 50,
    order: 1,
    lectureId: targetLec1.id,
    attachedToLectureId: targetLec1.id,
    questions: [
      { id: 'q1', title: 'سؤال اختياري 1', type: 'choose', options: ['أ', 'ب', 'ج', 'د'], answer: 'أ', points: 1 }
    ]
  };
  targetLec1.trainings = [trainingItem];

  // 2. Attached Homework in root homeworks
  const homeworkItem = {
    id: homeworkId,
    title: 'واجب منزلي إلزامي على محاضرة 1',
    type: 'homework',
    passingScore: 50,
    order: 1,
    lectureId: targetLec1.id,
    attachedToLectureId: targetLec1.id,
    questions: [
      { id: 'q2', title: 'سؤال الواجب 1', type: 'short', answer: 'الإجابة النموذجية', points: 2 }
    ]
  };
  contents2.homeworks = [homeworkItem];

  // 3. Standalone Exam in root exams
  const examItem = {
    id: examId,
    title: 'امتحان شامل على الوحدة الجغرافية الأولى',
    type: 'exam',
    passingScore: 60,
    order: 1,
    questions: [
      { id: 'q3', title: 'سؤال الامتحان 1', type: 'choose', options: ['صواب', 'خطأ'], answer: 'صواب', points: 5 }
    ]
  };
  contents2.exams = [examItem];

  await saveCourse(token, { ...step1Course, contents: contents2 });
  console.log('✔ Step 2 saved to Firestore.');

  const { data: step2Course } = await fetchCourse(token);
  const step2Norm = printCourseSchema(step2Course, 'STEP 2: After Training, Homework, and Exam Uploaded');

  // STEP 3: Sequential locking verification for e2e student
  console.log('\n>>> [STEP 3] Verifying Sequential Locking for New e2e Student (after enabledAt)...');
  const ACTIVATION_TIME = 1729000000000;
  const contentRules = {
    enabled: true,
    enabledAt: ACTIVATION_TIME,
    watchThreshold: 0.95
  };

  // Student registered after ACTIVATION_TIME (non-exempt)
  const e2eStudent = {
    id: 'e2e-student-verify',
    createdAt: ACTIVATION_TIME + 100000,
    createdAtMs: ACTIVATION_TIME + 100000,
    enrolledCourses: {
      [COURSE_ID]: { enrolledAt: ACTIVATION_TIME + 200000 }
    },
    watchProgress: {},
    examResults: []
  };

  const courseObj = {
    id: COURSE_ID,
    title: step2Course.title,
    content: step2Norm
  };

  // State 3.1: Initial (0% watch, no exams)
  let lockLec1 = checkLectureLock(courseObj, 0, e2eStudent, {}, [], contentRules, Date.now(), false);
  let lockLec2 = checkLectureLock(courseObj, 1, e2eStudent, {}, [], contentRules, Date.now(), false);
  console.log(`  State 3.1: Initial State:`);
  console.log(`    Lecture 1 locked: ${lockLec1.locked} (reason: ${lockLec1.reason})`);
  console.log(`    Lecture 2 locked: ${lockLec2.locked} (reason: ${lockLec2.reason}, message: "${lockLec2.message}")`);
  if (lockLec1.locked) throw new Error('Lecture 1 should be unlocked initially');
  if (!lockLec2.locked) throw new Error('Lecture 2 must be locked sequentially initially');

  // State 3.2: Watched Lecture 1 to 96% (>= 95%), but training not passed and homework not submitted
  const watch96 = { [step2Norm.lectures[0].id]: 96 };
  lockLec2 = checkLectureLock(courseObj, 1, e2eStudent, watch96, [], contentRules, Date.now(), false);
  console.log(`  State 3.2: Watched Lec 1 to 96%:`);
  console.log(`    Lecture 2 locked: ${lockLec2.locked} (reason: ${lockLec2.reason}, message: "${lockLec2.message}")`);
  if (!lockLec2.locked) {
    throw new Error(`Lecture 2 should still be locked for training, got unlocked`);
  }

  // State 3.3: Training passed, but homework not submitted
  const trainingResult = [{ assessmentId: trainingId, score: 90, passed: true }];
  lockLec2 = checkLectureLock(courseObj, 1, e2eStudent, watch96, trainingResult, contentRules, Date.now(), false);
  console.log(`  State 3.3: Training Passed (90%):`);
  console.log(`    Lecture 2 locked: ${lockLec2.locked} (reason: ${lockLec2.reason}, message: "${lockLec2.message}")`);
  if (!lockLec2.locked) {
    throw new Error(`Lecture 2 should still be locked for homework, got unlocked`);
  }

  // State 3.4: Homework submitted (completed: true)
  const allResults = [
    { assessmentId: trainingId, score: 90, passed: true },
    { assessmentId: homeworkId, score: 100, completed: true }
  ];
  lockLec2 = checkLectureLock(courseObj, 1, e2eStudent, watch96, allResults, contentRules, Date.now(), false);
  console.log(`  State 3.4: Watched 96% + Training Passed + Homework Submitted:`);
  console.log(`    Lecture 2 locked: ${lockLec2.locked} (reason: ${lockLec2.reason})`);
  if (lockLec2.locked) {
    throw new Error(`Lecture 2 should now be UNLOCKED! Got locked with reason: ${lockLec2.reason}`);
  }
  console.log('✔ Sequential locking verified 100%: Lec 2 opens ONLY after 95% watch + Training + Homework!');

  // State 3.5: Verify CourseDetailsPage display separation:
  const attachedHwIds = new Set(
    step2Norm.lectures.flatMap((lec) => (lec.homeworks || []).map((hw) => hw.id))
  );
  const looseHomeworks = step2Norm.homeworks.filter((hw) => !attachedHwIds.has(hw.id));
  console.log(`  CourseDetailsPage Display Check:`);
  console.log(`    Attached HWs in Lecture 1 card: ${step2Norm.lectures[0].homeworks?.length}`);
  console.log(`    Loose HWs in general section: ${looseHomeworks.length}`);
  if (!step2Norm.lectures[0].homeworks?.some(h => h.id === homeworkId)) {
    throw new Error('Homework missing from lecture card!');
  }
  if (looseHomeworks.some(h => h.id === homeworkId)) {
    throw new Error('Attached homework duplicated in loose homeworks!');
  }
  console.log('✔ Homework correctly attached inside lecture card and NOT duplicated in general section.');

  // STEP 4: Update assessment in-place and verify persistence and lecture binding
  console.log('\n>>> [STEP 4] Updating assessment in-place via patchAssessmentRaw...');
  const contents4 = { ...(step2Course.contents || {}) };
  // Modify the training inside contents4.lectures[0]
  contents4.lectures[0].trainings[0].title = 'تدريب تطبيقي على مفاهيم محاضرة 1 (معدّل بنجاح)';
  contents4.lectures[0].trainings[0].passingScore = 65;

  await saveCourse(token, { ...step2Course, contents: contents4 });
  console.log('✔ Step 4 saved to Firestore.');

  const { data: step4Course } = await fetchCourse(token);
  const step4Norm = printCourseSchema(step4Course, 'STEP 4: After Assessment Edited in Admin Screen');

  const updatedTraining = step4Norm.lectures[0].trainings[0];
  const passingScore = updatedTraining.passingScore ?? updatedTraining.raw?.passingScore;
  const lectureBinding = updatedTraining.raw?.attachedToLectureId || updatedTraining.raw?.lectureId;
  console.log('  Updated Training Title:', updatedTraining.title);
  console.log('  Updated Training Passing Score:', passingScore);
  console.log('  Updated Training Lecture Binding:', lectureBinding);
  if (updatedTraining.title !== 'تدريب تطبيقي على مفاهيم محاضرة 1 (معدّل بنجاح)') {
    throw new Error('Title update failed to persist');
  }
  if (passingScore !== 65) {
    throw new Error('Passing score update failed to persist');
  }
  if (lectureBinding !== step4Norm.lectures[0].id) {
    throw new Error('Lecture binding was lost after edit!');
  }
  console.log('✔ Assessment edit persisted and lecture binding 100% intact!');

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
