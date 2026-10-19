import type { AttemptResult, Question } from '../grading';
import type { BankQuestion } from '../../services/questionBank';
import type { Course } from '../../services/courses';
import type { AnswerEvent, Outcome, QuestionMeta } from './types';
import type { PracticeQuestion } from '../../components/revision/PracticeRunner';
import type { SkillInfo } from '../../components/revision/RevisionDashboard';

export interface AdapterSkillsResult {
  skills: SkillInfo[];
  questionToSkill: Map<string, string>;
  skillIdToName: Map<string, string>;
}

export interface ConvertAttemptsResult {
  events: AnswerEvent[];
  unlinkedQuestionsCount: number;
}

export interface BankBuildResult {
  practiceQuestions: PracticeQuestion[];
  questionMetas: QuestionMeta[];
  excludedCount: number;
  excludedByType: Record<string, number>;
}

/**
 * 1) استخراج المهارات (المحاضرات/الدروس) وخريطة ربط الأسئلة بالدروس من الكورسات.
 * لا تخمين: السؤال يُربط بالدرس فقط إذا كان تابعًا له مباشرة في الهيكل (مثل تدريبات المحاضرة).
 */
export function buildSkillMapFromCourses(courses: Course[]): AdapterSkillsResult {
  const skills: SkillInfo[] = [];
  const questionToSkill = new Map<string, string>();
  const skillIdToName = new Map<string, string>();
  const seenSkillIds = new Set<string>();

  for (const course of courses) {
    // 1. فحص المحاضرات من content.lectures
    const lectures = course.content?.lectures || [];
    for (const lec of lectures) {
      if (!lec.id) continue;
      if (!seenSkillIds.has(lec.id)) {
        seenSkillIds.add(lec.id);
        const name = lec.title ? lec.title.trim() : `محاضرة ${lec.order || ''}`;
        skills.push({ id: lec.id, name, weight: 1 });
        skillIdToName.set(lec.id, name);
      }

      // ربط أسئلة التدريبات التابعة للمحاضرة
      const trainings = lec.trainings || [];
      for (const tr of trainings) {
        if (Array.isArray(tr.questions)) {
          for (const q of tr.questions as any[]) {
            const qId = q.id || q._id;
            if (qId) {
              questionToSkill.set(String(qId), lec.id);
            }
          }
        }
      }
    }

    // 2. فحص الأقسام والعناصر التابعة لها (CourseSection -> items -> children)
    for (const section of course.sections || []) {
      for (const item of section.items || []) {
        if (item.type === 'video' && item.id) {
          if (!seenSkillIds.has(item.id)) {
            seenSkillIds.add(item.id);
            const name = item.title ? item.title.trim() : 'محاضرة';
            skills.push({ id: item.id, name, weight: 1 });
            skillIdToName.set(item.id, name);
          }

          // الأطفال التابعون للمحاضرة (التدريبات)
          for (const child of item.children || []) {
            const rawQuestions = (child.raw?.questions as unknown[]) || [];
            for (const q of rawQuestions as any[]) {
              const qId = q?.id || q?._id;
              if (qId) {
                questionToSkill.set(String(qId), item.id);
              }
            }
          }
        }
      }
    }
  }

  return { skills, questionToSkill, skillIdToName };
}

/**
 * 2) تحويل نتائج ومحاولات الامتحانات إلى AnswerEvent[].
 * شرط الأمان: إذا كان السؤال بلا درس معروف -> يُستبعد ويُسجل في عداد unlinkedQuestionsCount.
 */
export function convertAttemptsToAnswerEvents(
  attempts: AttemptResult[],
  questionToSkill: Map<string, string>
): ConvertAttemptsResult {
  const events: AnswerEvent[] = [];
  let unlinkedQuestionsCount = 0;

  for (const attempt of attempts) {
    const at = typeof attempt.ts === 'number' && Number.isFinite(attempt.ts) ? attempt.ts : Date.now();
    const details = Array.isArray(attempt.details) ? attempt.details : [];

    for (const detail of details) {
      const qKey = detail.questionId || detail.question;
      if (!qKey) {
        unlinkedQuestionsCount++;
        continue;
      }

      // البحث عن معرّف الدرس
      const skillId = questionToSkill.get(qKey) || questionToSkill.get(detail.question);
      if (!skillId) {
        unlinkedQuestionsCount++;
        continue;
      }

      // تحديد نتيجة الإجابة بدقة
      let outcome: Outcome = 'skipped';
      if (detail.score >= 1 || (detail.pointsEarned === detail.totalPoints && detail.totalPoints > 0)) {
        outcome = 'correct';
      } else if (detail.score === 0 || detail.pointsEarned === 0) {
        outcome = 'wrong';
      } else if (detail.score > 0 && detail.score < 1) {
        // درجات جزئية: نعتبرها صحيحة لو أكثر من 0.5، وإلا خاطئة للمراجعة
        outcome = detail.score >= 0.5 ? 'correct' : 'wrong';
      }

      events.push({
        questionId: qKey,
        skillId,
        outcome,
        at,
        source: 'exam'
      });
    }
  }

  return { events, unlinkedQuestionsCount };
}

