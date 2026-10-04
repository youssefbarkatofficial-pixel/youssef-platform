/**
 * Provider: Groq
 *
 * Responsibilities:
 * - Read API key ONLY from process.env.GROQ_API_KEY (NEVER from client code).
 * - 10s timeout per call.
 * - Fallback across two models (fast 8B, then smarter 70B) before ultimate failure.
 */

const TIMEOUT_MS = 10000; // 10s timeout per model attempt

const FALLBACK_MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192"
];

async function callModelWithTimeout(prompt, apiKey, modelName) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 600
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!text) {
            throw new Error('Empty response from Groq');
        }

        return { reply: text, fallback: false, provider: 'groq-' + modelName };
    } finally {
        clearTimeout(timeout);
    }
}

async function generateGroqReply(prompt) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        return { fallback: true, reply: null, reason: "missing_api_key", provider: "groq" };
    }

    let lastError = null;

    for (let i = 0; i < FALLBACK_MODELS.length; i++) {
        const currentModel = FALLBACK_MODELS[i];
        try {
            return await callModelWithTimeout(prompt, apiKey, currentModel);
        } catch (error) {
            lastError = error;
            console.error(`\n[GROQ API ERROR - Model: ${currentModel}]`);
            console.error("Message:", error.message);

            const shouldFallback = error.message.includes('429') ||
                                    error.message.includes('503') ||
                                    error.message.includes('404') ||
                                    error.message.includes('400');

            if (shouldFallback && i < FALLBACK_MODELS.length - 1) {
                console.log(`Falling back to next Groq model: ${FALLBACK_MODELS[i + 1]}...`);
                continue;
            } else {
                break;
            }
        }
    }

    return {
        fallback: true,
        reply: null,
        reason: lastError ? lastError.message : "unknown_error",
        provider: "groq"
    };
}

module.exports = { generateGroqReply };
