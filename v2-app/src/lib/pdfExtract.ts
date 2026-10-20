// تحميل كسول لـ pdfjs-dist (الموجود في package.json).
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

export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    const items = (content.items as { str?: string; transform?: number[] }[])
      .filter((i) => typeof i.str === 'string' && i.transform)
      .map((i) => ({ str: i.str as string, x: i.transform![4], y: i.transform![5] }));
    lines.push(...groupItemsIntoLines(items));
  }
  const text = repairPdfLigatures(lines.join('\n'));
  if (!text.trim()) throw new Error('no-text-layer'); // PDF مصوّر
  return text;
}
