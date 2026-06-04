/**
 * Provider: Gemini
 * 
 * Responsibilities:
 * - Use official @google/generative-ai SDK.
 * - Read API key ONLY from process.env.GEMINI_API_KEY.
 * - 10s timeout per call.
 * - Fallback across models on Quota Error (429) before ultimate failure.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const TIMEOUT_MS = 10000; // 10s timeout per model attempt

// Models to try in sequence
const FALLBACK_MODELS = [
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-8b"
];

async function callModelWithTimeout(prompt, apiKey, modelName) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TimeoutError: Request exceeded 10s limit")), TIMEOUT_MS)
    );

    const result = await Promise.race([
        model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
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
        provider: modelName
    };
}

async function generateGeminiReply(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return { fallback: true, reply: null, reason: "missing_api_key", provider: "gemini" };
    }

    let lastError = null;

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
        const currentModel = FALLBACK_MODELS[i];
        try {
            return await callModelWithTimeout(prompt, apiKey, currentModel);
        } catch (error) {
            lastError = error;
            console.error(`\n[GEMINI API ERROR - Model: ${currentModel}]`);
            console.error("Name:", error.name);
            console.error("Message:", error.message);
            if (error.status) console.error("Status:", error.status);
            if (error.details) console.error("Details:", JSON.stringify(error.details, null, 2));

            // Check if it's a quota (429), server (503), or model not found/supported (404/400)
            const shouldFallback = error.message.includes('429') || 
                                   error.message.includes('503') || 
                                   error.message.includes('404') || 
                                   error.message.includes('400') ||
                                   error.message.includes('Resource has been exhausted');
            
            if (shouldFallback && i < FALLBACK_MODELS.length - 1) {
                console.log(`Falling back to next model: ${FALLBACK_MODELS[i+1]}...`);
                continue; // Try next model
            } else {
                break; // Break and return ultimate fallback
            }
        }
    }

    // Ultimate fallback if all models fail or a fatal non-recoverable error occurs
    return { 
        fallback: true, 
        reply: null, 
        reason: lastError && lastError.message.includes('Timeout') ? "timeout" : "llm_unavailable",
        rawError: lastError ? lastError.message : "unknown",
        provider: "gemini"
    };
}

module.exports = {
    generateGeminiReply
};
