import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStudentExempt,
  checkLectureLock,
  checkInLectureItemLock,
  formatCairoDateTime,
  computeEffectiveWatch,
  isLectureWatchCompleted,
  getLectureWatchPercent,
  formatMissingRequirementText,
} from '../src/lib/contentRules.ts';

const ACTIVATION_TIME = 1729300000000; // وقت تفعيل القواعد
const rules = {
  enabled: true,
  enabledAt: ACTIVATION_TIME,
  watchThreshold: 0.95
};

test('1. استثناء الطلاب القدامى: الطالب المسجل قبل التفعيل معفي تمامًا', () => {
  const oldStudent = {
    id: 'old-1',
    createdAt: ACTIVATION_TIME - 100000,
    enrolledCourses: {
      'course-1': { enrolledAt: ACTIVATION_TIME - 50000 }
    }
  };

  assert.equal(isStudentExempt(oldStudent, rules, 'course-1'), true);
});

test('2. قاعدة الأمان الصارمة: التاريخ المجهول أو المفقود = معفي', () => {
  const studentWithNoDate = {
    id: 'unknown-1',
    enrolledCourses: {
      'course-1': true
    }
  };

  assert.equal(isStudentExempt(studentWithNoDate, rules, 'course-1'), true);
});

test('3. الطلاب الجدد بعد التفعيل: غير معفيين وتطبق عليهم القواعد', () => {
  const newStudent = {
    id: 'new-1',
    createdAt: ACTIVATION_TIME + 50000,
    enrolledCourses: {
      'course-1': { enrolledAt: ACTIVATION_TIME + 60000 }
    }
  };

  assert.equal(isStudentExempt(newStudent, rules, 'course-1'), false);
});

test('4. الأدمن والمالك: تجاوز كامل للقواعد دائمًا', () => {
  const adminStudent = {
    id: 'admin-1',
    createdAt: ACTIVATION_TIME + 50000
  };

  assert.equal(isStudentExempt(adminStudent, rules, 'course-1', true), true);
});

test('5. قفل التسلسل: المحاضرة الثانية مقفولة حتى مشاهدة الأولى وحل تدريبها', () => {
  const course = {
    id: 'course-1',
    content: {
      lectures: [
        {
          id: 'lec-1',
          trainings: [{ id: 'tr-1', title: 'تدريب 1' }],
          homeworks: [{ id: 'hw-1', title: 'واجب 1' }]
        },
        {
          id: 'lec-2',
          trainings: [],
          homeworks: []
        }
      ]
    }
  };

  const newStudent = {
    id: 'new-1',
    createdAt: ACTIVATION_TIME + 10000,
    enrolledCourses: { 'course-1': { enrolledAt: ACTIVATION_TIME + 10000 } }
  };

  // الحالة أ: لم يشاهد المحاضرة 1
  let lock = checkLectureLock(course, 1, newStudent, {}, [], rules);
  assert.equal(lock.locked, true);
  assert.equal(lock.message, 'خلّص المحاضرة اللي قبلها وحل تدريبها');

  // الحالة ب: شاهد المحاضرة 1 ولكن لم يحل التدريب والواجب
  const watchProgress = { 'lec-1': { coverage: 0.96 } };
  lock = checkLectureLock(course, 1, newStudent, watchProgress, [], rules);
  assert.equal(lock.locked, true);
  assert.equal(lock.message, 'خلّص المحاضرة اللي قبلها وحل تدريبها');

  // الحالة ج: حل التدريب فقط دون الواجب
  let examResults = [{ assessmentId: 'tr-1' }];
  lock = checkLectureLock(course, 1, newStudent, watchProgress, examResults, rules);
  assert.equal(lock.locked, true);

  // الحالة د: حل التدريب والواجب وشاهد 96% -> المحاضرة 2 تفتح!
  examResults.push({ assessmentId: 'hw-1' });
  lock = checkLectureLock(course, 1, newStudent, watchProgress, examResults, rules);
  assert.equal(lock.locked, false);
});

test('6. الطالب المعفي يفتح المحاضرة الثانية حتى لو لم يشاهد الأولى', () => {
  const course = {
    id: 'course-1',
    content: {
      lectures: [{ id: 'lec-1' }, { id: 'lec-2' }]
    }
  };

  const oldStudent = {
    id: 'old-1',
    createdAt: ACTIVATION_TIME - 50000
  };

  // الطالب المعفي يفتح المحاضرة مباشرة
  const lock = checkLectureLock(course, 1, oldStudent, {}, [], rules);
  assert.equal(lock.locked, false);
});

test('7. شرط openAt: يغلق المحاضرة قبل موعدها المحدد بتوقيت القاهرة', () => {
  const futureTime = 1730000000000;
  const course = {
    id: 'course-1',
    content: {
      lectures: [{ id: 'lec-1', openAt: futureTime }]
    }
  };

  const serverTime = futureTime - 3600000; // قبل الموعد بساعة
  const lock = checkLectureLock(course, 0, {}, {}, [], rules, serverTime);
  assert.equal(lock.locked, true);
  assert.equal(lock.reason, 'openAt');
  assert.match(lock.message, /بيفتح يوم/);
});

