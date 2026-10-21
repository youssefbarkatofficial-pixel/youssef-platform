import type { QuestionDraft } from './questionDraft.ts';
import type { QuestionType } from './grading.ts';
import { newQuestionId, isEssayType } from './questionDraft.ts';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

const ARABIC_LETTERS: Record<string, number> = {
  'أ': 0, 'ا': 0, 'إ': 0, 'آ': 0,
  'ب': 1,
  'ج': 2,
  'د': 3,
  'هـ': 4, 'ه': 4,
  'و': 5,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5,
  'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5,
};

const LEGACY_ARABIC_MAP: Record<string, string> = {
  'أ': 'a', 'ا': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd', 'هـ': 'e', 'ه': 'e',
  'A': 'a', 'B': 'b', 'C': 'c', 'D': 'd', 'E': 'e',
  '1': 'a', '2': 'b', '3': 'c', '4': 'd',
};

const SECTION_KEYWORDS = [
  { regex: /اختر/i, type: 'choose' },
  { regex: /صح\s*\/\s*خطأ|صح\s*أو\s*خطأ|ضع علامة/i, type: 'truefalse' },
  { regex: /أكمل/i, type: 'fill' },
  { regex: /صوب/i, type: 'correct' },
  { regex: /اكتب ما تشير/i, type: 'term' },
  { regex: /من هو/i, type: 'who' },
  { regex: /بم تفسر/i, type: 'explain' },
  { regex: /النتائج/i, type: 'results' },
  { regex: /دلل/i, type: 'prove' },
  { regex: /قارن/i, type: 'compare' },
  { regex: /الشبه والاختلاف|أوجه الشبه/i, type: 'similarities' },
  { regex: /العلاقة/i, type: 'relation' },
  { regex: /ماذا يحدث/i, type: 'whatif' },
  { regex: /المقصود/i, type: 'define' },
  { regex: /رأيك/i, type: 'opinion' },
];

export interface ParsedQuestion {
  number: number;
  origType: string;
  stem: string;
  points: number | null;
  type: 'choose' | 'truefalse' | 'text';
  options?: string[];
  correctIndex?: number | null;
  convertedToChoose?: boolean;
  correct?: boolean;
  answerText?: string;
  needsAnswer?: boolean;
  segments?: string[];
}

export interface ParsedSection {
  header: string;
  type: string;
  declaredCount: number;
  questions: ParsedQuestion[];
}

export interface ParsedExam {
  title: string;
  sections: ParsedSection[];
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  questions: QuestionDraft[];
  warnings: string[];
  errors?: string[];
  parsedExam?: ParsedExam;
}

export function normalizeForMatching(s: string): string {
  if (!s) return '';
  return s
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\.\,\(\)\-\–\—\:]+/g, '')
    .toLowerCase();
}

export function normalizeDigits(text: string): string {
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = text;
  for (let i = 0; i < 10; i++) {
    res = res.split(easternDigits[i]).join(String(i));
  }
  return res;
}

/**
 * المحلل الشامل للامتحانات بحسب مواصفات Antigravity v44
 */
