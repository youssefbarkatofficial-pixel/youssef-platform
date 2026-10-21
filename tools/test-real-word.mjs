import fs from 'fs';
import { parseExamFromDocx } from '../v2-app/src/lib/questionImport.ts';

async function testRealWordDoc() {
  const filePath = 'C:/Users/mohammed/Downloads/اسئلة_الكتاب_المدرسي_والتقييمات_الصف_الرابع.docx';
  if (!fs.existsSync(filePath)) {
    console.log('مفيش ملف حقيقي متاح');
    return;
  }

  const buf = fs.readFileSync(filePath);
  const parsed = await parseExamFromDocx(buf);

  let totalQuestions = 0;
  parsed.sections.forEach(s => totalQuestions += s.questions.length);

  console.log('=== REAL WORD FILE EXTRACTION REPORT ===');
  console.log(`File: ${filePath}`);
  console.log(`Title: ${parsed.title || 'بدون عنوان'}`);
  console.log(`Sections Count: ${parsed.sections.length}`);
  console.log(`Total Questions: ${totalQuestions}`);
  console.log('Sections Breakdown:');
  parsed.sections.forEach((s, idx) => {
    console.log(`  [Section ${idx + 1}] "${s.header}": ${s.questions.length} questions`);
  });

  console.log('\nFirst 3 Questions (truncated to 60 chars):');
  let printed = 0;
  for (const s of parsed.sections) {
    for (const q of s.questions) {
      if (printed < 3) {
        console.log(`  [Q${printed + 1}] [${q.type}] ${(q.stem || '').slice(0, 60)}`);
        printed++;
      }
    }
  }
}

testRealWordDoc().catch(console.error);
