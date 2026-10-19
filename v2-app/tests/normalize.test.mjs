import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCourseContent, buildSectionsFromContent } from '../src/lib/courseNormalize.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('normalizeCourseContent handles course c1785241200444 correctly without content loss', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'course-c1785241200444.json');
  const courseData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const norm = normalizeCourseContent(courseData);

  // 1. Verify layout version
  assert.equal(norm.layoutVersion, 2, 'layoutVersion should be 2');

  // 2. Verify all 4 lectures are recovered
  assert.equal(norm.lectures.length, 4, 'Should recover exactly 4 lectures');
  const lectureIds = norm.lectures.map(l => l.id);
  assert.deepEqual(
    lectureIds,
    ['res_1787199271833', 'res_1786642923546', 'res_1787931501036', 'res_1789051824567'],
    'All 4 original lecture IDs must be present in order'
  );

  // 3. Verify each lecture has its youtubeUrl
  for (const lec of norm.lectures) {
    assert.ok(lec.youtubeUrl && lec.youtubeUrl.length > 0, `Lecture ${lec.id} must have a video URL`);
    assert.ok(lec.title && lec.title.length > 0, `Lecture ${lec.id} must have a title`);
  }

  // 4. Verify all 4 attached trainings are linked to their respective lectures
  const totalTrainings = norm.lectures.reduce((sum, l) => sum + l.trainings.length, 0);
  assert.equal(totalTrainings, 4, 'Should have exactly 4 attached trainings distributed across lectures');
  for (const lec of norm.lectures) {
    assert.equal(lec.trainings.length, 1, `Lecture ${lec.title} must have its attached training`);
  }

  // 5. Verify all 3 homeworks are recovered
  assert.equal(norm.homeworks.length, 3, 'Should recover exactly 3 homeworks');
  const hwIds = norm.homeworks.map(h => h.id);
  assert.deepEqual(
    hwIds,
    ['res_1786470024847', 'u_1788882342742_x8i4bm', 'u_1789494599796_by07tb'],
    'All 3 original homework IDs must be present'
  );

  // 6. Verify all 5 exams are recovered
  assert.equal(norm.exams.length, 5, 'Should recover exactly 5 exams');
  const examIds = norm.exams.map(e => e.id);
  assert.deepEqual(
    examIds,
    ['res_1787071148882', 'res_1786640827792', 'res_1786641669612', 'u_1787833295445_csg9qv', 'u_1789051714123_2h8grv'],
    'All 5 original exam IDs must be present'
  );

  // 7. Verify all 4 legacy sections in contents.sections were processed and accounted for
  assert.equal(courseData.contents.sections.length, 4, 'Course fixture must have 4 legacy sections');
  const allNormalizedIds = new Set([
    ...norm.lectures.map(l => l.id),
    ...norm.lectures.flatMap(l => l.trainings.map(t => t.id)),
    ...norm.homeworks.map(h => h.id),
    ...norm.exams.map(e => e.id),
  ]);

  for (const sec of courseData.contents.sections) {
    for (const item of sec.items) {
      assert.ok(
        allNormalizedIds.has(item.id),
        `Item ${item.id} (${item.title}) from legacy section ${sec.id} must not be lost`
      );
    }
  }

  // 8. Verify order field is ascending
  for (let i = 0; i < norm.lectures.length - 1; i++) {
    assert.ok(norm.lectures[i].order <= norm.lectures[i + 1].order, 'Lectures must be sorted by order');
  }
  for (let i = 0; i < norm.homeworks.length - 1; i++) {
    assert.ok(norm.homeworks[i].order <= norm.homeworks[i + 1].order, 'Homeworks must be sorted by order');
  }
  for (let i = 0; i < norm.exams.length - 1; i++) {
    assert.ok(norm.exams[i].order <= norm.exams[i + 1].order, 'Exams must be sorted by order');
  }

  // 9. Verify buildSectionsFromContent generates sections
  const sections = buildSectionsFromContent(norm);
  assert.equal(sections.length, 3, 'Should build 3 sections: Lectures, Homeworks, Exams');
  assert.equal(sections[0].id, 'sec_lectures');
  assert.equal(sections[0].items.length, 4);
  assert.equal(sections[1].id, 'sec_homeworks');
  assert.equal(sections[1].items.length, 3);
  assert.equal(sections[2].id, 'sec_exams');
  assert.equal(sections[2].items.length, 5);
});

