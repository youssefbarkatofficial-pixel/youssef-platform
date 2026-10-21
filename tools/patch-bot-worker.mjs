import fs from 'fs';

// 1. Patch prompts.ts
let prompts = fs.readFileSync('bot-worker/src/prompts.ts', 'utf8');
const oldLine = /7\.\s*الأسئلة بدون مقاطع معتمدة في المنهج[^\n]+/;
const newLine = `7. للأسئلة الدراسية (تاريخ، جغرافيا، تربية وطنية) بدون مقاطع منهج: ممنوع منعاً باتاً الإجابة من معلوماتك العامة. إذا كان السؤال غير متوفر في مقاطع المنهج قل نصاً: "ده مش في شرح الأستاذ، اسأل الأستاذ أو راجع الدرس" مع التنبيه: "(مش من المنهج راجع الكتاب)".`;
if (prompts.match(oldLine)) {
  prompts = prompts.replace(oldLine, newLine);
  fs.writeFileSync('bot-worker/src/prompts.ts', prompts, 'utf8');
  console.log('✔ Patched prompts.ts');
}

// 2. Patch index.ts for immediate rejection of out of syllabus questions
let indexTs = fs.readFileSync('bot-worker/src/index.ts', 'utf8');
const searchTarget = `        const isOutOfSyllabus = !learnedAnswer && !intentMatch && ragResult.chunks.length === 0;`;
const replacementTarget = `        const isOutOfSyllabus = !learnedAnswer && !intentMatch && ragResult.chunks.length === 0;

        if (isOutOfSyllabus) {
          const cpuMs = Math.round((performance.now() - startTime) * 100) / 100;
          const outReply = 'ده مش في شرح الأستاذ، اسأل الأستاذ أو راجع الدرس';
          const logId = await logChat(env.DB, studentProfile.uid, rawMessage, outReply, 'fallback', cpuMs);
          return Response.json({
            reply: outReply,
            source: 'fallback',
            remaining: tokenBudget.remainingTokens,
            logId,
            cpuMs
          } satisfies ChatResponse, { headers: corsHeaders });
        }`;

if (indexTs.includes(searchTarget) && !indexTs.includes("const outReply = 'ده مش في شرح الأستاذ")) {
  indexTs = indexTs.replace(searchTarget, replacementTarget);
  fs.writeFileSync('bot-worker/src/index.ts', indexTs, 'utf8');
  console.log('✔ Patched index.ts');
}
