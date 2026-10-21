import type { QuestionDraft } from './questionDraft.ts';
import type { QuestionType } from './grading.ts';
import { newQuestionId } from './questionDraft.ts';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'] as const;
const ARABIC_LETTERS: Record<string, string> = {
  'أ': 'a',
  'ا': 'a',
  'ب': 'b',
  'ج': 'c',
  'د': 'd',
  'هـ': 'e',
  'ه': 'e',
  'A': 'a',
  'B': 'b',
  'C': 'c',
  'D': 'd',
  'E': 'e',
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
};

export interface ImportResult {
  questions: QuestionDraft[];
  warnings: string[];
}

/**
 * 1. استيراد الأسئلة من ملف JSON (متوافق مع fixture-draft_3prep_unit2_mcq.json والنسق القياسي)
 */
export function parseQuestionsFromJson(jsonStr: string): ImportResult {
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

    // تنظيف الترقيم الملتصق في البداية إن وجد (مثل "١ تصارع..." أو "1. تصارع...")
    const cleanText = text.replace(/^[0-9١-٩]+[\s\.\-\:\)]\s*/, '').trim();

    // فحص الاختيارات
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
        // قاموس مثل { "أ": "المصريون", "ب": "الفرنسيون", ... }
        Object.entries(rawChoices).forEach(([k, v]) => {
          const mappedKey = ARABIC_LETTERS[k.trim()] || k.toLowerCase().trim();
          optionsMap[mappedKey] = String(v).trim();
        });
      }

      // تحديد الإجابة الصحيحة
      const rawAns = String(item.answer_letter || item.answer || item.correct || '').trim();
      if (rawAns) {
        correctKey = ARABIC_LETTERS[rawAns] || rawAns.toLowerCase();
      } else if (item.answer_text) {
        // مطابقة نص الإجابة بالاختيارات
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
      // افتراض مقالي / إجابة قصيرة
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

    // كشف بداية سؤال جديد: مثل "س1:", "س:", "١-", "1.", "1)"
    const qMatch = line.match(/^(?:س\s*[\d١-٩]*[:\-\s]|[\d١-٩]+[\.\-\)]\s*)(.+)/);
    if (qMatch && !line.match(/^[أ-دA-D][\)\.\-]/)) {
      flush();
      let qText = qMatch[1].trim();
      let qType: 'choose' | 'tf' | 'essay' | undefined = undefined;
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

    // 1. كشف الإجابة أولاً: "الإجابة: ج" أو "ج: محمد علي" أو "ج/ ..."
    const ansMatch = line.match(/^(?:الإجابة|ج|الحل)[\s\:\-\/]+\(?([^\)\n]+)\)?/);
    if (ansMatch && currentQ) {
      const rawAns = ansMatch[1].trim();
      const mapped = ARABIC_LETTERS[rawAns];
      if (mapped) {
        currentQ.answer = mapped;
      } else {
        // نص إجابة
        currentQ.answer = rawAns;
      }
      continue;
    }

    // 2. كشف اختيارات: مثل "أ) ...", "(ب) ...", "ج- ...", "A) ..."
    const optMatch = line.match(/^(?:\(?([أ-دA-D])\)?[\.\-\)]\s*)(.+)/);
    if (optMatch && currentQ) {
      const letter = optMatch[1];
      const optKey = ARABIC_LETTERS[letter] || letter.toLowerCase();
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

    // إذا لم يطابق وكان لدينا سؤال حالي، نلحق النص بنص السؤال إن كان بلا اختيارات
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
 * 3. استخراج النص من ملف Word (.docx)
 * بصيغة PK zip واستخراج word/document.xml باستخدام DecompressionStream المدمج
 */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);

  // تحقق من توقيع ZIP (PK\x03\x04)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error('الملف ليس بصيغة Word docx صالحة (توقيع ZIP غير موجود).');
  }

  // البحث عن ملف word/document.xml داخل أرشيف ZIP
  // بنية Local file header: 30 بايت + filename_len + extra_len
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
    // Stored (no compression)
    xmlString = new TextDecoder('utf-8').decode(compressedData);
  } else if (compressionMethod === 8) {
    // Deflate
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

  // استخراج النصوص من داخل وسوم <w:t> و <w:p>
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

/**
 * 4. الرفع السريع للروابط والدروس داخل محرر الكورس
 * يحلل قائمة روابط أو أسماء ملفات ويقترح عناوين وترتيبًا
 */
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
    // تنسيق: 1. عنوان المحاضرة | https://...
    // أو: عنوان المحاضرة - https://...
    // أو: رابط فقط
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

    // تنظيف رقم الترتيب من العنوان المقترح
    const orderMatch = title.match(/^([0-9١-٩]+)[\.\-\:\)]\s*(.+)/);
    let assignedOrder = currentOrder;
    if (orderMatch) {
      assignedOrder = parseInt(orderMatch[1].replace(/[١-٩]/g, (d) => String('١٢٣٤٥٦٧٨٩'.indexOf(d) + 1)), 10) || currentOrder;
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
    // فصل الامتداد
    const lastDot = rawName.lastIndexOf('.');
    const ext = lastDot > 0 ? rawName.substring(lastDot + 1).toLowerCase() : '';
    const baseName = lastDot > 0 ? rawName.substring(0, lastDot) : rawName;

    // استخراج رقم الترتيب من اسم الملف (مثل "01_lecture" أو "الدرس 2")
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