test('normalizeCourseContent respects layoutVersion: 2 directly', () => {
  const v2Data = {
    contents: {
      layoutVersion: 2,
      lectures: [
        { id: 'l1', title: 'محاضرة 1', youtubeUrl: 'https://youtu.be/test1', order: 2, trainings: [] },
        { id: 'l2', title: 'محاضرة 2', youtubeUrl: 'https://youtu.be/test2', order: 1, trainings: [] },
      ],
      homeworks: [
        { id: 'h1', title: 'واجب 1', order: 1 },
      ],
      exams: [
        { id: 'e1', title: 'امتحان 1', order: 1 },
      ],
      sections: [{ id: 'old', items: [{ id: 'ignored_item', type: 'video' }] }]
    }
  };

  const norm = normalizeCourseContent(v2Data);
  assert.equal(norm.layoutVersion, 2);
  assert.equal(norm.lectures.length, 2);
  // Checked sorting by order: l2 (order: 1) should come before l1 (order: 2)
  assert.equal(norm.lectures[0].id, 'l2');
  assert.equal(norm.lectures[1].id, 'l1');
  assert.equal(norm.homeworks.length, 1);
  assert.equal(norm.exams.length, 1);
  // Old sections must be ignored when layoutVersion === 2
  assert.ok(!norm.lectures.some(l => l.id === 'ignored_item'));
});

test('deleted training stays deleted after save and reload (ignores legacy contents.trainings when layoutVersion === 2)', () => {
  // 1. Initial course state with legacy trainings array
  const legacyCourse = {
    contents: {
      sections: [
        {
          id: 'sec_1',
          title: 'الوحدة الأولى',
          items: [
            { id: 'lec_1', title: 'المحاضرة الأولى', type: 'video', youtubeUrl: 'https://youtu.be/abc' },
          ]
        }
      ],
      trainings: [
        { id: 'tr_to_delete', title: 'تدريب يجب حذفه', attachedToLectureId: 'lec_1' },
        { id: 'tr_to_keep', title: 'تدريب باقٍ', attachedToLectureId: 'lec_1' }
      ]
    }
  };

  // 2. Initial load (legacy conversion)
  const initialNorm = normalizeCourseContent(legacyCourse);
  assert.equal(initialNorm.lectures[0].trainings.length, 2, 'Initially should have 2 trainings');

  // 3. User deletes "tr_to_delete" in admin panel
  const updatedTrainings = initialNorm.lectures[0].trainings.filter(t => t.id !== 'tr_to_delete');
  const updatedLectures = [{ ...initialNorm.lectures[0], trainings: updatedTrainings }];

  // 4. Simulated save to Firestore: preserves existing legacy contents (...existingContents), but sets layoutVersion: 2 and new lectures
  const savedCourseData = {
    contents: {
      ...legacyCourse.contents, // Still contains contents.trainings from legacy!
      layoutVersion: 2,
      lectures: updatedLectures,
      homeworks: initialNorm.homeworks,
      exams: initialNorm.exams
    }
  };

  // 5. Subsequent reload
  const reloadedNorm = normalizeCourseContent(savedCourseData);

  // 6. Verify deleted training DOES NOT reappear
  assert.equal(reloadedNorm.lectures[0].trainings.length, 1, 'Should have exactly 1 training remaining');
  assert.equal(reloadedNorm.lectures[0].trainings[0].id, 'tr_to_keep');
  assert.ok(
    !reloadedNorm.lectures[0].trainings.some(t => t.id === 'tr_to_delete'),
    'Deleted training must stay deleted and not be re-injected from legacy contents.trainings'
  );
});
