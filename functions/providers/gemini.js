/**
 * Provider: Gemini
 * Model: gemini-2.0-flash
 * 
 * Responsibilities:
 * - Use official @google/generative-ai SDK.
 * - Read API key ONLY from process.env.GEMINI_API_KEY.
 * - 10s timeout, Retry once on transient failure.
 * - Fallback response object on failure.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const TIMEOUT_MS = 10000; // 10s timeout

async function callWithTimeout(prompt, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Implement SDK timeout manually using Promise.race since SDK might not expose timeout natively yet
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TimeoutError: Request exceeded 10s limit")), TIMEOUT_MS)
    );

    try {
        const result = await Promise.race([
            model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2, // Low temperature for grounding
                    maxOutputTokens: 600,
                }
            }),
            timeoutPromise
        ]);

        const response = await result.response;
        const text = response.text();

        return {
            reply: text,
            fallback: false,
            provider: "gemini-2.0-flash"
        };
    } catch (error) {
        // Return raw error to caller to print raw payload
        throw error;
    }
}

async function generateGeminiReply(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return { fallback: true, reply: null, reason: "missing_api_key", provider: "gemini-2.0-flash" };
    }

    let attempt = 0;
    const MAX_RETRIES = 1;

    while (attempt <= MAX_RETRIES) {
        try {
            return await callWithTimeout(prompt, apiKey);
        } catch (error) {
            attempt++;
            
            // To satisfy user constraint #5: "Print the exact raw HTTP/API error body returned by Google"
            console.error(`\n[GEMINI API ERROR - ATTEMPT ${attempt}]`);
            console.error("Name:", error.name);
            console.error("Message:", error.message);
            if (error.status) console.error("Status:", error.status);
            if (error.details) console.error("Details:", JSON.stringify(error.details, null, 2));

            if (attempt > MAX_RETRIES) {
                return { 
                    fallback: true, 
                    reply: null, 
                    reason: error.message.includes('Timeout') ? "timeout" : "llm_unavailable",
                    rawError: error.message,
                    provider: "gemini-2.0-flash"
                };
            }
            // Minor backoff before retry (1s)
            await new Promise(res => setTimeout(res, 1000));
        }
    }
}

module.exports = {
    generateGeminiReply
};