export function parseExamText(rawText: string): ParsedExam {
  let text = rawText.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D]/g, '');
  text = normalizeDigits(text);

  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const warnings: string[] = [];
  const errors: string[] = [];

  let title = '';
  const sections: ParsedSection[] = [];

  const headerRegex = /^(.+?):\s*(.+?)\s*\((\d+)\s*(?:سؤال|أسئلة)[^)]*\)\s*:?\s*$/;
  const qStartRegex = /^(\d+)\s*[.\-)]\s*(.*)$/;
  const ansRegex = /^(?:الإجابة|الاجابة|إجابة|اجابة|الجواب|الحل)\s*[:\-]\s*(.*)$/i;
  const pointsRegex = /^(?:الدرجة|الدرجه)\s*[:\-]\s*(\d+)\s*$/i;
  const pointsParenRegex = /^\((\d+)\s*(?:درجة|درجات|درجه)\)\s*$/i;
  const formatBOptRegex = /^([أ-يA-Za-z])\s*[\)\.\-]\s*(.*)$/;

  let currentSection: ParsedSection | null = null;
  let currentQuestion: {
    number: number;
    stem: string;
    points?: number;
    options: string[] | null;
    correctIndex?: number;
    rawAnswer: string | null;
  } | null = null;

  function finishCurrentQuestion() {
    if (!currentQuestion || !currentSection) return;

    const q = currentQuestion;
    const origType = currentSection.type;
    const isChooseSection = origType === 'choose';
    const isTrueFalseSection = origType === 'truefalse';

    const hasOptions = q.options && q.options.length >= 2;
    let finalType: 'choose' | 'truefalse' | 'text' = 'text';

    if (isTrueFalseSection) {
      finalType = 'truefalse';
    } else if (isChooseSection || hasOptions) {
      finalType = 'choose';
    }

    const questionObj: ParsedQuestion = {
      number: q.number,
      origType,
      stem: q.stem.trim(),
      points: q.points !== undefined ? q.points : null,
      type: finalType,
    };

    if (!questionObj.stem) {
      errors.push(`القسم "${currentSection.header}"، سؤال ${q.number}: نص السؤال فارغ.`);
    }

    if (finalType === 'choose') {
      questionObj.options = q.options || [];
      questionObj.correctIndex = q.correctIndex !== undefined ? q.correctIndex : null;
      questionObj.convertedToChoose = !isChooseSection;

      if (questionObj.options.length < 2) {
        errors.push(`القسم "${currentSection.header}"، سؤال ${q.number}: اختيار من متعدد يتطلب خيارين على الأقل.`);
      }

      // فحص الخيارات المتطابقة
      const seen = new Set<string>();
      for (const opt of questionObj.options) {
        const norm = normalizeForMatching(opt);
        if (seen.has(norm)) {
          errors.push(`القسم "${currentSection.header}"، سؤال ${q.number}: يوجد خياران متطابقان ("${opt}").`);
          break;
        }
        seen.add(norm);
      }

      // تحديد الإجابة إن لم تكن محددة مسبقًا
      if (questionObj.correctIndex === null && q.rawAnswer) {
        const rawAns = q.rawAnswer.trim();
        if (rawAns in ARABIC_LETTERS) {
          const idx = ARABIC_LETTERS[rawAns];
          if (idx >= 0 && idx < questionObj.options.length) {
            questionObj.correctIndex = idx;
          } else {
            errors.push(
              `سؤال ${q.number} في قسم "${currentSection.header}": حرف الإجابة (${rawAns}) خارج نطاق الخيارات.`,
            );
          }
        } else {
          const normAns = normalizeForMatching(rawAns);
          const foundIdx = questionObj.options.findIndex((opt) => normalizeForMatching(opt) === normAns);
          if (foundIdx !== -1) {
            questionObj.correctIndex = foundIdx;
          } else {
            errors.push(
              `سؤال ${q.number} في قسم "${currentSection.header}": الإجابة "${rawAns}" غير موجودة بين الخيارات.`,
            );
          }
        }
      }

      if (questionObj.correctIndex === null) {
        questionObj.needsAnswer = true;
      }
    } else if (finalType === 'truefalse') {
      if (q.rawAnswer) {
        const normAns = normalizeForMatching(q.rawAnswer);
        if (/^(صح|صواب|نعم|true|✓|✔)$/i.test(q.rawAnswer.trim()) || normAns === 'صح' || normAns === 'صواب') {
          questionObj.correct = true;
        } else if (/^(خطأ|خطا|غلط|لا|false|✗|✖|✕)$/i.test(q.rawAnswer.trim()) || normAns === 'خطا' || normAns === 'غلط') {
          questionObj.correct = false;
        } else {
          errors.push(`سؤال ${q.number} في قسم "${currentSection.header}": إجابة صح/خطأ غير صالحة: "${q.rawAnswer}".`);
        }
      } else {
        questionObj.needsAnswer = true;
      }
    } else {
      // نصي
      if (q.rawAnswer) {
        questionObj.answerText = q.rawAnswer.trim();
      } else {
        questionObj.needsAnswer = true;
      }
    }

    currentSection.questions.push(questionObj);
    currentQuestion = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // عنوان الامتحان (السطر الأول قبل أي قسم)
    if (!currentSection && !title && !line.startsWith('إعداد:')) {
      const match = line.match(headerRegex);
      if (!match) {
        title = line;
        continue;
      }
    }

    // سطر رأس القسم
    const headerMatch = line.match(headerRegex);
    if (headerMatch && !/^\d+\s*[.\-)]/.test(line)) {
      finishCurrentQuestion();

      let detectedType = 'unknown';
      for (const kw of SECTION_KEYWORDS) {
        if (kw.regex.test(line)) {
          detectedType = kw.type;
          break;
        }
      }
      if (detectedType === 'unknown') {
        warnings.push(`عنوان قسم غير معروف في السطر ${i + 1}: "${line}".`);
      }

      currentSection = {
        header: line,
        type: detectedType,
        declaredCount: parseInt(headerMatch[3], 10),
        questions: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) continue;

    // بداية سؤال جديد
    const qStart = line.match(qStartRegex);
    if (qStart) {
      finishCurrentQuestion();
      currentQuestion = {
        number: parseInt(qStart[1], 10),
        stem: qStart[2] || '',
        points: undefined,
        options: null,
        correctIndex: undefined,
        rawAnswer: null,
      };
      continue;
    }

    if (!currentQuestion) continue;

    // سطر الدرجة
    const pMatch = line.match(pointsRegex) || line.match(pointsParenRegex);
    if (pMatch) {
      currentQuestion.points = parseInt(pMatch[1], 10);
      continue;
    }

    // سطر الإجابة
    const aMatch = line.match(ansRegex);
    if (aMatch) {
      currentQuestion.rawAnswer = aMatch[1].trim();
      continue;
    }

    // خيارات الصيغة أ: (خيار1 - خيار2 - خيار3 - خيار4)
    if (line.startsWith('(') && line.endsWith(')') && /[-–—]/.test(line)) {
      const inner = line.slice(1, -1).trim();
      const parts = inner.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        currentQuestion.options = parts.map((part, idx) => {
          if (part.startsWith('*')) {
            if (currentQuestion) currentQuestion.correctIndex = idx;
            return part.slice(1).trim();
          }
          return part;
        });
        continue;
      }
    }

    // خيارات الصيغة ب: أ) ... أو ب. ...
    const bMatch = line.match(formatBOptRegex);
    if (bMatch) {
      const optText = bMatch[2].trim();
      if (!currentQuestion.options) currentQuestion.options = [];
      currentQuestion.options.push(optText);
      continue;
    }

    // استكمال نص السؤال
    if (currentQuestion.stem) {
      currentQuestion.stem += ' ' + line;
    } else {
      currentQuestion.stem = line;
    }
  }

  finishCurrentQuestion();

  // التحقق من مطابقة عدد الأسئلة المقسمة للعدد المعلن
  for (const s of sections) {
    if (s.declaredCount !== s.questions.length) {
      warnings.push(
        `القسم "${s.header}": عدد الأسئلة المقسّمة (${s.questions.length}) لا يطابق العدد المعلن في العنوان (${s.declaredCount}).`,
      );
    }
  }

  return { title, sections, warnings, errors };
}

