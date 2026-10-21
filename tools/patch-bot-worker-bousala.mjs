import fs from 'fs';

// 1. Patch types.ts: Add fallbackReason to ChatResponse
let typesContent = fs.readFileSync('bot-worker/src/types.ts', 'utf8');
if (!typesContent.includes('fallbackReason?: string;')) {
  typesContent = typesContent.replace(
    /export interface ChatResponse \{([\s\S]*?)\}/,
    (match, inner) => `export interface ChatResponse {${inner}  fallbackReason?: string;\n}`
  );
  fs.writeFileSync('bot-worker/src/types.ts', typesContent, 'utf8');
  console.log('Patched types.ts successfully.');
} else {
  console.log('types.ts already has fallbackReason.');
}

// 2. Patch auth.ts: Fix firstName for admin 404 fallback
let authContent = fs.readFileSync('bot-worker/src/auth.ts', 'utf8');
if (authContent.includes("firstName: 'يا صديقي'")) {
  authContent = authContent.replace("firstName: 'يا صديقي'", "firstName: 'صديقي'");
  fs.writeFileSync('bot-worker/src/auth.ts', authContent, 'utf8');
  console.log('Patched auth.ts firstName successfully.');
} else {
  console.log('auth.ts firstName already clean.');
}

// 3. Patch llm.ts: Add fallbackReason to LlmResult and set it in all fallback returns
let llmContent = fs.readFileSync('bot-worker/src/llm.ts', 'utf8');
if (!llmContent.includes('fallbackReason?: string;')) {
  llmContent = llmContent.replace(
    'source: \'llm_groq\' | \'llm_gemini\' | \'fallback\';',
    'source: \'llm_groq\' | \'llm_gemini\' | \'fallback\';\n  fallbackReason?: string;'
  );
}

// Ensure fallback returns in llm.ts specify fallbackReason
llmContent = llmContent.replace(
  /source:\s*'fallback',\s*modelUsed:\s*'none',\s*totalTokens:\s*0/g,
  "source: 'fallback',\n      fallbackReason: 'llm_missing_key',\n      modelUsed: 'none',\n      totalTokens: 0"
);

llmContent = llmContent.replace(
  /source:\s*'fallback',\s*modelUsed:\s*targetModel\s*\}\s*;\s*\}\s*\n\s*\/\/ إذا كان كود الخطأ/g,
  "source: 'fallback',\n          fallbackReason: res.status === 429 ? 'llm_rate_limit' : 'llm_server_error',\n          modelUsed: targetModel\n        };\n      }\n\n      // إذا كان كود الخطأ"
);

llmContent = llmContent.replace(
  /console\.error\(`\[GROQ_ERROR_STATUS\] status=\$\{res\.status\}`\);\s*return \{\s*reply: 'تعذر الحصول على إجابة في الوقت الحالي، يُرجى المحاولة لاحقاً أو مراجعة إدارة المنصة\.',\s*source: 'fallback',\s*modelUsed: targetModel/g,
  "console.error(`[GROQ_ERROR_STATUS] status=${res.status}`);\n      return {\n        reply: 'تعذر الحصول على إجابة في الوقت الحالي، يُرجى المحاولة لاحقاً أو مراجعة إدارة المنصة.',\n        source: 'fallback',\n        fallbackReason: `llm_error:${res.status}`,\n        modelUsed: targetModel"
);

llmContent = llmContent.replace(
  /source:\s*'fallback',\s*modelUsed:\s*targetModel\s*\}\s*;\s*\}\s*\}\s*\n\s*\/\/ محاولة Gemini/g,
  "source: 'fallback',\n          fallbackReason: 'llm_timeout',\n          modelUsed: targetModel\n        };\n      }\n    }\n\n  // محاولة Gemini"
);

llmContent = llmContent.replace(
  /source:\s*'fallback',\s*modelUsed:\s*'none'\s*\}\s*;\s*\}\s*$/g,
  "source: 'fallback',\n    fallbackReason: 'llm_all_failed',\n    modelUsed: 'none'\n  };\n}\n"
);

fs.writeFileSync('bot-worker/src/llm.ts', llmContent, 'utf8');
console.log('Patched llm.ts successfully.');

// 4. Patch index.ts: Enhance isGreeting and handle greetings + fallbackReason
let indexContent = fs.readFileSync('bot-worker/src/index.ts', 'utf8');