/**
 * 3) بناء أسئلة المراجعة (PracticeQuestion) والبيانات الوصفية (QuestionMeta) من بنك الأسئلة.
 * القاعدة: الاختيار من متعدد فقط حالياً، والباقي يُعلم ومستبعد مع العدّ.
 */
export function buildBankPracticeQuestions(
  bankQuestions: BankQuestion[],
  topicToSkillId: Map<string, string>
): BankBuildResult {
  const practiceQuestions: PracticeQuestion[] = [];
  const questionMetas: QuestionMeta[] = [];
  let excludedCount = 0;
  const excludedByType: Record<string, number> = {};

  for (const q of bankQuestions) {
    // 1. السؤال المؤرشف مستبعد تلقائياً
    if (q.archived) {
      excludedCount++;
      excludedByType['archived'] = (excludedByType['archived'] || 0) + 1;
      continue;
    }

    const extra = q as unknown as { asMcq?: boolean; explanation?: string };
    const type = q.type || 'choose';

    // 2. الاختيار من متعدد فقط (choose أو asMcq)
    const isMcq = type === 'choose' || extra.asMcq === true;
    if (!isMcq) {
      excludedCount++;
      excludedByType[type] = (excludedByType[type] || 0) + 1;
      continue;
    }

    // 3. ربط المهارة
    const skillId = topicToSkillId.get(q.topic) || (q.topic && topicToSkillId.has(q.topic.trim()) ? topicToSkillId.get(q.topic.trim()) : null);
    if (!skillId) {
      excludedCount++;
      excludedByType['unlinked_topic'] = (excludedByType['unlinked_topic'] || 0) + 1;
      continue;
    }

    // 4. استخراج الخيارات
    const rawOptions = q.options || {};
    const optionKeys = ['a', 'b', 'c', 'd'].filter(k => typeof rawOptions[k] === 'string' && rawOptions[k].trim() !== '');
    if (optionKeys.length < 2) {
      excludedCount++;
      excludedByType['invalid_options'] = (excludedByType['invalid_options'] || 0) + 1;
      continue;
    }

    const optionsList = optionKeys.map(k => rawOptions[k]);
    const answerKey = String(q.answer || '').trim().toLowerCase();
    let correctIndex = optionKeys.indexOf(answerKey);

    if (correctIndex === -1) {
      // محاولة مطابقة بنص الخيار نفسه
      correctIndex = optionsList.findIndex(opt => opt.trim() === answerKey);
    }

    if (correctIndex === -1) {
      // إجابة غير معروفة في الخيارات
      excludedCount++;
      excludedByType['unknown_answer'] = (excludedByType['unknown_answer'] || 0) + 1;
      continue;
    }

    const qId = q.id || q.docId;
    practiceQuestions.push({
      id: qId,
      skillId,
      text: q.text,
      options: optionsList,
      correctIndex,
      explanation: extra.explanation || ''
    });

    questionMetas.push({
      id: qId,
      skillId
    });
  }

  return { practiceQuestions, questionMetas, excludedCount, excludedByType };
}

/**
 * 4) استخراج أسئلة المراجعة (MCQ) والبيانات الوصفية مباشرة من الكورسات المتاحة للطالب.
 * تستخرج فقط أسئلة الاختيار من متعدد التابعة للدروس مع إجاباتها الصحيحة.
 */
export function extractPracticeQuestionsFromCourses(courses: Course[]): {
  practiceQuestions: PracticeQuestion[];
  questionMetas: QuestionMeta[];
} {
  const practiceQuestions: PracticeQuestion[] = [];
  const questionMetas: QuestionMeta[] = [];
  const seenQIds = new Set<string>();

  for (const course of courses) {
    const lectures = course.content?.lectures || [];
    for (const lec of lectures) {
      if (!lec.id) continue;
      const trainings = lec.trainings || [];
      for (const tr of trainings) {
        if (!Array.isArray(tr.questions)) continue;
        for (const q of tr.questions as any[]) {
          const qId = q.id || q._id;
          if (!qId || seenQIds.has(String(qId))) continue;

          const isMcq = q.type === 'choose' || q.asMcq === true;
          if (!isMcq) continue;

          const rawOptions = q.options || {};
          const optionKeys = ['a', 'b', 'c', 'd'].filter(
            (k: string) => typeof rawOptions[k] === 'string' && rawOptions[k].trim() !== ''
          );
          if (optionKeys.length < 2) continue;

          const optionsList = optionKeys.map((k: string) => rawOptions[k]);
          const answerKey = String(q.answer || '').trim().toLowerCase();
          let correctIndex = optionKeys.indexOf(answerKey);
          if (correctIndex === -1) {
            correctIndex = optionsList.findIndex((opt: string) => opt.trim() === answerKey);
          }
          if (correctIndex === -1) continue;

          seenQIds.add(String(qId));
          practiceQuestions.push({
            id: String(qId),
            skillId: lec.id,
            text: q.text || '',
            options: optionsList,
            correctIndex,
            explanation: q.explanation || ''
          });

          questionMetas.push({
            id: String(qId),
            skillId: lec.id
          });
        }
      }
    }
  }

  return { practiceQuestions, questionMetas };
}