function mapOrigTypeToDraftType(origType: string): QuestionType {
  switch (origType) {
    case 'fill':
      return 'fill';
    case 'explain':
      return 'explain';
    case 'results':
      return 'result';
    case 'prove':
      return 'prove';
    case 'relation':
      return 'relation';
    case 'whatif':
      return 'whatif';
    case 'define':
      return 'meaning';
    case 'correct':
    case 'term':
    case 'who':
    case 'compare':
    case 'similarities':
    case 'opinion':
    default:
      return 'short';
  }
}

/**
 * تحويل نتيجة ParsedExam إلى مصفوفة QuestionDraft الخاصة بلوحة إدارة التقييمات
 */
export function parsedExamToQuestionDrafts(parsed: ParsedExam): QuestionDraft[] {
  const drafts: QuestionDraft[] = [];

  for (const section of parsed.sections) {
    for (const q of section.questions) {
      let draftType: QuestionType = 'choose';

      if (q.type === 'choose') {
        draftType = 'choose';
      } else if (q.type === 'truefalse') {
        draftType = 'tf';
      } else {
        draftType = mapOrigTypeToDraftType(q.origType);
      }

      const defaultPts =
        q.points !== null && q.points !== undefined && q.points > 0
          ? q.points
          : isEssayType(draftType)
            ? 2
            : 1;

      const draft: QuestionDraft = {
        id: newQuestionId(),
        type: draftType,
        text: q.stem,
        points: defaultPts,
        options: null,
        answer: '',
        altAnswers: [],
        rubric: [],
        needsReview: q.needsAnswer === true,
      };

      if (q.type === 'choose') {
        const optsMap: Record<string, string> = {};
        (q.options || []).forEach((opt, idx) => {
          if (idx < OPTION_KEYS.length) {
            optsMap[OPTION_KEYS[idx]] = opt;
          }
        });
        draft.options = optsMap;
        if (
          q.correctIndex !== null &&
          q.correctIndex !== undefined &&
          q.correctIndex >= 0 &&
          q.correctIndex < (q.options?.length || 0) &&
          q.correctIndex < OPTION_KEYS.length
        ) {
          draft.answer = OPTION_KEYS[q.correctIndex];
        } else {
          draft.answer = '';
          draft.needsReview = true;
        }
      } else if (q.type === 'truefalse') {
        draft.options = null;
        if (q.correct === true) {
          draft.answer = 'صح';
        } else if (q.correct === false) {
          draft.answer = 'خطأ';
        } else {
          draft.answer = '';
          draft.needsReview = true;
        }
      } else {
        draft.options = null;
        draft.answer = q.answerText || '';
        if (!draft.answer) {
          draft.needsReview = true;
        }
      }

      drafts.push(draft);
    }
  }

  return drafts;
}

