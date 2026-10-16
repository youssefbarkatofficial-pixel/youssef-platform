const { performance } = require('perf_hooks');

// Simulation of rag functions
function norm(str) {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const STOPWORDS = new Set([
  'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي',
  'ما', 'ماذا', 'كيف', 'هل', 'هو', 'هي', 'هم', 'هن', 'أنا', 'نحن', 'أنت', 'كان',
  'يكون', 'له', 'لها', 'لهم', 'كل', 'بعض', 'غير', 'قد', 'ثم', 'أو', 'أم', 'إن', 'أن'
]);

function keywords(str) {
  const words = norm(str).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

// Optimized similarity: querySet created ONCE outside
function searchChunks(allChunks, question, topK = 3, studentGrade = 'الثاني الإعدادي') {
  const kw = keywords(question);
  if (!kw.length) return { chunks: [], bestScore: 0 };
  const querySet = new Set(kw);
  const qLen = kw.length;

  const scored = [];

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];

    // Optional grade pre-filter if chunk has grade and it's completely different
    if (studentGrade && chunk.grade && chunk.grade !== 'عام' && !chunk.grade.includes(studentGrade)) {
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
      if (studentGrade && chunk.grade && chunk.grade.includes(studentGrade)) {
        s *= 1.2;
      }
      if (s > 0.1) {
        scored.push({ score: s, text: chunk.text });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    chunks: scored.slice(0, topK).map(c => c.text),
    bestScore: scored.length ? scored[0].score : 0
  };
}

// Generate synthetic chunks
function generateChunks(count) {
  const subjects = ['تاريخ', 'جغرافيا'];
  const grades = ['الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي', 'الأول الثانوي', 'عام'];
  const sampleWords = [
    'مصر', 'النيل', 'جبال', 'الهيمالايا', 'ايفرست', 'اوروبا', 'اسيا', 'افريقيا',
    'مناخ', 'اقاليم', 'استوائي', 'مداري', 'صحراوي', 'تضاريس', 'هضاب', 'سهول',
    'محمد', 'علي', 'مماليك', 'عثمانيين', 'ثورة', 'فرنسا', 'نابليون', 'حملة',
    'قناة', 'السويس', 'زراعة', 'صناعة', 'تجارة', 'سكان', 'توزيع', 'كثافة'
  ];

  const chunks = [];
  for (let i = 0; i < count; i++) {
    const grade = grades[i % grades.length];
    const subject = subjects[i % subjects.length];
    const pickedWords = [];
    for (let j = 0; j < 8; j++) {
      pickedWords.push(sampleWords[(i * 3 + j) % sampleWords.length]);
    }
    const text = `مقطع دراسي رقم ${i} يتناول موضوع ${pickedWords.join(' ')} في مادة ${subject} للصف ${grade}.`;
    chunks.push({
      id: `chunk_${i}`,
      text,
      keywords: Array.from(new Set(pickedWords)),
      grade,
      subject
    });
  }
  return chunks;
}

console.log('--- اختبار قياس سرعة الـ CPU للبحث في مقاطع RAG ---');

const testQuery = 'ما هي أعلى قمة جبلية في قارة اسيا جبال الهيمالايا إيفرست؟';

// Benchmark 300 chunks
const chunks300 = generateChunks(300);
const runs = 20;

let total300 = 0;
for (let r = 0; r < runs; r++) {
  const t0 = performance.now();
  searchChunks(chunks300, testQuery, 3, 'الثاني الإعدادي');
  const t1 = performance.now();
  total300 += (t1 - t0);
}
const avg300 = (total300 / runs).toFixed(3);
console.log(`[300 مقطع] متوسط وقت التنفيذ عبر ${runs} جولة: ${avg300} ms`);

// Benchmark 1000 chunks
const chunks1000 = generateChunks(1000);
let total1000 = 0;
for (let r = 0; r < runs; r++) {
  const t0 = performance.now();
  searchChunks(chunks1000, testQuery, 3, 'الثاني الإعدادي');
  const t1 = performance.now();
  total1000 += (t1 - t0);
}
const avg1000 = (total1000 / runs).toFixed(3);
console.log(`[1000 مقطع] متوسط وقت التنفيذ عبر ${runs} جولة: ${avg1000} ms`);

if (parseFloat(avg1000) < 5.0) {
  console.log(`✅ النتيجة ممتازة: ${avg1000} ms أقل بكثير من حد 5ms (وحد 10ms في كلاودفلير Free)`);
} else {
  console.log(`⚠️ تجاوز الحد: ${avg1000} ms`);
}