const newGreetingFunc = `function isGreeting(msg: string): { matched: boolean; reply?: string } {
  const clean = norm(msg);
  if (!clean) return { matched: true, reply: 'أهلاً بك يا بطل! 🧭 أنا البوصلة، المساعد الذكي للأستاذ يوسف بركات. تحب تسأل عن إيه؟' };
  
  const words = clean.split(/\\s+/).filter(Boolean);
  if (words.length > 7) return { matched: false };

  // 1. سؤال من أنت / الهوية
  const isWho = 
    clean.includes('مين انت') || clean.includes('انت مين') || clean.includes('من انت') || 
    clean.includes('عرف نفسك') || clean.includes('ما هي البوصله') || clean.includes('ما هي البوصلة') || 
    clean.includes('ايه البوصله') || clean.includes('ايه البوصلة');
  if (isWho) {
    return {
      matched: true,
      reply: 'أهلاً بك يا بطل! 🧭 أنا البوصلة، المساعد الذكي للأستاذ يوسف بركات في مادة الدراسات الاجتماعية. معاك لأي استفسار أو مراجعة في المنهج خطوة بخطوة. تحب نبدأ بإيه؟'
    };
  }

  // 2. كلمات الشكر والثناء
  const isThanks = 
    words.some(w => ['شكر', 'شكرا', 'مشكور', 'مشكوره', 'تسلم', 'تسلمي', 'عفوا'].includes(w)) ||
    clean.includes('جزاك الله') || clean.includes('ربنا يخليك') || clean.includes('الله يكرمك');
  if (isThanks) {
    return {
      matched: true,
      reply: 'العفو يا بطل! في خدمتك دايماً، وبالتوفيق والدرجات النهائية بإذن الله! 🧭'
    };
  }

  // 3. التحيات والترحيب والألفاظ الاجتماعية
  const greetingDict = new Set([
    'سلام', 'السلام', 'عليكم', 'وعليكم', 'ورحمه', 'وبركاته',
    'مرحبا', 'اهلا', 'اهلين', 'هلا', 'هاي', 'هلو', 'hello', 'hi',
    'صباح', 'الخير', 'مساء', 'النور',
    'ازيك', 'ازايك', 'ازيكم', 'عامل', 'عامله', 'عاملين', 'ايه',
    'كيفك', 'كيف', 'حالك', 'احوالك',
    'تمام', 'حلو', 'جميل', 'ماشي', 'اوك', 'ok', 'اوكي', 'باي',
    'يا', 'مستر', 'استاذ', 'بوصله', 'مع', 'السلامه', 'شكرا'
  ]);

  const allWordsMatch = words.every(w => {
    if (greetingDict.has(w)) return true;
    for (const g of greetingDict) {
      if (w.includes(g) || g.includes(w)) return true;
    }
    return false;
  });

  if (allWordsMatch) {
    return {
      matched: true,
      reply: 'أهلاً بك يا بطل في منصة الأستاذ يوسف بركات! 🧭 أنا البوصلة، معاك لأي سؤال في منهج الدراسات الاجتماعية. تحب نراجع إيه النهاردة؟'
    };
  }

  return { matched: false };
}`;

// Replace isGreeting function definition
indexContent = indexContent.replace(
  /function isGreeting\(msg: string\): boolean \{[\s\S]*?\n\}/,
  newGreetingFunc
);

// Ensure norm is imported in index.ts if not already
if (!indexContent.includes('norm,')) {
  indexContent = indexContent.replace(
    "import { findLessonContext } from './rag';",
    "import { findLessonContext, norm } from './rag';"
  );
}

// Replace the isGreeting call block
const oldGreetingCall = `        // (و) الردود التلقائية المجانية بصفر توكنز
        if (isGreeting(rawMessage)) {
          const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
          const helloReply = 'أهلاً بك يا بطل في منصة الأستاذ يوسف بركات! 🧭 أنا البوصلة، معاك لأي سؤال في منهج الدراسات الاجتماعية. تحب نراجع إيه النهاردة؟';
          const logId = await logChat(env.DB, studentProfile.uid, rawMessage, helloReply, 'intent', cpuMs);
          return Response.json({
            reply: helloReply,
            source: 'intent',
            remaining: tokenBudget.remainingTokens,
            logId,
            cpuMs
          } satisfies ChatResponse, { headers: corsHeaders });
        }`;

const newGreetingCall = `        // (و) الردود التلقائية المجانية بصفر توكنز
        const greetingCheck = isGreeting(rawMessage);
        if (greetingCheck.matched) {
          const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
          const helloReply = greetingCheck.reply || 'أهلاً بك يا بطل في منصة الأستاذ يوسف بركات! 🧭 أنا البوصلة، معاك لأي سؤال في منهج الدراسات الاجتماعية. تحب نراجع إيه النهاردة؟';
          const logId = await logChat(env.DB, studentProfile.uid, rawMessage, helloReply, 'intent', cpuMs);
          return Response.json({
            reply: helloReply,
            source: 'intent',
            remaining: tokenBudget.remainingTokens,
            logId,
            cpuMs
          } satisfies ChatResponse, { headers: corsHeaders });
        }`;

if (indexContent.includes(oldGreetingCall)) {
  indexContent = indexContent.replace(oldGreetingCall, newGreetingCall);
} else {
  // Pattern based replacement
  indexContent = indexContent.replace(
    /\/\/ \(و\) الردود التلقائية المجانية بصفر توكنز[\s\S]*?satisfies ChatResponse, \{ headers: corsHeaders \}\);\s*\}/,
    newGreetingCall
  );
}

// Replace isOutOfSyllabus response to include fallbackReason: 'no_context_found'
indexContent = indexContent.replace(
  /const outReply = 'ده مش في شرح الأستاذ، اسأل الأستاذ أو راجع الدرس';\s*const logId = await logChat\(env\.DB, studentProfile\.uid, rawMessage, outReply, 'fallback', cpuMs\);\s*return Response\.json\({\s*reply: outReply,\s*source: 'fallback',/g,
  `const outReply = 'ده مش في شرح الأستاذ، اسأل الأستاذ أو راجع الدرس';
          const logId = await logChat(env.DB, studentProfile.uid, rawMessage, outReply, 'fallback', cpuMs);
          return Response.json({
            reply: outReply,
            source: 'fallback',
            fallbackReason: 'no_context_found',`
);

// In final LLM response return, include fallbackReason if source is fallback
indexContent = indexContent.replace(
  /source: llmResult\.source,\s*remaining: remainingTokens,/g,
  `source: llmResult.source,
          fallbackReason: llmResult.source === 'fallback' ? (llmResult.fallbackReason || 'llm_error') : undefined,
          remaining: remainingTokens,`
);

fs.writeFileSync('bot-worker/src/index.ts', indexContent, 'utf8');
console.log('Patched index.ts successfully.');