/**
 * تحليل ملف JSON سواء كان بنسق ParsedExam أو بنسق legacy
 */
export function parseExamFromJson(jsonStr: string): ParsedExam {
  try {
    const data = JSON.parse(jsonStr);
    if (data && typeof data === 'object' && Array.isArray(data.sections)) {
      const warnings: string[] = Array.isArray(data.warnings) ? [...data.warnings] : [];
      const errors: string[] = Array.isArray(data.errors) ? [...data.errors] : [];
      const title = typeof data.title === 'string' ? data.title : '';
      const sections: ParsedSection[] = [];

      for (const s of data.sections) {
        if (!s || typeof s !== 'object') continue;
        const sHeader = String(s.header || '');
        const sType = String(s.type || 'unknown');
        const sDeclared = Number(s.declaredCount) || 0;
        const questions: ParsedQuestion[] = [];

        if (Array.isArray(s.questions)) {
          for (const q of s.questions) {
            if (!q || typeof q !== 'object') continue;
            const qObj: ParsedQuestion = {
              number: Number(q.number) || questions.length + 1,
              origType: String(q.origType || sType),
              stem: String(q.stem || '').trim(),
              points: q.points !== undefined && q.points !== null ? Number(q.points) : null,
              type: q.type === 'choose' ? 'choose' : q.type === 'truefalse' ? 'truefalse' : 'text',
            };
            if (qObj.type === 'choose') {
              qObj.options = Array.isArray(q.options) ? q.options.map(String) : [];
              qObj.correctIndex =
                q.correctIndex !== undefined && q.correctIndex !== null ? Number(q.correctIndex) : null;
              qObj.convertedToChoose =
                q.convertedToChoose === true || (q.convertedToChoose !== false && qObj.origType !== 'choose');
              if (qObj.correctIndex === null) qObj.needsAnswer = true;
            } else if (qObj.type === 'truefalse') {
              if (typeof q.correct === 'boolean') {
                qObj.correct = q.correct;
              } else {
                qObj.needsAnswer = true;
              }
            } else {
              if (typeof q.answerText === 'string' && q.answerText.trim() !== '') {
                qObj.answerText = q.answerText.trim();
              } else {
                qObj.needsAnswer = true;
              }
            }
            if (q.needsAnswer === true) {
              qObj.needsAnswer = true;
            }
            questions.push(qObj);
          }
        }

        sections.push({
          header: sHeader,
          type: sType,
          declaredCount: sDeclared,
          questions,
        });
      }

      return { title, sections, warnings, errors };
    }
  } catch (err: any) {
    return {
      title: '',
      sections: [],
      warnings: [],
      errors: [`فشل فك شفرة JSON: ${err.message}`],
    };
  }

  return {
    title: '',
    sections: [],
    warnings: [],
    errors: ['الملف لا يطابق مخطط ParsedExam.'],
  };
}

