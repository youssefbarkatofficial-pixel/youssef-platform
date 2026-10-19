import fs from 'fs';
import {
  buildSkillMapFromCourses,
  convertAttemptsToAnswerEvents,
  extractPracticeQuestionsFromCourses
} from '../v2-app/src/lib/revision/adapter.ts';

// 1. Read courses backup
const coursesRaw = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/courses.json', 'utf8'));

// Format courses to match Course interface expected by adapter
function parseCourseDoc(doc) {
  const fields = doc.fields || {};
  const id = doc.name.split('/').pop();
  
  // parse lectures from contents or raw
  let lectures = [];
  const contents = fields.contents?.mapValue?.fields || {};
  if (contents.lectures?.arrayValue?.values) {
    lectures = contents.lectures.arrayValue.values.map(v => {
      const lf = v.mapValue?.fields || {};
      const trainings = lf.trainings?.arrayValue?.values?.map(t => {
        const tf = t.mapValue?.fields || {};
        const questions = tf.questions?.arrayValue?.values?.map(q => {
          const qf = q.mapValue?.fields || {};
          const optionsObj = {};
          if (qf.options?.mapValue?.fields) {
            for (const [k, val] of Object.entries(qf.options.mapValue.fields)) {
              optionsObj[k] = val.stringValue || '';
            }
          }
          return {
            id: qf.id?.stringValue || '',
            text: qf.text?.stringValue || '',
            options: optionsObj,
            answer: qf.answer?.stringValue || '',
            type: qf.type?.stringValue || 'choose',
            archived: qf.archived?.booleanValue || false
          };
        }) || [];
        return {
          id: tf.id?.stringValue || '',
          title: tf.title?.stringValue || '',
          questions
        };
      }) || [];

      return {
        id: lf.id?.stringValue || '',
        title: lf.title?.stringValue || '',
        trainings
      };
    });
  }

  return {
    id,
    title: fields.title?.stringValue || '',
    content: {
      lectures,
      homeworks: [],
      exams: [],
      trainings: [],
      customSections: []
    }
  };
}

const courses = coursesRaw.map(parseCourseDoc);
const { skills, questionToSkill } = buildSkillMapFromCourses(courses);

// 2. Read students backup and extract attempts
const studentsRaw = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/students.json', 'utf8'));

const allAttempts = [];
let studentsWithAttemptsCount = 0;

for (const s of studentsRaw) {
  const fields = s.fields || {};
  const examResultsValues = fields.examResults?.arrayValue?.values || [];
  if (examResultsValues.length > 0) {
    studentsWithAttemptsCount++;
    for (const r of examResultsValues) {
      const rf = r.mapValue?.fields || {};
      const detailsValues = rf.details?.arrayValue?.values || [];
      const details = detailsValues.map(d => {
        const df = d.mapValue?.fields || {};
        return {
          question: df.question?.stringValue || '',
          questionId: df.questionId?.stringValue || df.id?.stringValue || '',
          score: Number(df.score?.integerValue || df.score?.doubleValue || 0),
          method: df.method?.stringValue || 'auto'
        };
      });

      allAttempts.push({
        courseId: rf.courseId?.stringValue || '',
        examId: rf.examId?.stringValue || '',
        percent: Number(rf.percent?.integerValue || rf.percent?.doubleValue || 0),
        attemptNumber: Number(rf.attemptNumber?.integerValue || 1),
        ts: Number(rf.ts?.integerValue || Date.now()),
        details
      });
    }
  }
}

// 3. Run convertAttemptsToAnswerEvents
const { events, unlinkedQuestionsCount } = convertAttemptsToAnswerEvents(allAttempts, questionToSkill);

// 4. Run extractPracticeQuestionsFromCourses
const { practiceQuestions, questionMetas, excludedQuestionsCount } = extractPracticeQuestionsFromCourses(courses);

console.log('=== Item 4: Adapter Testing on Real Production Data ===');
console.log('Total courses analyzed:', courses.length);
console.log('Total skills (lectures) identified:', skills.length);
console.log('Total lecture training questions linked in skill map:', questionToSkill.size);
console.log('Students with past exam/training attempts:', studentsWithAttemptsCount);
console.log('Total attempts processed:', allAttempts.length);
console.log('Extracted valid AnswerEvents:', events.length);
console.log('Unlinked questions excluded from AnswerEvents (zero-guessing):', unlinkedQuestionsCount);
console.log('Total practice questions available for revision:', practiceQuestions.length);
console.log('Practice questions excluded (invalid options / non-MCQ):', excludedQuestionsCount);
