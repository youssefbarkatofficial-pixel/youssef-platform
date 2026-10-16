import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildAttemptResult, parseAttemptResult } from '../lib/grading';
import type { AttemptResult, Question } from '../lib/grading';
import { isIgnoredStudentId } from '../lib/studentIds';
import type { Assessment } from './assessments';

// شاشة نتائج الامتحان للأدمن: تسليمات الطلاب في examSubmissions (للامتحانات الجديدة)،
// وتحقق من كل درجة بإعادة حسابها من الإجابات المحفوظة + مفاتيح التصحيح.
// القراءة بصفحات صغيرة (startAfter) لتوفير حصة القراءات المجانية.

export interface ExamSubmissionRow {
  docId: string;
  userId: string;
  userName: string;
  attempt: number;
  submittedAtMs: number | null;
  autoSubmit: boolean;
  answers: Record<string, string>;
  result: AttemptResult | null;
}

export interface SubmissionPage {
  rows: ExamSubmissionRow[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export type VerificationStatus = 'match' | 'mismatch' | 'ungraded';

export interface VerificationOutcome {
  status: VerificationStatus;
  recomputed: AttemptResult | null;
  differences: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function timestampToMillis(value: unknown): number | null {
  if (isRecord(value) && typeof value.toMillis === 'function') {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

function parseRow(docId: string, data: DocumentData): ExamSubmissionRow {
  const answers: Record<string, string> = {};
  if (isRecord(data.answers)) {
    const source = data.answers;
    Object.keys(source).forEach((key) => {
      answers[key] = asString(source[key]);
    });
  }

  return {
    docId,
    userId: asString(data.userId),
    userName: asString(data.userName),
    attempt: typeof data.attempt === 'number' ? data.attempt : 1,
    submittedAtMs: timestampToMillis(data.submittedAt),
    autoSubmit: data.autoSubmit === true,
    answers,
    result: parseAttemptResult(data.result),
  };
}

// صفحة من تسليمات امتحان واحد. الترتيب بمعرّف المستند (بدون فهرس مركّب)،
// ونتجاهل مستندات الطلاب sync_ وsupport_000.
export async function listExamSubmissions(
  examId: string,
  pageSize: number,
  cursor: QueryDocumentSnapshot | null,
): Promise<SubmissionPage> {
  const constraints: QueryConstraint[] = [
    where('examId', '==', examId),
    orderBy(documentId()),
    limit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));

  const snapshot = await getDocs(query(collection(db, 'examSubmissions'), ...constraints));

  const rows = snapshot.docs
    .map((item) => parseRow(item.id, item.data()))
    .filter((row) => !isIgnoredStudentId(row.userId));

  return {
    rows,
    cursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

const TOLERANCE = 0.01;

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > TOLERANCE;
}

// يعيد حساب الدرجة من الإجابات المحفوظة + المفاتيح، ويقارنها بالنتيجة المخزنة.
export function verifySubmission(
  row: ExamSubmissionRow,
  assessment: Assessment,
  questions: Question[],
): VerificationOutcome {
  const stored = row.result;
  if (!stored) {
    return { status: 'ungraded', recomputed: null, differences: [] };
  }

  const recomputed = buildAttemptResult({
    courseId: assessment.courseId,
    examId: assessment.id,
    examTitle: assessment.title,
    kind: assessment.kind,
    questions,
    answers: row.answers,
    attemptNumber: row.attempt,
    autoSubmit: row.autoSubmit,
    // وقت التسليم المحفوظ من السيرفر، فيُحسب الخصم بنفس الشرط.
    submittedAt: row.submittedAtMs ?? stored.ts,
    availableUntil: assessment.availableUntil,
  });

  const differences: string[] = [];

  if (differs(stored.percent, recomputed.percent)) {
    differences.push(`النسبة: المخزنة ${stored.percent} والمحسوبة ${recomputed.percent}`);
  }
  if (differs(stored.earnedPoints, recomputed.earnedPoints)) {
    differences.push(`الدرجة: المخزنة ${stored.earnedPoints} والمحسوبة ${recomputed.earnedPoints}`);
  }
  if (differs(stored.totalPoints, recomputed.totalPoints)) {
    differences.push(`المجموع: المخزن ${stored.totalPoints} والمحسوب ${recomputed.totalPoints}`);
  }
  if (differs(stored.effectivePercent, recomputed.effectivePercent)) {
    differences.push(
      `النسبة بعد الخصم: المخزنة ${stored.effectivePercent} والمحسوبة ${recomputed.effectivePercent}`,
    );
  }
  if (stored.penalized !== recomputed.penalized) {
    differences.push(
      `خصم التأخير: المخزن ${stored.penalized ? 'نعم' : 'لا'} والمحسوب ${recomputed.penalized ? 'نعم' : 'لا'}`,
    );
  }
  if (stored.needsReview !== recomputed.needsReview) {
    differences.push('حالة المراجعة (أسئلة مقالية) غير متطابقة');
  }

  if (stored.details.length !== recomputed.details.length) {
    differences.push(
      `عدد الأسئلة: المخزن ${stored.details.length} والمحسوب ${recomputed.details.length}`,
    );
  } else {
    let shown = 0;
    for (let index = 0; index < stored.details.length && shown < 3; index += 1) {
      const storedPoints = stored.details[index].pointsEarned;
      const computedPoints = recomputed.details[index].pointsEarned;
      if (differs(storedPoints, computedPoints)) {
        differences.push(`السؤال ${index + 1}: المخزنة ${storedPoints} والمحسوبة ${computedPoints}`);
        shown += 1;
      }
    }
  }

  return {
    status: differences.length === 0 ? 'match' : 'mismatch',
    recomputed,
    differences,
  };
}