/**
 * استخراج الأسئلة من ملف Word docx
 */
export async function parseExamFromDocx(input: ArrayBuffer | Blob | File): Promise<ParsedExam> {
  const buffer = input instanceof ArrayBuffer ? input : await (input as Blob).arrayBuffer();
  let text = '';
  try {
    const mammoth = await import('mammoth');
    const extractFn = (mammoth as any).extractRawText || (mammoth as any).default?.extractRawText;
    if (extractFn) {
      const res = await extractFn({ arrayBuffer: buffer });
      text = res.value;
    }
  } catch {
    // fallback to internal zip extractor
  }
  if (!text) {
    text = await extractTextFromDocx(buffer);
  }
  return parseExamText(text);
}

/**
 * 1. استيراد الأسئلة من ملف JSON (متوافق مع نسق ParsedExam أو نسق MCQ القديم)
 */
export function parseQuestionsFromJson(jsonStr: string): ImportResult {
  try {
    const raw = JSON.parse(jsonStr);
    if (raw && typeof raw === 'object' && Array.isArray(raw.sections)) {
      const parsed = parseExamFromJson(jsonStr);
      return {
        questions: parsedExamToQuestionDrafts(parsed),
        warnings: parsed.warnings,
        errors: parsed.errors,
        parsedExam: parsed,
      };
    }
  } catch {
    // Continue to legacy fallback
  }

  const warnings: string[] = [];
  const questions: QuestionDraft[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(jsonStr);
  } catch (err: any) {
    return { questions: [], warnings: [`تعذر قراءة ملف JSON: ${err.message}`] };
  }

  const items = Array.isArray(raw) ? raw : (raw as any)?.questions || [];
  if (!Array.isArray(items) || items.length === 0) {
    return { questions: [], warnings: ['الملف لا يحتوي على مصفوفة أسئلة صالحة.'] };
  }

  items.forEach((item: any, idx: number) => {
    const qNum = idx + 1;
    const text = String(item.question || item.text || item.title || '').trim();
    if (!text) {
      warnings.push(`السؤال رقم ${qNum} بلا نص، تم تخطيه.`);
      return;
    }

    const cleanText = text.replace(/^[0-9١-٩]+[\s\.\-\:\)]\s*/, '').trim();

    const rawChoices = item.choices || item.options;
    if (rawChoices && typeof rawChoices === 'object') {
      const optionsMap: Record<string, string> = {};
      let correctKey = 'a';

      if (Array.isArray(rawChoices)) {
        rawChoices.forEach((ch, cIdx) => {
          if (cIdx < OPTION_KEYS.length) {
            optionsMap[OPTION_KEYS[cIdx]] = String(ch).trim();
          }
        });
      } else {
        Object.entries(rawChoices).forEach(([k, v]) => {
          const mappedKey = LEGACY_ARABIC_MAP[k.trim()] || k.toLowerCase().trim();
          optionsMap[mappedKey] = String(v).trim();
        });
      }

      const rawAns = String(item.answer_letter || item.answer || item.correct || '').trim();
      if (rawAns) {
        correctKey = LEGACY_ARABIC_MAP[rawAns] || rawAns.toLowerCase();
      } else if (item.answer_text) {
        const targetText = String(item.answer_text).trim();
        const found = Object.entries(optionsMap).find(
          ([_, val]) => val.replace(/[\s\.\,]/g, '') === targetText.replace(/[\s\.\,]/g, ''),
        );
        if (found) correctKey = found[0];
      }

      questions.push({
        id: newQuestionId(),
        type: 'choose',
        text: cleanText || text,
        points: Number(item.score || item.points) || 1,
        options: optionsMap,
        answer: correctKey,
        altAnswers: [],
        rubric: [],
        needsReview: !correctKey,
      });
    } else if (item.type === 'tf' || /^(صح|خطأ|صواب|true|false)$/i.test(String(item.answer || ''))) {
      const ans = String(item.answer || '').trim();
      const normAns = /^(صح|صواب|true|1)$/i.test(ans) ? 'صح' : 'خطأ';
      questions.push({
        id: newQuestionId(),
        type: 'tf',
        text: cleanText || text,
        points: Number(item.score || item.points) || 1,
        options: null,
        answer: normAns,
        altAnswers: [],
        rubric: [],
      });
    } else {
      questions.push({
        id: newQuestionId(),
        type: 'short',
        text: cleanText || text,
        points: Number(item.score || item.points) || 2,
        options: null,
        answer: String(item.answer || item.answer_text || '').trim(),
        altAnswers: [],
        rubric: [],
        needsReview: !item.answer && !item.answer_text,
      });
    }
  });

  return { questions, warnings };
}

