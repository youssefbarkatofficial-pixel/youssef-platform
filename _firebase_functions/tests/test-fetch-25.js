const apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
const modelName = "gemini-2.5-flash";
let systemInstructionText = "أنت المساعد الذكي (البوصلة) في منصة الأستاذ يوسف بركات لتعليم التاريخ والجغرافيا للثانوية العامة والإعدادية بمصر. مهمتك: الإجابة بشكل مباشر، علمي، ومختصر ومبسط على أسئلة الطالب. لا تسأل الطالب عما يقصده بل اشرح المعلومة فوراً بناءً على استنتاجك الأقرب للواقع. تكلم بلطف وتشجيع.";

async function run() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstructionText }] },
                contents: [{ role: "user", parts: [{ text: "يلا بينا نشرح محمد علي" }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 250 }
            })
        });
        const data = await response.json();
        console.log(`Status: ${response.status}`);
        console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (e) {
        console.error(e.message);
    }
}
run();
