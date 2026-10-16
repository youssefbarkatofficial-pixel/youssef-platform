"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.norm = norm;
exports.keywords = keywords;
exports.similarity = similarity;
exports.chunkLesson = chunkLesson;
exports.invalidateChunksCache = invalidateChunksCache;
exports.loadLessonChunks = loadLessonChunks;
exports.findLessonContext = findLessonContext;
// ===================== تطبيع النص =====================
function norm(t) {
    if (!t)
        return '';
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
function keywords(text) {
    const words = norm(text).split(' ');
    const result = [];
    for (let i = 0; i < words.length; i++) {
        const w = words[i].trim();
        if (w.length >= 3 && !STOPWORDS.has(w)) {
            result.push(w);
        }
    }
    return result.filter((v, i, a) => a.indexOf(v) === i);
}
// ===================== تشابه كوسين =====================
function similarity(kw1, kw2) {
    if (!kw1.length || !kw2.length)
        return 0;
    const set2 = new Set(kw2);
    let matches = 0;
    for (let i = 0; i < kw1.length; i++) {
        if (set2.has(kw1[i]))
            matches++;
    }
    return matches / Math.sqrt(kw1.length * kw2.length);
}
// ===================== تقطيع الدرس لمقاطع =====================
function chunkLesson(text, maxLen = 350) {
    const sentences = text.split(/[.؟!]\s+|\n+/).filter(s => s.trim().length > 10);
    const chunks = [];
    let current = '';
    for (let i = 0; i < sentences.length; i++) {
        const s = sentences[i].trim();
        if ((current + ' ' + s).length > maxLen && current) {
            chunks.push(current.trim());
            current = s;
        }
        else {
            current = current ? current + ' ' + s : s;
        }
    }
    if (current.trim())
        chunks.push(current.trim());
    return chunks.length ? chunks : [text.trim()];
}
let isolateChunksCache = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
function invalidateChunksCache() {
    isolateChunksCache = null;
}
async function loadLessonChunks(db) {
    const now = Date.now();
    if (isolateChunksCache && isolateChunksCache.expiresAt > now) {
        return isolateChunksCache.chunks;
    }
    const { results } = await db.prepare(`SELECT lc.id, lc.lesson_id, lc.text, lc.keywords, lc.grade, lc.unit, lc.subject, lc.created_at, l.title as lesson_title 
     FROM lesson_chunks lc 
     LEFT JOIN lessons l ON lc.lesson_id = l.id 
     WHERE (l.archived IS NULL OR l.archived = 0)`).all();
    const loaded = (results || []).map((r) => {
        let kw = [];
        try {
            kw = typeof r.keywords === 'string' ? JSON.parse(r.keywords) : (r.keywords || []);
        }
        catch {
            kw = keywords(r.text || '');
        }
        return {
            id: r.id,
            lesson_id: r.lesson_id,
            lesson_title: r.lesson_title || undefined,
            text: r.text,
            keywords: kw,
            grade: r.grade,
            unit: r.unit,
            subject: r.subject,
            created_at: r.created_at
        };
    });
    isolateChunksCache = {
        chunks: loaded,
        expiresAt: now + CACHE_TTL_MS
    };
    return loaded;
}
async function findLessonContext(db, question, topK = 3, studentGrade) {
    const kw = keywords(question);
    if (!kw.length)
        return { chunks: [], lessonTitles: [], bestScore: 0 };
    const allChunks = await loadLessonChunks(db);
    if (!allChunks.length)
        return { chunks: [], lessonTitles: [], bestScore: 0 };
    const querySet = new Set(kw);
    const qLen = kw.length;
    const scored = [];
    for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        // فلترة مسبقة سريعة: إذا كان المقطع مخصصًا لصف آخر غير عام وغير صف الطالب، نتخطاه لتوفير الـ CPU
        if (studentGrade && chunk.grade && chunk.grade !== 'عام' && !chunk.grade.includes(studentGrade)) {
            continue;
        }
        const cKw = chunk.keywords;
        if (!cKw.length)
            continue;
        let matches = 0;
        for (let j = 0; j < cKw.length; j++) {
            if (querySet.has(cKw[j]))
                matches++;
        }
        if (matches > 0) {
            let s = matches / Math.sqrt(qLen * cKw.length);
            if (studentGrade && chunk.grade && chunk.grade.includes(studentGrade)) {
                s *= 1.2; // ترجيح لصف الطالب
            }
            if (s > 0.1) {
                scored.push({ score: s, text: chunk.text, id: chunk.id, lessonTitle: chunk.lesson_title });
            }
        }
    }
    scored.sort((a, b) => b.score - a.score);
    const topMatched = scored.slice(0, topK);
    const titles = Array.from(new Set(topMatched.map(m => m.lessonTitle).filter(Boolean)));
    return {
        chunks: topMatched.map(c => c.text),
        lessonTitles: titles,
        bestScore: scored.length ? scored[0].score : 0
    };
}