/**
 * 2. استيراد الأسئلة من نص منظم (TXT أو مستخرج من Word/PDF)
 */
export function parseQuestionsFromTxt(text: string): ImportResult {
  // إذا كان النص يحتوي على أقسام منسقة بالنمط الجديد
  const headerRegex = /^(.+?):\s*(.+?)\s*\((\d+)\s*(?:سؤال|أسئلة)[^)]*\)\s*:?\s*$/m;
  if (headerRegex.test(text)) {
    const parsed = parseExamText(text);
    return {
      questions: parsedExamToQuestionDrafts(parsed),
      warnings: parsed.warnings,
      errors: parsed.errors,
      parsedExam: parsed,
    };
  }

  // التوافق القديم للنصوص البسيطة بدون أقسام
  const warnings: string[] = [];
  const questions: QuestionDraft[] = [];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let currentQ: {
    text: string;
    options: Record<string, string>;
    answer?: string;
    type?: 'choose' | 'tf' | 'short';
  } | null = null;

  const flush = () => {
    if (!currentQ || !currentQ.text) return;

    const optCount = Object.keys(currentQ.options).length;
    if (optCount >= 2) {
      questions.push({
        id: newQuestionId(),
        type: 'choose',
        text: currentQ.text,
        points: 1,
        options: currentQ.options,
        answer: currentQ.answer || 'a',
        altAnswers: [],
        rubric: [],
        needsReview: !currentQ.answer,
      });
    } else if (currentQ.type === 'tf' || /^(صح|خطأ|صواب)$/.test(currentQ.answer || '')) {
      questions.push({
        id: newQuestionId(),
        type: 'tf',
        text: currentQ.text,
        points: 1,
        options: null,
        answer: currentQ.answer === 'خطأ' ? 'خطأ' : 'صح',
        altAnswers: [],
        rubric: [],
      });
    } else {
      questions.push({
        id: newQuestionId(),
        type: 'short',
        text: currentQ.text,
        points: 2,
        options: null,
        answer: currentQ.answer || '',
        altAnswers: [],
        rubric: [],
        needsReview: !currentQ.answer,
      });
    }
    currentQ = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const qMatch = line.match(/^(?:س\s*[\d١-٩]*[:\-\s]|[\d١-٩]+[\.\-\)]\s*)(.+)/);
    if (qMatch && !line.match(/^[أ-دA-D][\)\.\-]/)) {
      flush();
      let qText = qMatch[1].trim();
      let qType: 'choose' | 'tf' | undefined = undefined;
      let qAns: string | undefined = undefined;

      if (qText.includes('(صح)') || qText.includes('(صواب)')) {
        qType = 'tf';
        qAns = 'صح';
        qText = qText.replace(/\s*\((?:صح|صواب)\)\s*/g, '').trim();
      } else if (qText.includes('(خطأ)')) {
        qType = 'tf';
        qAns = 'خطأ';
        qText = qText.replace(/\s*\(خطأ\)\s*/g, '').trim();
      }

      currentQ = {
        text: qText,
        options: {},
        type: qType,
        answer: qAns,
      };
      continue;
    }

    const ansMatch = line.match(/^(?:الإجابة|ج|الحل)[\s\:\-\/]+\(?([^\)\n]+)\)?/);
    if (ansMatch && currentQ) {
      const rawAns = ansMatch[1].trim();
      const mapped = LEGACY_ARABIC_MAP[rawAns];
      if (mapped) {
        currentQ.answer = mapped;
      } else {
        currentQ.answer = rawAns;
      }
      continue;
    }

    const optMatch = line.match(/^(?:\(?([أ-دA-D])\)?[\.\-\)]\s*)(.+)/);
    if (optMatch && currentQ) {
      const letter = optMatch[1];
      const optKey = LEGACY_ARABIC_MAP[letter] || letter.toLowerCase();
      currentQ.options[optKey] = optMatch[2].trim();
      continue;
    }

    if (line.includes('(صح)') || line.includes('(خطأ)') || line.includes('(صواب)')) {
      if (currentQ) {
        currentQ.type = 'tf';
        currentQ.answer = line.includes('خطأ') ? 'خطأ' : 'صح';
        continue;
      }
    }

    if (currentQ && Object.keys(currentQ.options).length === 0) {
      currentQ.text += ' ' + line;
    }
  }

  flush();

  if (questions.length === 0) {
    warnings.push('لم يتم العثور على أسئلة واضحة في النص. تأكد من الترقيم س/ج أو 1. 2.');
  }

  return { questions, warnings };
}

