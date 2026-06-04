const apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';
const models = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite-001"];

async function run() {
    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        try {
            console.log(`Trying ${modelName}...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] })
            });
            const data = await response.json();
            console.log(`Status: ${response.status}`, JSON.stringify(data).substring(0, 200));
        } catch (e) {
            console.error(e.message);
        }
    }
}
run();
