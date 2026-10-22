// تحميل كسول لـ pdfjs-dist (الموجود في package.json).
// ملاحظة: ملف العامل (Worker) والخطوط وملفات cmaps تُخدَم من public/pdfjs لتعمل في الإنتاج أيضًا،
// ومعها مسار بديل من node_modules عند التشغيل في بيئة الاختبار (Node).
import { repairPdfLigatures } from './arabicNormalize.ts';

export interface PdfTextItem { str: string; x: number; y: number }

const AR = /[\u0600-\u06FF]/;

/** يجمّع عناصر الصفحة في سطور: نفس الـ y (±tolerance) = سطر؛ العربي من اليمين لليسار. */
export function groupItemsIntoLines(items: PdfTextItem[], tolerance = 3): string[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    row ? row.items.push(it) : rows.push({ y: it.y, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y); // من فوق لتحت
  return rows.map((r) => {
    const rtl = AR.test(r.items.map((i) => i.str).join(''));
    r.items.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
    return r.items.map((i) => i.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

/**
 * إصلاح إضافي لتشوهات استخراج العربية من الـ PDF:
 * اللام-ألف تُفكّ بترتيب معكوس فيظهر "اال" بدل "الا" (مثل: االحتكار بدل الاحتكار).
 * يُطبَّق على النص قبل التحليل حتى تتطابق الإجابات مع الخيارات ومع إجابات الطلاب.
 */
export function repairPdfArabic(text: string): string {
  if (!text) return '';
  let result = repairPdfLigatures(text);
  result = result.replace(/اال/g, 'الا');
  result = result.replace(/عالق/g, 'علاق'); // العالقة -> العلاقة
  result = result.replace(/(^|\s)ا+(?=\S)/g, '$1ا');
  return result;
}

interface PdfAssets {
  worker: string;
  cmaps: string;
  fonts: string;
}

// في المتصفح: أصول static داخل public/pdfjs — وفي Node: نفس الملفات من node_modules.
export function resolvePdfAssets(): PdfAssets {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isBrowser) {
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
    const root = `${base.replace(/\/+$/, '')}/pdfjs/`;
    return {
      worker: `${root}pdf.worker.min.js`,
      cmaps: `${root}cmaps/`,
      fonts: `${root}standard_fonts/`,
    };
  }

  const root = new URL('../../node_modules/pdfjs-dist/', import.meta.url).toString();
  return {
    worker: `${root}build/pdf.worker.min.mjs`,
    cmaps: `${root}cmaps/`,
    fonts: `${root}standard_fonts/`,
  };
}

let pdfjsPromise: Promise<{ pdfjs: any; assets: PdfAssets }> | null = null;

// في المتصفح نستخدم نسخة pdfjs العادية، وفي Node (اختبارات/سكربتات) النسخة legacy.
async function loadPdfjsModule(): Promise<any> {
  const isNode =
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    Boolean((process as { versions?: { node?: string } }).versions?.node);
  if (isNode) {
    const legacySpecifier = 'pdfjs-dist/legacy/build/pdf.mjs';
    return import(/* @vite-ignore */ legacySpecifier);
  }
  return import('pdfjs-dist');
}

async function getPdfjs(): Promise<{ pdfjs: any; assets: PdfAssets }> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const assets = resolvePdfAssets();
      const pdfjs = await loadPdfjsModule();
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = assets.worker;
      }
      return { pdfjs, assets };
    })();
  }
  return pdfjsPromise;
}

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const { pdfjs, assets } = await getPdfjs();
  // نسخة من البيانات: pdfjs ينقل ملكية الـ ArrayBuffer (detach) فلا نُفسد نسخة المستدعي.
  const bytes = new Uint8Array(buffer.slice(0));
  const pdf = await pdfjs.getDocument({
    data: bytes,
    cMapUrl: assets.cmaps,
    cMapPacked: true,
    standardFontDataUrl: assets.fonts,
  }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const items = (content.items as { str?: string; transform?: number[] }[])
      .filter((i) => typeof i.str === 'string' && i.transform)
      .map((i) => ({ str: i.str as string, x: i.transform![4], y: i.transform![5] }));
    lines.push(...groupItemsIntoLines(items));
  }
  const text = repairPdfArabic(lines.join('\n'));
  if (!text.trim()) throw new Error('no-text-layer'); // PDF مصوّر
  return text;
}