/**
 * 3. استخراج النص من ملف Word (.docx) بصيغة PK zip
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error('الملف ليس بصيغة Word docx صالحة (توقيع ZIP غير موجود).');
  }

  let offset = 0;
  const targetFile = 'word/document.xml';
  let compressedData: Uint8Array | null = null;
  let compressionMethod = 0;

  while (offset < bytes.length - 30) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x03 &&
      bytes[offset + 3] === 0x04
    ) {
      const method = bytes[offset + 8] | (bytes[offset + 9] << 8);
      const compressedSize =
        bytes[offset + 18] |
        (bytes[offset + 19] << 8) |
        (bytes[offset + 20] << 16) |
        (bytes[offset + 21] << 24);
      const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);

      const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
      const fileName = new TextDecoder().decode(nameBytes);

      const dataStart = offset + 30 + nameLen + extraLen;
      if (fileName === targetFile) {
        compressedData = bytes.subarray(dataStart, dataStart + compressedSize);
        compressionMethod = method;
        break;
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }

  if (!compressedData) {
    throw new Error('تعذر العثور على محتوى المستند (word/document.xml) داخل ملف Word.');
  }

  let xmlString = '';
  if (compressionMethod === 0) {
    xmlString = new TextDecoder('utf-8').decode(compressedData);
  } else if (compressionMethod === 8) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedData as any);
    writer.close();

    const response = new Response(ds.readable);
    const decompressed = await response.arrayBuffer();
    xmlString = new TextDecoder('utf-8').decode(decompressed);
  } else {
    throw new Error(`طريقة ضغط غير مدعومة في ملف Word: ${compressionMethod}`);
  }

  const paragraphs = xmlString.split(/<\/w:p>/);
  const textLines: string[] = [];

  for (const p of paragraphs) {
    const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      const lineText = textMatches
        .map((m) => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
        .join('');
      if (lineText.trim()) {
        textLines.push(lineText.trim());
      }
    }
  }

  return textLines.join('\n');
}

/**
 * استخراج الأسئلة من ملف Word docx كمسودة تحتاج مراجعة
 */
export async function parseQuestionsFromDocx(input: ArrayBuffer | Blob | File): Promise<ImportResult> {
  try {
    const parsed = await parseExamFromDocx(input);
    if (parsed.sections.length > 0) {
      const questions = parsedExamToQuestionDrafts(parsed);
      return {
        questions,
        warnings: parsed.warnings,
        errors: parsed.errors,
        parsedExam: parsed,
      };
    }
    const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
    const text = await extractTextFromDocx(buffer);
    const result = parseQuestionsFromTxt(text);
    result.warnings.unshift('تم استخراج الأسئلة من مستند Word كمسودة تحتاج مراجعة المعلم وتأكيدها.');
    return result;
  } catch (err: any) {
    return {
      questions: [],
      warnings: [`فشل استخراج محتوى ملف Word: ${err.message}`],
    };
  }
}

