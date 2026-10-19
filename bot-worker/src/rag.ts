import { LessonChunk } from './types';

// ===================== تطبيع النص =====================
export function norm(t: string): string {
  if (!t) return '';
  return t
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ===================== استخراج كلمات مفتاحية =====================
const STOPWORDS = new Set([
  'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان',
  'كانت', 'هو', 'هي', 'هم', 'هن', 'انا', 'نحن', 'انت', 'انتم', 'لا', 'ما', 'لم', 'لن',
  'قد', 'اي', 'كل', 'جميع', 'بعض', 'غير', 'اكثر', 'اقل', 'مثل', 'حتى', 'لكن', 'بين',
  'ان', 'او', 'اذا', 'عند', 'بعد', 'قبل', 'خلال', 'حول', 'عبر', 'منذ', 'لدى'
]);

export function keywords(text: string): string[] {
  const words = norm(text).split(' ');
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i].trim();
    if (w.length >= 3 && !STOPWORDS.has(w)) {
      result.push(w);
    }
  }
  return result.filter((v, i, a) => a.indexOf(v) === i);
}

// ===================== تشابه كوسين =====================
export function similarity(kw1: string[], kw2: string[]): number {
  if (!kw1.length || !kw2.length) return 0;
  const set2 = new Set(kw2);
  let matches = 0;
  for (let i = 0; i < kw1.length; i++) {
    if (set2.has(kw1[i])) matches++;
  }
  return matches / Math.sqrt(kw1.length * kw2.length);
}

// ===================== تقطيع الدرس لمقاطع =====================
export function chunkLesson(text: string, maxLen = 350): string[] {
  const sentences = text.split(/[.؟!]\s+|\n+/).filter(s => s.trim().length > 10);
  const chunks: string[] = [];
  let current = '';

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].trim();
    if ((current + ' ' + s).length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = current ? current + ' ' + s : s;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.trim()];
}

// ===================== ذاكرة الـ Isolate مع TTL =====================
interface ChunksCache {
  chunks: LessonChunk[];
  expiresAt: number;
}

let isolateChunksCache: ChunksCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق

export function invalidateChunksCache(): void {
  isolateChunksCache = null;
}

export async function loadLessonChunks(db: D1Database): Promise<LessonChunk[]> {
  const now = Date.now();
  if (isolateChunksCache && isolateChunksCache.expiresAt > now) {
    return isolateChunksCache.chunks;
  }

  const { results } = await db.prepare(
    `SELECT lc.id, lc.course_id, lc.lesson_id, lc.stage, lc.kind, lc.status, lc.text, lc.keywords, lc.grade, lc.unit, lc.subject, lc.source_note, lc.created_at, lc.updated_at, l.title as lesson_title 
     FROM lesson_chunks lc 
     LEFT JOIN lessons l ON lc.lesson_id = l.id 
     WHERE (l.archived IS NULL OR l.archived = 0)`
  ).all();

  const loaded: LessonChunk[] = (results || []).map((r: any) => {
    let kw: string[] = [];
    try {
      kw = typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []);
    } catch {
      kw = keywords(r.text || '');
    }
    const createdAt = Number(r.created_at) || now;
    const updatedAt = Number(r.updated_at) || createdAt;
    return {
      id: r.id,
      course_id: r.course_id || undefined,
      courseId: r.course_id || undefined,
      lesson_id: r.lesson_id,
      lessonId: r.lesson_id,
      stage: r.stage || undefined,
      kind: r.kind || 'شرح',
      status: r.status || 'verified',
      lesson_title: r.lesson_title || undefined,
      text: r.text,
      keywords: kw,
      grade: r.grade,
      unit: r.unit,
      subject: r.subject,
      source_note: r.source_note || undefined,
      sourceNote: r.source_note || undefined,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt
    };
  });

  isolateChunksCache = {
    chunks: loaded,
    expiresAt: now + CACHE_TTL_MS
  };

  return loaded;
}

// ===================== تطبيع ومطابقة الصفوف الدراسية =====================
export function normalizeGrade(grade?: string | null): string {
  if (!grade) return '';
  const g = norm(grade).replace(/^الصف\s+/, '').trim();
  if (g.includes('prep1') || g.includes('اول اعدادي') || g.includes('اولى اعدادي') || g.includes('اول الاعدادي')) return 'prep1';
  if (g.includes('prep2') || g.includes('ثاني اعدادي') || g.includes('تانية اعدادي') || g.includes('ثاني الاعدادي')) return 'prep2';
  if (g.includes('prep3') || g.includes('ثالث اعدادي') || g.includes('تالتة اعدادي') || g.includes('ثالث الاعدادي')) return 'prep3';
  if (g.includes('sec1') || g.includes('اول ثانوي') || g.includes('اولى ثانوي') || g.includes('اول الثانوي')) return 'sec1';
  if (g.includes('sec2') || g.includes('ثاني ثانوي') || g.includes('تانية ثانوي') || g.includes('ثاني الثانوي')) return 'sec2';
  if (g.includes('sec3') || g.includes('ثالث ثانوي') || g.includes('تالتة ثانوي') || g.includes('ثالث الثانوي')) return 'sec3';
  return g;
}

export function gradesMatch(g1?: string | null, g2?: string | null): boolean {
  if (!g1 || !g2) return true;
  if (g1 === 'عام' || g2 === 'عام') return true;
  const n1 = normalizeGrade(g1);
  const n2 = normalizeGrade(g2);
  if (!n1 || !n2) return true;
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

export async function findLessonContext(
  db: D1Database,
  question: string,
  topK = 3,
  studentGrade?: string
): Promise<{ chunks: string[]; lessonTitles: string[]; bestScore: number }> {
  const kw = keywords(question);
  if (!kw.length) return { chunks: [], lessonTitles: [], bestScore: 0 };

  const allChunks = await loadLessonChunks(db);
  if (!allChunks.length) return { chunks: [], lessonTitles: [], bestScore: 0 };

  const querySet = new Set(kw);
  const qLen = kw.length;
  const scored: { score: number; text: string; id: string; lessonTitle?: string }[] = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    
    // فلترة مسبقة سريعة: مطابقة صف الطالب مع صف المقطع
    if (studentGrade && chunk.grade && !gradesMatch(studentGrade, chunk.grade)) {
      continue;
    }

    const cKw = chunk.keywords;
    if (!cKw.length) continue;

    let matches = 0;
    for (let j = 0; j < cKw.length; j++) {
      if (querySet.has(cKw[j])) matches++;
    }

    if (matches > 0) {
      let s = matches / Math.sqrt(qLen * cKw.length);
      if (studentGrade && chunk.grade && gradesMatch(studentGrade, chunk.grade)) {
        s *= 1.2; // ترجيح لصف الطالب
      }
      if (s > 0.1) {
        scored.push({ score: s, text: chunk.text, id: chunk.id, lessonTitle: chunk.lesson_title });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const topMatched = scored.slice(0, topK);
  const titles = Array.from(new Set(topMatched.map(m => m.lessonTitle).filter(Boolean))) as string[];

  return {
    chunks: topMatched.map(c => c.text),
    lessonTitles: titles,
    bestScore: scored.length ? scored[0].score : 0
  };
}
