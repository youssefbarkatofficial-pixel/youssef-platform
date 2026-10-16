import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isGradeCode } from '../lib/grades';
import type { GradeCode } from '../lib/grades';
import { parseQuestions } from '../lib/grading';
import { draftFromQuestion, parseRubric, toKeyEntry, toPublicQuestion } from '../lib/questionDraft';
import type { QuestionDraft } from '../lib/questionDraft';

// بنك الأسئلة: مجموعة questionBank (للأدمن فقط، وفيها الإجابات الصحيحة).
// لا حذف أبدًا: السؤال المحذوف في الواجهة يُؤرشف بحقل archived.

export interface BankMeta {
  grade: GradeCode | '';
  topic: string;
}

export interface BankQuestion extends QuestionDraft {
  docId: string;
  grade: GradeCode | '';
  topic: string;
  archived: boolean;
  createdAt: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseBankQuestion(docId: string, data: DocumentData): BankQuestion | null {
  // نعيد استخدام قارئ الأسئلة نفسه ثم نضيف بنود التقييم وبيانات البنك.
  const [question] = parseQuestions([{ ...data, id: asString(data.id) || docId }]);
  if (!question) return null;

  const draft = draftFromQuestion(question);
  const grade = asString(data.grade);

  return {
    ...draft,
    rubric: parseRubric(data.rubric),
    docId,
    grade: isGradeCode(grade) ? grade : '',
    topic: asString(data.topic),
    archived: data.archived === true,
    createdAt: asString(data.createdAt),
  };
}

export async function listBankQuestions(max: number = 500): Promise<BankQuestion[]> {
  const snapshot = await getDocs(
    query(collection(db, 'questionBank'), orderBy('createdAt', 'desc'), limit(max)),
  );

  const questions: BankQuestion[] = [];
  snapshot.docs.forEach((item) => {
    const parsed = parseBankQuestion(item.id, item.data());
    if (parsed) questions.push(parsed);
  });
  return questions;
}

function buildFields(draft: QuestionDraft, meta: BankMeta) {
  const publicPart = toPublicQuestion(draft);
  const keyPart = toKeyEntry(draft);

  return {
    id: draft.id,
    type: draft.type,
    text: publicPart.text,
    points: draft.points,
    options: publicPart.options ?? null,
    answer: keyPart.answer,
    altAnswers: keyPart.altAnswers,
    rubric: keyPart.rubric,
    grade: meta.grade,
    topic: meta.topic.trim(),
  };
}

export async function createBankQuestion(draft: QuestionDraft, meta: BankMeta): Promise<string> {
  const reference = doc(collection(db, 'questionBank'));

  await setDoc(reference, {
    ...buildFields(draft, meta),
    archived: false,
    createdAt: new Date().toISOString(),
    source: 'v2',
  });

  return reference.id;
}

export async function updateBankQuestion(
  docId: string,
  draft: QuestionDraft,
  meta: BankMeta,
): Promise<void> {
  await updateDoc(doc(db, 'questionBank', docId), {
    ...buildFields(draft, meta),
    updatedAt: new Date().toISOString(),
  });
}

export async function setBankQuestionArchived(docId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(db, 'questionBank', docId), { archived });
}
