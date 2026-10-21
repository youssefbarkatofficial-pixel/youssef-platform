// منطق نقي لاستخراج روابط الملفات من contents (بنية v2 الفعلية). غير مختبر على بيانات حقيقية.
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function fromNode(node) {
  const files = Array.isArray(node.files)
    ? node.files.filter((f) => isObj(f) && str(f.url)).map((f) => ({ id: str(f.id), title: str(f.title), url: str(f.url) }))
    : [];
  const pdfUrl = str(node.pdfUrl);
  return pdfUrl || files.length ? { pdfUrl, files } : null;
}

function walkItems(items, out) {
  for (const it of Array.isArray(items) ? items : []) {
    if (!isObj(it)) continue;
    const id = str(it.id);
    const got = id && fromNode(it);
    if (got) out[id] = got;
    walkItems(it.children, out);
  }
}

/** يرجّع { [itemId]: { pdfUrl, files[] } } من course.contents (lectures + sections.items). */
export function extractFileLinks(course) {
  const out = {};
  const c = isObj(course?.contents) ? course.contents : {};
  for (const lec of Array.isArray(c.lectures) ? c.lectures : []) {
    if (!isObj(lec)) continue;
    const id = str(lec.id);
    const got = id && fromNode(lec);
    if (got) out[id] = got;
  }
  for (const sec of Array.isArray(c.sections) ? c.sections : []) if (isObj(sec)) walkItems(sec.items, out);
  return out;
}

export const countLinks = (map) => Object.values(map).reduce((n, v) => n + (v.pdfUrl ? 1 : 0) + v.files.length, 0);
export const approxBytes = (map) => Buffer.byteLength(JSON.stringify(map), 'utf8');
export const DOC_LIMIT_WARN = 800_000; // حد Firestore 1MB
