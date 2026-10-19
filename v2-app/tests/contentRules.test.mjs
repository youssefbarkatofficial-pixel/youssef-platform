import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStudentExempt,
  checkLectureLock,
  checkInLectureItemLock,
  formatCairoDateTime
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
