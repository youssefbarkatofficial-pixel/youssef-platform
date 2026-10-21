import { normalizeCourseContent } from '../src/lib/courseNormalize.ts';

export function printCourseSchema(courseData, label = 'Current State') {
  const norm = normalizeCourseContent(courseData);
  const attachedHwIds = new Set(
    norm.lectures.flatMap((l) => (l.homeworks || []).map((h) => h.id))
  );
  const looseHws = norm.homeworks.filter((h) => !attachedHwIds.has(h.id));

  console.log(`\n======================================================`);
  console.log(`=== SCHEMA DISCOVERY: ${label}`);
  console.log(`======================================================`);
  console.log(`Course ID: ${courseData.id || '(from document path)'}`);
  console.log(`Title: ${courseData.title || '(no title)'}`);
  console.log(`Layout Version: ${courseData.layoutVersion ?? '(v1 / legacy adopted)'}`);
  console.log(`Total Lectures: ${norm.lectures.length}`);

  norm.lectures.forEach((lec, idx) => {
    console.log(`  [Lecture ${idx + 1}] ID: ${lec.id}`);
    console.log(`    Title: ${lec.title}`);
    console.log(`    Order: ${lec.order}`);
    console.log(`    Video: ${lec.videoUrl || lec.youtubeUrl || '(none)'}`);
    console.log(`    Files (${lec.files?.length || 0}):`);
    (lec.files || []).forEach((f, fIdx) => {
      console.log(`      - File ${fIdx + 1}: "${f.title}" -> ${f.url}`);
    });
    console.log(`    Attached Trainings (${lec.trainings?.length || 0}):`);
    (lec.trainings || []).forEach((t, tIdx) => {
      console.log(`      - Training ${tIdx + 1}: "${t.title}" (ID: ${t.id}, pass: ${t.passingScore ?? 50}%)`);
    });
    console.log(`    Attached Homeworks (${lec.homeworks?.length || 0}):`);
    (lec.homeworks || []).forEach((h, hIdx) => {
      console.log(`      - Homework ${hIdx + 1}: "${h.title}" (ID: ${h.id})`);
    });
  });

  console.log(`\nLoose Homeworks (unattached to lectures): ${looseHws.length}`);
  looseHws.forEach((h, idx) => {
    console.log(`  - Loose HW ${idx + 1}: "${h.title}" (ID: ${h.id})`);
  });

  console.log(`\nCourse Exams: ${norm.exams.length}`);
  norm.exams.forEach((ex, idx) => {
    console.log(`  - Exam ${idx + 1}: "${ex.title}" (ID: ${ex.id}, pass: ${ex.passingScore ?? 50}%)`);
  });
  console.log(`======================================================\n`);
  return norm;
}
