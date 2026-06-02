/**
 * LIVE TEST SCRIPT FOR GEMINI INTEGRATION
 */

const { validateAndFormatResponse } = require('../rag/validation');
const { callLLM } = require('../providers/index');

const mockChunks = [
    { id: 'h1', text: 'مصر تقع في شمال إفريقيا. وتعتبر من أهم الدول نظراً لموقعها الاستراتيجي الذي يربط بين قارات العالم القديم. محمد علي هو مؤسس مصر الحديثة.' }
];

async function runLiveTests() {
    console.log("--- RUNNING LIVE GEMINI PIPELINE TESTS ---");

    if (!process.env.GEMINI_API_KEY) {
        console.error("ERROR: GEMINI_API_KEY is not set.");
        return;
    }

    console.log("\n[TEST 1] Successful Grounded Answer (بم تفسر أهمية موقع مصر؟)");
    const prompt1 = `
[SYSTEM INSTRUCTIONS]
Answer ONLY using context.

[RETRIEVED CONTEXT]
مصر تقع في شمال إفريقيا. وتعتبر من أهم الدول نظراً لموقعها الاستراتيجي الذي يربط بين قارات العالم القديم. محمد علي هو مؤسس مصر الحديثة.

[STUDENT QUESTION]
Student: بم تفسر أهمية موقع مصر؟
Tutor:
`;
    let startTime = Date.now();
    let res1 = await callLLM(prompt1);
    let latency1 = Date.now() - startTime;
    console.log("Latency:", latency1, "ms");
    console.log("Provider:", res1.provider);
    console.log("Raw Output:", res1.reply);
    
    if (res1.fallback) {
        console.log("API FAILED/REJECTED. Reason:", res1.reason);
    } else {
        let validRes1 = validateAndFormatResponse(res1.reply, mockChunks, 'High');
        console.log("Validation Passed:", !validRes1.includes("غير مدعومة") && !validRes1.includes("لا يتوفر لدي"));
    }
    console.log("------------------------------------------");

    console.log("\n[TEST 2] Successful Grounded Answer (من هو محمد علي؟)");
    const prompt2 = `
[SYSTEM INSTRUCTIONS]
Answer ONLY using context.

[RETRIEVED CONTEXT]
مصر تقع في شمال إفريقيا. وتعتبر من أهم الدول نظراً لموقعها الاستراتيجي الذي يربط بين قارات العالم القديم. محمد علي هو مؤسس مصر الحديثة.

[STUDENT QUESTION]
Student: من هو محمد علي؟
Tutor:
`;
    startTime = Date.now();
    let res2 = await callLLM(prompt2);
    let latency2 = Date.now() - startTime;
    console.log("Latency:", latency2, "ms");
    console.log("Raw Output:", res2.reply);
    
    if (res2.fallback) {
        console.log("API FAILED/REJECTED. Reason:", res2.reason);
    } else {
        let validRes2 = validateAndFormatResponse(res2.reply, mockChunks, 'High');
        console.log("Validation Passed:", !validRes2.includes("غير مدعومة") && !validRes2.includes("لا يتوفر لدي"));
    }
    console.log("------------------------------------------");


    console.log("\n[TEST 3] Out-of-Context Hallucination Test (من هو نابليون بونابرت؟)");
    const prompt3 = `
[SYSTEM INSTRUCTIONS]
Answer ONLY using context.

[RETRIEVED CONTEXT]
مصر تقع في شمال إفريقيا. وتعتبر من أهم الدول نظراً لموقعها الاستراتيجي الذي يربط بين قارات العالم القديم. محمد علي هو مؤسس مصر الحديثة.

[STUDENT QUESTION]
Student: من هو نابليون بونابرت؟
Tutor:
`;
    startTime = Date.now();
    let res3 = await callLLM(prompt3);
    let latency3 = Date.now() - startTime;
    console.log("Latency:", latency3, "ms");
    console.log("Raw Output:", res3.reply);
    
    console.log("\n[TEST 4] ISOLATED DIRECT CONNECTIVITY TEST (Say hello in Arabic)");
    try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        startTime = Date.now();
        const result = await model.generateContent("Say hello in Arabic");
        let isolatedLatency = Date.now() - startTime;
        console.log("Latency:", isolatedLatency, "ms");
        console.log("Raw SDK Output:", result.response.text());
        console.log("Result: PASS");
    } catch (error) {
        console.log("Latency:", Date.now() - startTime, "ms");
        console.log("--- EXACT GOOGLE ERROR PAYLOAD ---");
        console.log("Name:", error.name);
        console.log("Message:", error.message);
        if (error.status) console.log("Status:", error.status);
        if (error.details) console.log("Details:", JSON.stringify(error.details, null, 2));
        console.log("Result: FAIL");
    }
    console.log("------------------------------------------");
}

runLiveTests();
