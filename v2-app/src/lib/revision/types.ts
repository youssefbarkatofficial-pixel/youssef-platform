export type Outcome = 'correct' | 'wrong' | 'skipped';

/** حدث إجابة واحد (من امتحان أو من جلسة مراجعة). */
export interface AnswerEvent {
  questionId: string;
  /** معرّف المهارة، يُفضّل معرّف الدرس (lessonId) ليربط البوصلة بالدرس لاحقًا. */
  skillId: string;
  outcome: Outcome;
  /** وقت الإجابة بالمللي ثانية (epoch). */
  at: number;
  timeMs?: number;
  source?: 'exam' | 'practice';
}

export interface QuestionMeta {
  id: string;
  skillId: string;
}

export interface SkillMastery {
  skillId: string;
  /** تقدير الإتقان من 0 إلى 1. */
  mastery: number;
  /** الثقة في التقدير من 0 إلى 1 (تزيد بزيادة الأدلة الحديثة). */
  confidence: number;
  attempts: number;
  lastAt: number | null;
  status: 'unknown' | 'weak' | 'learning' | 'strong';
  alpha: number;
  beta: number;
}

export interface CardState {
  questionId: string;
  skillId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastAt: number;
  seen: number;
}

export type PlanReason = 'due' | 'weak' | 'new';

export interface PlanItem {
  questionId: string;
  skillId: string;
  reason: PlanReason;
}

export interface Plan {
  items: PlanItem[];
  /** إجمالي الأسئلة المستحقة الآن (وليس فقط المختارة للجلسة). */
  dueCount: number;
  weakCount: number;
  newCount: number;
}

export interface PlanOptions {
  size?: number;
  maxNew?: number;
  focusSkillIds?: string[];
}
