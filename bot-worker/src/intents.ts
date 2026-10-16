import { norm, keywords } from './rag';
import { getSetting } from './db';

export interface IntentItem {
  core_id: string;
  intent: string;
  category: string;
  answer: string;
  variations: string[];
  variationKeywords: string[][];
}

export interface IntentMatchResult {
  intent: string;
  category: string;
  answer: string;
  score: number;
}

let isolateIntentsCache: { items: IntentItem[]; expiresAt: number } | null = null;
const INTENTS_CACHE_TTL_MS = 10 * 60 * 1000;

function calculateJaccardSimilarity(kw1: string[], kw2: string[]): number {
  if (!kw1.length || !kw2.length) return 0;
  const set1 = new Set(kw1);
  const set2 = new Set(kw2);
  let intersection = 0;
  set1.forEach(w => {
    if (set2.has(w)) intersection++;
  });
  const union = new Set([...kw1, ...kw2]).size;
  return intersection / union;
}

export async function loadIntents(db: D1Database): Promise<IntentItem[]> {
  const now = Date.now();
  if (isolateIntentsCache && isolateIntentsCache.expiresAt > now) {
    return isolateIntentsCache.items;
  }

  const { results } = await db.prepare(
    'SELECT core_id, intent, category, answer, variations FROM intents'
  ).all();

  const loaded: IntentItem[] = (results || []).map((r: any) => {
    let vars: string[] = [];
    try {
      vars = typeof r.variations === 'string' ? JSON.parse(r.variations) : (r.variations || []);
    } catch {
      vars = [];
    }
    const variationKeywords = vars.map(v => keywords(v));
    return {
      core_id: r.core_id,
      intent: r.intent,
      category: r.category,
      answer: r.answer,
      variations: vars,
      variationKeywords
    };
  });

  isolateIntentsCache = {
    items: loaded,
    expiresAt: now + INTENTS_CACHE_TTL_MS
  };

  return loaded;
}

export async function matchIntent(db: D1Database, userMessage: string): Promise<IntentMatchResult | null> {
  const normMsg = norm(userMessage);

  // 1. استثناءات الطوارئ والمواد غير المدعومة (system_override مباشر)
  // شرط صارم: يجب أن تشير الرسالة إلى "أولى ثانوي" صراحةً ولا تلتقط "أولى إعدادي"
  const isFirstSec = /(اولى\s+ثانوي|اولي\s+ثانوي|1ث|الصف\s+الاول\s+الثانوي|الصف\s+الأول\s+الثانوي)/i.test(normMsg) ||
                     /(اولى\s+ثانوي|اولي\s+ثانوي|1ث|الصف\s+الاول\s+الثانوي|الصف\s+الأول\s+الثانوي)/i.test(userMessage);
  const hasNonHistorySubject = /(فيزياء|كيمياء|احياء|رياضيات|عربي|لغة|انجليزي|فرنساوي|فلسفة)/i.test(normMsg);

  if (isFirstSec && hasNonHistorySubject) {
    const customReply = await getSetting(
      db,
      'unsupported_subject_reply',
      "حالياً المنصة بتوفر شرح 'تاريخ' بس لأولى ثانوي، لكن باقي المواد متوفرة من أولى إعدادي."
    );
    return {
      intent: 'مادة_غير_مدعومة',
      category: 'system_override',
      answer: customReply,
      score: 1.0
    };
  }

  const msgKeywords = keywords(userMessage);
  if (!msgKeywords.length) return null;

  const intents = await loadIntents(db);
  if (!intents.length) return null;

  let bestMatch: IntentItem | null = null;
  let highestScore = 0;

  for (let i = 0; i < intents.length; i++) {
    const item = intents[i];
    const variationKwList = item.variationKeywords;

    for (let j = 0; j < variationKwList.length; j++) {
      const varKeywords = variationKwList[j];
      const score = calculateJaccardSimilarity(msgKeywords, varKeywords);

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }
  }

  // إذا تجاوزت نسبة التطابق 40%
  if (highestScore >= 0.4 && bestMatch) {
    return {
      intent: bestMatch.intent,
      category: bestMatch.category,
      answer: bestMatch.answer,
      score: highestScore
    };
  }

  return null;
}