export interface ProposedLectureDraft {
  title: string;
  videoUrl: string;
  order: number;
  files: { name: string; url: string; type: 'video' | 'pdf' | 'document' }[];
}

export function parseBulkLectureInput(rawText: string): ProposedLectureDraft[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ProposedLectureDraft[] = [];

  let currentOrder = 1;

  for (const line of lines) {
    let title = '';
    let url = '';

    if (line.includes('|')) {
      const parts = line.split('|');
      title = parts[0].trim();
      url = parts.slice(1).join('|').trim();
    } else if (line.includes(' - http')) {
      const idx = line.indexOf(' - http');
      title = line.substring(0, idx).trim();
      url = line.substring(idx + 3).trim();
    } else if (/^https?:\/\//i.test(line)) {
      url = line;
      title = `المحاضرة ${currentOrder}`;
    } else {
      title = line;
      url = '';
    }

    const orderMatch = title.match(/^([0-9١-٩]+)[\.\-\:\)]\s*(.+)/);
    let assignedOrder = currentOrder;
    if (orderMatch) {
      assignedOrder =
        parseInt(orderMatch[1].replace(/[١-٩]/g, (d) => String('١٢٣٤٥٦٧٨٩'.indexOf(d) + 1)), 10) ||
        currentOrder;
      title = orderMatch[2].trim();
    }

    results.push({
      title: title || `محاضرة ${assignedOrder}`,
      videoUrl: url,
      order: assignedOrder,
      files: [],
    });

    currentOrder++;
  }

  return results.sort((a, b) => a.order - b.order);
}

export function proposeLectureOrderingFromFiles(files: (File | string)[]): ProposedLectureDraft[] {
  const drafts: ProposedLectureDraft[] = [];

  Array.from(files).forEach((file, idx) => {
    const rawName = typeof file === 'string' ? file : file.name;
    const lastDot = rawName.lastIndexOf('.');
    const ext = lastDot > 0 ? rawName.substring(lastDot + 1).toLowerCase() : '';
    const baseName = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;

    const orderMatch = baseName.match(/^(?:lesson|lecture|الدرس|محاضرة)?\s*([0-9١-٩]+)[\_\-\.\s]*(.+)?/i);
    let order = idx + 1;
    let cleanTitle = baseName.replace(/[\_\-]/g, ' ').trim();

    if (orderMatch) {
      const num = parseInt(orderMatch[1].replace(/[١-٩]/g, (d) => String('١٢٣٤٥٦٧٨٩'.indexOf(d) + 1)), 10);
      if (!isNaN(num)) order = num;
      if (orderMatch[2] && orderMatch[2].trim()) {
        cleanTitle = orderMatch[2].replace(/[\_\-]/g, ' ').trim();
      }
    }

    const type: 'video' | 'pdf' | 'document' =
      ext === 'pdf' ? 'pdf' : /mp4|webm|mov|mkv/i.test(ext) ? 'video' : 'document';

    drafts.push({
      title: cleanTitle || `ملف ${order}`,
      videoUrl: '',
      order,
      files: [
        {
          name: rawName,
          url: '',
          type,
        },
      ],
    });
  });

  return drafts.sort((a, b) => a.order - b.order);
}

/**
 * استخراج الأسئلة من ملف PDF عبر pdfjs-dist وتحويلها لهيكل التقييم
 */
export async function parseQuestionsFromPdf(input: ArrayBuffer | Blob | File): Promise<ImportResult> {
  const buffer = input instanceof ArrayBuffer ? input : await (input as Blob).arrayBuffer();
  const { extractTextFromPdf } = await import('./pdfExtract.ts');
  const text = await extractTextFromPdf(buffer);
  return parseQuestionsFromTxt(text);
}
