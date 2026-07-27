// ============================================================
//  مصحح البوصلة العادل 🧭⚖️ — طبقة تحسين فوق نظام التصحيح الحالي
// ============================================================
import { normalize, keywords, similarity } from "./bousala-brain.js";

// ---------- أدوات إنصاف ----------
const AR_DIGITS = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
                    "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9" };

function cleanAnswer(t) {
  let s = normalize(String(t || ""));
  s = s.replace(/[٠-٩]/g, d => AR_DIGITS[d]);
  // شيل الحشو: "الاجابه هي أ" -> "أ"
  s = s.replace(/^(الاجابه|الاجابة|الجواب|اختار|اختيار|هي|هو|رقم)\s*/g, "").trim();
  return s;
}

// تشابه Levenshtein: يسامح الخطأ الإملائي البسيط
function editSim(a, b) {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const d = Array.from({length: m+1}, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1,
                         d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

// كشف النفي: جملة فيها نفي قبل المفهوم = معنى معكوس
const NEGATIONS = ["لم","لن","لا","ليس","ليست","مش","ما كانش","غير صحيح","خطا"];
function isNegated(text, concept) {
  const t = normalize(text);
  const idx = t.indexOf(normalize(concept));
  if (idx < 0) return false;
  const before = t.slice(Math.max(0, idx - 25), idx);
  return NEGATIONS.some(n => before.includes(normalize(n)));
}

// ============================================================
//  1) التصحيح الموضوعي المحسّن (اختياري / صح وخطأ / أكمل)
// ============================================================
export function gradeObjective(studentAns, correctAns, opts = {}) {
  const s = cleanAnswer(studentAns), c = cleanAnswer(correctAns);
  const accepted = [c, ...(opts.altAnswers || []).map(cleanAnswer)];

  for (const acc of accepted) {
    if (s === acc) return { score: 1, why: "إجابة صحيحة" };
    // حرف الاختيار: أ = ا = a = 1 حسب ترتيب الاختيارات
    if (opts.choices) {
      const letters = ["ا","ب","ج","د","ه"];
      const iS = letters.indexOf(s), iC = letters.indexOf(acc);
      const nS = parseInt(s) - 1;
      if (iC >= 0 && (iS === iC || nS === iC))
        return { score: 1, why: "إجابة صحيحة (بصيغة مختلفة)" };
      // كتب نص الاختيار نفسه بدل حرفه
      if (iC >= 0 && opts.choices[iC] &&
          editSim(s, cleanAnswer(opts.choices[iC])) >= 0.85)
        return { score: 1, why: "كتب نص الاختيار الصحيح" };
    }
    // أكمل/صح وخطأ: تسامح إملائي 85%
    if (editSim(s, acc) >= 0.85)
      return { score: 1, why: "صحيحة مع خطأ إملائي بسيط (مقبول)" };
  }
  return { score: 0, why: `الإجابة الصحيحة: ${correctAns}` };
}

// ============================================================
//  2) التصحيح المقالي بالمفاهيم + درجات جزئية
//  rubric = [{ concept:"توحيد القطرين", synonyms:["وحد مصر","القطرين"],
//              weight: 2 }, ...]
// ============================================================
export function gradeEssay(studentAns, rubric, maxScore) {
  const text = String(studentAns || "");
  if (cleanAnswer(text).length < 2)
    return { score: 0, confidence: 1, feedback: ["إجابة فارغة"], needsAI: false };

  const totalWeight = rubric.reduce((s, r) => s + (r.weight || 1), 0);
  let earned = 0, hits = 0;
  const feedback = [];

  for (const r of rubric) {
    const forms = [r.concept, ...(r.synonyms || [])];
    let found = false, negated = false;
    for (const f of forms) {
      const fn = normalize(f);
      const tn = normalize(text);
      const present = tn.includes(fn) ||
        similarity(keywords(f), keywords(text)) >= 0.55 ||
        // تسامح إملائي على مستوى الكلمات
        tn.split(" ").some(w => fn.split(" ").length === 1 &&
                                editSim(w, fn) >= 0.85);
      if (present) {
        found = true;
        if (isNegated(text, f)) negated = true;
        break;
      }
    }
    if (found && !negated) {
      earned += (r.weight || 1); hits++;
      feedback.push(`✅ ذكر: ${r.concept}`);
    } else if (negated) {
      feedback.push(`⚠️ نفى معلومة صحيحة: ${r.concept}`);
    } else {
      feedback.push(`➖ لم يذكر: ${r.concept}`);
    }
  }

  const ratio = earned / totalWeight;
  const score = Math.round(ratio * maxScore * 2) / 2;   // أنصاف درجات

  // الثقة: عالية في الطرفين، منخفضة في المنتصف الرمادي
  const confidence = ratio >= 0.8 || ratio <= 0.15
    ? 0.9 : 1 - Math.abs(0.5 - ratio);

  return { score, confidence, feedback,
           needsAI: confidence < 0.65 };   // المنطقة الرمادية → تصعيد
}

// ============================================================
//  3) التصعيد العادل: المفتاح يحكم في الحالات الرمادية فقط
// ============================================================
export async function gradeEssayFair(studentAns, rubric, maxScore,
                                     modelAnswer, callAI) {
  const local = gradeEssay(studentAns, rubric, maxScore);
  if (!local.needsAI || !callAI)
    return { ...local, method: "آلي", needsReview: local.needsAI && !callAI };

  try {
    const prompt =
`أنت مصحح امتحانات دراسات اجتماعية عادل، ناصف، وحازم. صحح إجابة الطالب.
قواعد إلزامية:
- الدرجة من ${maxScore} ويجوز أنصاف الدرجات.
- قيّم الفهم والمعنى ولا تشترط الحفظ الحرفي، اقبل المرادفات.
- لا توزع درجات مجانية: إذا كانت الإجابة تحتوي على كلمات صحيحة لكن في سياق خاطئ أو عشوائي، فالدرجة صفر.
- لا تحاسب على الأخطاء الإملائية إلا إذا غيّرت المعنى تماماً.
- المعلومة المنفية أو المعكوسة تُعتبر خاطئة.
- أعد JSON فقط بهذا التنسيق: {"score": رقم, "reason": "سبب من سطرين بالعربية يشرح لماذا استحق هذه الدرجة بدقة"}

الإجابة النموذجية (للقياس عليها): ${modelAnswer}
العناصر الأساسية المطلوبة: ${rubric.map(r => r.concept).join("، ")}
إجابة الطالب: ${studentAns}`;

    const raw = await callAI(prompt);
    const ai = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    const finalScore = Math.min(maxScore, Math.max(0, Number(ai.score)));
    
    return { score: finalScore, method: "ذكاء اصطناعي",
             feedback: [...local.feedback, `🤖 (رأي الذكاء الاصطناعي): ${ai.reason}`],
             needsReview: false };
  } catch {
    // فشل المفتاح؟ عمر الطالب ما يتظلم: تتعلّم للمراجعة اليدوية
    return { ...local, method: "آلي", needsReview: true };
  }
}