test('8. computeEffectiveWatch: دمج محلي وسحابي تصاعدي مع ضمان عدم التراجع والاعتراف بـ completedItems و progress.done', () => {
  const student = {
    id: 'student-test',
    watchProgress: { 'lec-1': 100, 'lec-2': 50 },
    completedItems: ['lec-3'],
    progress: {
      'course-1': { done: ['lec-4'] }
    }
  };

  // محلي لديه 6% فقط للمحاضرة 1 (مثلاً فتح الفيديو من جديد لدقيقتين)
  const localWatch = {
    'lec-1': 6,
    'lec-2': 80,
    'lec-5': 30
  };

  const effective = computeEffectiveWatch(student, localWatch, 'course-1');

  // المحاضرة 1 يجب ألا تتراجع إلى 6% بل تبقى 100%
  assert.equal(effective['lec-1'], 100);
  // المحاضرة 2 تأخذ الأكبر بين 50% و 80%
  assert.equal(effective['lec-2'], 80);
  // المحاضرة 3 في completedItems تصبح 100%
  assert.equal(effective['lec-3'], 100);
  // المحاضرة 4 في progress.done تصبح 100%
  assert.equal(effective['lec-4'], 100);
  // المحاضرة 5 تأخذ من المحلي 30%
  assert.equal(effective['lec-5'], 30);
});

test('9. isLectureWatchCompleted و getLectureWatchPercent: الاعتراف التام بالسابقة مع قفل من لم يكمل 95%', () => {
  // أقل من 95% -> مقفول
  assert.equal(isLectureWatchCompleted('lec-1', { 'lec-1': 94 }, 0.95), false);
  assert.equal(getLectureWatchPercent('lec-1', { 'lec-1': 94 }), 94);

  // 95% فما فوق -> مفتوح
  assert.equal(isLectureWatchCompleted('lec-1', { 'lec-1': 95 }, 0.95), true);
  assert.equal(isLectureWatchCompleted('lec-1', { 'lec-1': 100 }, 0.95), true);

  // وجود المحاضرة في completedItems يفتحها حتى لو كانت نسبة المشاهدة 0 أو 6%
  assert.equal(isLectureWatchCompleted('lec-1', { 'lec-1': 6 }, 0.95, ['lec-1']), true);
  assert.equal(getLectureWatchPercent('lec-1', { 'lec-1': 6 }, ['lec-1']), 100);

  // وجود المحاضرة في courseProgressDone يفتحها أيضاً
  assert.equal(isLectureWatchCompleted('lec-1', {}, 0.95, [], ['lec-1']), true);
  assert.equal(getLectureWatchPercent('lec-1', {}, [], ['lec-1']), 100);
});

test('10. checkInLectureItemLock: فحص القفل للملف والتدريب والواجب مع الاعتراف بـ completedItems', () => {
  const lecture = { id: 'lec-1', title: 'التغير المناخي' };
  const fileItem = { id: 'file-1', title: 'مذكرة الدرس' };
  const newStudent = {
    id: 'new-st',
    createdAt: ACTIVATION_TIME + 10000,
    enrolledCourses: { 'course-1': { enrolledAt: ACTIVATION_TIME + 10000 } }
  };

  // حالة 1: الطالب شاهد 6% فقط -> مقفول
  let lock = checkInLectureItemLock(lecture, fileItem, 'file', newStudent, { 'lec-1': 6 }, rules, 'course-1');
  assert.equal(lock.locked, true);
  assert.equal(lock.reason, 'watch');

  // حالة 2: الطالب نفسه لكن لديه المحاضرة في completedItems -> مفتوح فوراً
  const studentWithCompleted = {
    ...newStudent,
    completedItems: ['lec-1']
  };
  lock = checkInLectureItemLock(lecture, fileItem, 'file', studentWithCompleted, { 'lec-1': 6 }, rules, 'course-1');
  assert.equal(lock.locked, false);
});

test('11. عدم ذكر نسبة 95% إطلاقاً في أي رسالة قفل للطالب وعرض النسبة الفعلية فقط', () => {
  const lecture = { id: 'lec-1', title: 'التغير المناخي' };
  const fileItem = { id: 'file-1', title: 'مذكرة الدرس' };
  const newStudent = {
    id: 'new-st',
    createdAt: ACTIVATION_TIME + 10000,
    enrolledCourses: { 'course-1': { enrolledAt: ACTIVATION_TIME + 10000 } }
  };

  const lock = checkInLectureItemLock(lecture, fileItem, 'file', newStudent, { 'lec-1': 6 }, rules, 'course-1');
  assert.equal(lock.locked, true);

  // التأكد من عدم وجود "95%" في الرسالة أو الرسالة التفصيلية
  assert.doesNotMatch(lock.message, /95%/);
  assert.doesNotMatch(lock.detailedMessage || '', /95%/);

  // التأكد من ظهور النسبة الفعلية (6%) وتوجيه المشاهدة الكاملة
  assert.match(lock.message, /6% فقط/);
  assert.match(lock.message, /يجب مشاهدة المحاضرة كاملة/);
  assert.match(lock.detailedMessage || '', /6% فقط/);
  assert.match(lock.detailedMessage || '', /يجب مشاهدة المحاضرة كاملة/);

  // فحص formatMissingRequirementText
  const reqText = formatMissingRequirementText({
    kind: 'watch',
    id: 'lec-1',
    title: 'التغير المناخي',
    currentPercent: 12,
  });
  assert.doesNotMatch(reqText, /95%/);
  assert.match(reqText, /12% فقط/);
  assert.match(reqText, /يجب مشاهدة المحاضرة كاملة/);
});
