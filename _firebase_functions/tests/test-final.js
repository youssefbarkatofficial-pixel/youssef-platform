const apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
const modelName = "gemini-2.5-flash";
const systemInstructionText = "أنت المساعد الذكي (البوصلة) في منصة الأستاذ يوسف بركات لتعليم التاريخ والجغرافيا للثانوية العامة والإعدادية بمصر. مهمتك: الإجابة بشكل مباشر، علمي، ومختصر ومبسط على أسئلة الطالب. لا تسأل الطالب عما يقصده بل اشرح المعلومة فوراً بناءً على استنتاجك الأقرب للواقع. تكلم بلطف وتشجيع.";

const tests = [
    "يلا بينا نشرح محمد علي",
    "بعدي ايه بيزل",
    "بم تفسر أهمية موقع مصر",
    "اشرحلي مذبحة القلعة"
];

async function run() {
    for (const q of tests) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const start = Date.now();
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemInstructionText }] },
                    contents: [{ role: "user", parts: [{ text: q }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 250 }
                })
            });
            const data = await response.json();
            const latency = Date.now() - start;
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log(`\n--- Q: "${q}" ---`);
            console.log(`Status: ${response.status} | Latency: ${latency}ms`);
            console.log(`Reply: ${reply?.substring(0, 200)}...`);
        } catch (e) {
            console.error(`ERROR for "${q}":`, e.message);
        }
    }
}
run();
