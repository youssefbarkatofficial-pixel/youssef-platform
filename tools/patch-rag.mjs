import fs from 'fs';

let ragContent = fs.readFileSync('bot-worker/src/rag.ts', 'utf8');

// Update STOPWORDS in rag.ts
const oldStopwords = `const STOPWORDS = new Set([
  'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان',
  'كانت', 'هو', 'هي', 'هم', 'هن', 'انا', 'نحن', 'انت', 'انتم', 'لا', 'ما', 'لم', 'لن',
  'قد', 'اي', 'كل', 'جميع', 'بعض', 'غير', 'اكثر', 'اقل', 'مثل', 'حتى', 'لكن', 'بين',
  'ان', 'او', 'اذا', 'عند', 'بعد', 'قبل', 'خلال', 'حول', 'عبر', 'منذ', 'لدى'
]);`;

const newStopwords = `const STOPWORDS = new Set([
  'من', 'في', 'على', 'إلى', 'الي', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'الذين', 'كان',
  'كانت', 'يكون', 'تكون', 'هو', 'هي', 'هم', 'هن', 'انا', 'نحن', 'انت', 'انتم', 'لا', 'ما', 'لم', 'لن',
  'قد', 'اي', 'كل', 'جميع', 'بعض', 'غير', 'اكثر', 'اقل', 'مثل', 'حتى', 'حتي', 'لكن', 'بين',
  'ان', 'او', 'اذا', 'عند', 'بعد', 'قبل', 'خلال', 'حول', 'عبر', 'منذ', 'لدى', 'لدي',
  'كيف', 'ماذا', 'لماذا', 'اين', 'متى', 'متي', 'كم', 'هل', 'ازاي', 'ليه', 'ايش', 'شو', 'يعني'
]);`;

ragContent = ragContent.replace(oldStopwords, newStopwords);

// Update match threshold
const oldMatchCondition = `      if (s > 0.1) {
        scored.push({ score: s, text: chunk.text, id: chunk.id, lessonTitle: chunk.lesson_title });
      }`;

const newMatchCondition = `      // رفض التطابقات العرضية بكلمة واحدة إذا كان السؤال طويلاً
      const passesThreshold = qLen >= 3 ? (matches >= 2 || s >= 0.22) : (s > 0.12);
      if (passesThreshold) {
        scored.push({ score: s, text: chunk.text, id: chunk.id, lessonTitle: chunk.lesson_title });
      }`;

ragContent = ragContent.replace(oldMatchCondition, newMatchCondition);

fs.writeFileSync('bot-worker/src/rag.ts', ragContent, 'utf8');
console.log('Updated rag.ts STOPWORDS and threshold successfully.');
