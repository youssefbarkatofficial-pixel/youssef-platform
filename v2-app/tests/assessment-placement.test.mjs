import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCourseContent, buildSectionsFromContent } from '../src/lib/courseNormalize.ts';
import { getVisibleSections, isHiddenItem } from '../src/lib/courseVisibility.ts';

// كورس قديم (بدون layoutVersion) فيه قسم «المحاضرات» يحتوي على محاضرة فيديو وامتحانًا رُفع بالخطأ داخله.
const legacyCourse = {
  id: 'c1',
  title: 'كورس تجريبي',
  contents: {
    sections: [
      {
        id: 'sec_lectures',
        title: 'المحاضرات',
        archived: false,
        items: [
          {
            id: 'lec_1',
            type: 'video',
            title: 'المحاضرة الأولى',
            youtubeUrl: 'https://youtu.be/abc',
            order: 1,
          },
          {
            id: 'exam_1',
            type: 'quiz',
            title: 'امتحان الوحدة الأولى',
            duration: 30,
            contentRef: 'examContent',
            questionCount: 10,
            order: 2,
          },
        ],
      },
    ],
  },
};

test('1. امتحان مرفوع داخل قسم المحاضرات يُقرأ كامتحان ولا يتحول إلى محاضرة فيديو', () => {
  const content = normalizeCourseContent(legacyCourse);

  assert.equal(content.lectures.length, 1, 'محاضرة واحدة فقط في القائمة');
  assert.equal(content.lectures[0].id, 'lec_1');

  assert.equal(content.exams.length, 1, 'الامتحان يظهر في قائمة الامتحانات');
  assert.equal(content.exams[0].id, 'exam_1');
  assert.equal(content.exams[0].title, 'امتحان الوحدة الأولى');
});

test('2. أقسام الكورس الناتجة تضع الامتحان في قسم الامتحانات لا في المحاضرات', () => {
  const sections = buildSectionsFromContent(normalizeCourseContent(legacyCourse));
  const lecturesSection = sections.find((section) => section.id === 'sec_lectures');
  const examsSection = sections.find((section) => section.id === 'sec_exams');

  assert.ok(lecturesSection);
  assert.ok(examsSection);
  assert.deepEqual(lecturesSection.items.map((item) => item.id), ['lec_1']);
  assert.deepEqual(examsSection.items.map((item) => item.id), ['exam_1']);
  assert.equal(examsSection.items[0].assessmentKind, 'exam');
});

test('3. المسودات لا تظهر للطالب وتظهر للأدمن', () => {
  const draftExam = {
    id: 'exam_draft',
    type: 'quiz',
    title: 'امتحان مسودة',
    isDraft: true,
    hidden: true,
    contentRef: 'examContent',
  };
  const publishedExam = { id: 'exam_live', type: 'quiz', title: 'امتحان منشور', contentRef: 'examContent' };

  const sections = buildSectionsFromContent(
    normalizeCourseContent({
      id: 'c2',
      contents: { layoutVersion: 2, lectures: [], homeworks: [], exams: [draftExam, publishedExam] },
    }),
  );

  const studentView = getVisibleSections(sections);
  const examIds = studentView.flatMap((section) => section.items.map((item) => item.id));
  assert.deepEqual(examIds, ['exam_live'], 'الطالب يرى الامتحان المنشور فقط');

  const adminView = getVisibleSections(sections, { includeHidden: true });
  const adminIds = adminView.flatMap((section) => section.items.map((item) => item.id));
  assert.deepEqual(adminIds.sort(), ['exam_draft', 'exam_live'], 'الأدمن يرى المسودة أيضًا');

  assert.equal(isHiddenItem(adminView.flatMap((s) => s.items).find((item) => item.id === 'exam_draft')), true);
});
