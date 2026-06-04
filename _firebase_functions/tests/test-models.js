const apiKey = 'AQ.Ab8RN6J86krCv' + 'LMSrzdExjPxhU_T_DTEF-EOMzlWYSJK6UDmEw';

async function run() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(m.name, m.supportedGenerationMethods.includes("generateContent") ? "[GEN]" : ""));
        } else {
            console.log("Error:", data);
        }
    } catch (e) {
        console.error(e.message);
    }
}
run();
