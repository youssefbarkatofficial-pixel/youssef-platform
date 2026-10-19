import type { AnswerEvent } from './types.ts';

export interface ProgressStore {
  load(): Promise<AnswerEvent[]>;
  /** يرفض الوعد بخطأ صريح لو تعذّر الحفظ (لا فشل صامت). */
  append(events: AnswerEvent[]): Promise<void>;
}

const MAX_EVENTS = 5000;

const keyOf = (e: AnswerEvent) => `${e.source ?? ''}|${e.questionId}|${e.at}`;

function isEvent(x: unknown): x is AnswerEvent {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.questionId === 'string' &&
    typeof e.skillId === 'string' &&
    typeof e.at === 'number' &&
    Number.isFinite(e.at) &&
    (e.outcome === 'correct' || e.outcome === 'wrong' || e.outcome === 'skipped')
  );
}

export function mergeEvents(...lists: AnswerEvent[][]): AnswerEvent[] {
  const seen = new Map<string, AnswerEvent>();
  for (const list of lists) for (const e of list) if (!seen.has(keyOf(e))) seen.set(keyOf(e), e);
  return [...seen.values()].sort((a, b) => a.at - b.at);
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** تخزين محلي على جهاز الطالب (بدون أي كتابة على Firestore). */
export function createLocalStore(studentId: string, storage?: StorageLike): ProgressStore {
  const key = `rev:v1:${studentId}`;
  const st: StorageLike | undefined =
    storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);

  const read = (): AnswerEvent[] => {
    try {
      const raw = st?.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isEvent) : [];
    } catch {
      return [];
    }
  };

  return {
    async load() {
      return read();
    },
    async append(events) {
      if (!st) throw new Error('التخزين المحلي غير متاح على هذا الجهاز.');
      const merged = mergeEvents(read(), events.filter(isEvent)).slice(-MAX_EVENTS);
      try {
        st.setItem(key, JSON.stringify(merged));
      } catch {
        throw new Error('تعذّر حفظ التقدّم على هذا الجهاز.');
      }
    },
  };
}
