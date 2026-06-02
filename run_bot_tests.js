const fs = require('fs');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html lang="ar"><body></body></html>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

// Mock Audio and other APIs
global.Audio = class { play() { return Promise.resolve(); } };
global.console.groupCollapsed = () => {};
global.console.groupEnd = () => {};
global.console.table = () => {};

// Load support-chat.js
const botCode = fs.readFileSync('js/support-chat.js', 'utf8');
eval(botCode);

const TEST_CATEGORIES = {
  chat: [
    "صباح الخير يا باشا", "ازيك يا يوسف", "هاي", "باي", "انا ماشي", "شكرا يا غالي", "انت مين؟",
    "تصبح على خير", "عامل ايه يا بطل", "مساء الفل", "يا ريت ترد بسرعة", "انا بحبك اوي",
    "ازيك يا هندسة", "تسلم ايدك", "ايه الاخبار", "اهلا بيك", "الف شكر", "يا سيدي متشكرين",
    "سلاموز", "انت بوت ولا انسان"
  ],
  education: [
    "ايه هي تضاريس مصر؟", "مين هو محمد علي؟", "اشرحلي الحملة الفرنسية", "ايه أهمية نهر النيل؟",
    "كلمني عن الزراعة في مصر", "يعني ايه ديمقراطية؟", "كم عدد المحافظات الساحلية؟", "ايه هي خطوط الطول؟",
    "دوائر العرض بتعمل ايه؟", "اشرحلي العصر القبطي", "ثورة 1919 حصلت ليه؟", "متى كانت حرب اكتوبر؟",
    "كلمني عن الاقتصاد المصري", "يعني ايه مواطنة؟", "ايه حقوق الطفل؟", "اهمية السد العالي؟",
    "اسباب التلوث؟", "مين بنى الاهرامات؟", "انجازات محمد علي في الجيش؟", "اسباب الحملة الفرنسية؟"
  ],
  real_chaos: [
    "يعم انا تايه", "هو يعني ايه ده", "طب لي", "مفهمتش", "احا مش فاهم حاجه", "امتحاني بكره",
    "يبوصله", "الدراسات رخمه", "منصه", "الكراس", "البصورةه", "مشعارف احل", "ياعم انجز",
    "عوز اشترك", "امتا الامتحان", "انا ضايع في المنهج", "يسطا انا تعبت", "تعبت من المذاكرة",
    "مشبيفتح", "مابيفتحش", "المنسه بايظه", "كمبيوتر", "خايف اسقط", "خايفه", "فاشل",
    "طهقت", "ملل", "مكسل اذاكر", "مخنوق", "زفت", "غبي", "مش داخله دماغي", "عقدتي جغرافيا",
    "الخريطه معقده", "الامتحان بكرة ورعب", "عايز اقفل", "درجتي زفت", "قفلت الامتحان الحمدلله",
    "قفلت الامتحان", "انا الاول"
  ]
};

// Generate exactly 200 cases
let cases = [];
['chat', 'education', 'real_chaos'].forEach(cat => {
  TEST_CATEGORIES[cat].forEach(input => cases.push({ input, category: cat }));
  // Duplicate with tweaks to reach 200
  TEST_CATEGORIES[cat].forEach(input => cases.push({ input: input + ' ' + (Math.random()>0.5?'جدا':'خالص'), category: cat }));
  TEST_CATEGORIES[cat].forEach(input => cases.push({ input: 'طب ' + input, category: cat }));
});
// Crop to 200
cases = cases.slice(0, 200);

let results = [];
let topWorst = [];

console.log("Running 200 tests...");

for (let tc of cases) {
  // Clear metrics
  global.localStorage.store['pf_brain_metrics'] = '[]';
  
  // Call bot
  let replyText = global.getTemporarySafeBotReply(tc.input);
  
  // Get metrics
  let metricsStr = global.localStorage.getItem('pf_brain_metrics');
  let metrics = metricsStr ? JSON.parse(metricsStr) : [];
  let lastMetric = metrics[metrics.length - 1] || {};

  // Score Heuristics
  let relevance = 10;
  let naturalness = 10;
  let humanScore = 10;
  let continuity = 10;
  let usefulness = 10;

  let intent = lastMetric.Intent || 'UNKNOWN';
  let purpose = lastMetric.Purpose || 'UNKNOWN';
  let strategy = lastMetric.Strategy || 'UNKNOWN';

  // 1. Relevance: If fallback, relevance drops
  if (strategy === 'fallback') { relevance -= 8; usefulness -= 8; }
  
  // 2. Naturalness: Check for redundant prefixes "يا بطل ... يا صاحبي"
  if ((replyText.match(/يا بطل/g) || []).length > 1) naturalness -= 3;
  if (replyText.includes('بص يا بطل') && replyText.includes('يا صاحبي')) naturalness -= 4;

  // 3. Human Score: Is it a robotic list for a simple chat?
  if (tc.category === 'chat' && replyText.includes('**')) humanScore -= 5;
  if (tc.category === 'real_chaos' && replyText.length > 300) humanScore -= 4; // Too long for a chaotic short msg

  // 4. Continuity: Does it ask a follow up?
  if (!replyText.includes('؟')) continuity -= 2;

  // 5. Usefulness: Educational should be > 50 chars
  if (tc.category === 'education' && replyText.length < 50) usefulness -= 5;

  let overall = (relevance + naturalness + humanScore + continuity + usefulness) / 5;

  let status = overall >= 8 ? 'Passed' : overall >= 5 ? 'Partial' : 'Failed';

  let resObj = {
    input: tc.input,
    category: tc.category,
    output: replyText,
    intent, purpose, strategy,
    scores: { relevance, naturalness, humanScore, continuity, usefulness, overall },
    status
  };

  results.push(resObj);
}

// Sort by overall score ascending (worst first)
results.sort((a, b) => a.scores.overall - b.scores.overall);
let worst20 = results.slice(0, 20);

// Generate Markdown
let md = `# تقرير اختبار البوصلة الآلي (200 حالة اختبار)\n\n`;
let passed = results.filter(r => r.status === 'Passed').length;
let partial = results.filter(r => r.status === 'Partial').length;
let failed = results.filter(r => r.status === 'Failed').length;

md += `## ملخص الأداء\n`;
md += `- إجمالي الاختبارات: 200\n`;
md += `- ✅ نجاح (Passed): ${passed}\n`;
md += `- ⚠️ نجاح جزئي (Partial): ${partial}\n`;
md += `- ❌ فشل (Failed): ${failed}\n\n`;

md += `## أقبح 20 رداً (Top 20 Worst Responses)\n\n`;

worst20.forEach((w, i) => {
  md += `### ${i+1}. Input: "${w.input}"\n`;
  md += `- **Category:** ${w.category}\n`;
  md += `- **Detected Intent:** ${w.intent} | **Purpose:** ${w.purpose}\n`;
  md += `- **Score:** ${w.scores.overall}/10 (Rel: ${w.scores.relevance}, Nat: ${w.scores.naturalness}, Hum: ${w.scores.humanScore}, Cont: ${w.scores.continuity}, Use: ${w.scores.usefulness})\n`;
  md += `- **Reason for Failure:** ${w.strategy === 'fallback' ? 'استسلام ومحرك فشل' : w.scores.naturalness < 7 ? 'رد آلي مكرر التنسيقات' : 'رد غير مناسب للسياق الفوضوي'}\n`;
  md += `- **Bot Reply:**\n> ${w.output.replace(/\\n/g, '\n> ')}\n\n`;
});

fs.writeFileSync('test_report.md', md);
console.log('Done! Wrote test_report.md');
