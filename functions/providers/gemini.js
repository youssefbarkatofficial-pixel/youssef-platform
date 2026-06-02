/**
 * Provider: Gemini
 * Model: gemini-2.0-flash
 * 
 * Responsibilities:
 * - Read API key ONLY from process.env.GEMINI_API_KEY
 * - 10s timeout
 * - Retry once on transient failure
 * - Fallback response object on failure
 */

const TIMEOUT_MS = 10000; // 10s timeout

async function callWithTimeout(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2, // Low temperature for grounding
            maxOutputTokens: 600,
        }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            return {
                reply: data.candidates[0].content.parts[0].text,
                fallback: false,
                provider: "gemini-2.0-flash"
            };
        }

        throw new Error("No candidates returned from Gemini");
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function generateGeminiReply(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // Fallback for missing keys
        return { fallback: true, reply: null, reason: "missing_api_key", provider: "gemini-2.0-flash" };
    }

    let attempt = 0;
    const MAX_RETRIES = 1; // Retry once on transient failure

    while (attempt <= MAX_RETRIES) {
        try {
            return await callWithTimeout(prompt, apiKey);
        } catch (error) {
            attempt++;
            if (attempt > MAX_RETRIES) {
                return { 
                    fallback: true, 
                    reply: null, 
                    reason: error.name === 'AbortError' ? "timeout" : "llm_unavailable",
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
