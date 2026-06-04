/**
 * Gemini API Integration
 *
 * Responsibilities:
 * - Securely call Gemini API using server-side secrets.
 * - Enforce timeout protection.
 * - Automatic retries with exponential backoff.
 * - Return graceful fallback payload on failure.
 */

// Node 18+ has native fetch.
const TIMEOUT_MS = 12000; // 12 seconds max
const MAX_RETRIES = 2;

async function callGeminiWithTimeout(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2, // Low temperature for factual grounding
            maxOutputTokens: 500, // Short educational answers
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
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            return {
                reply: data.candidates[0].content.parts[0].text,
                fallback: false
            };
        }

        throw new Error("No candidates returned from Gemini");
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY; // Managed via Firebase Secrets or Env

    if (!apiKey) {
        console.warn("GEMINI_API_KEY not found. Using fallback.");
        return { fallback: true, reply: null, reason: "missing_api_key" };
    }

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            return await callGeminiWithTimeout(prompt, apiKey);
        } catch (error) {
            attempt++;
            console.error(`Gemini Call Failed (Attempt ${attempt}):`, error.message);
            if (attempt >= MAX_RETRIES) {
                return { fallback: true, reply: null, reason: error.name === 'AbortError' ? "timeout" : "llm_unavailable" };
            }
            // Exponential backoff
            await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
        }
    }
}

module.exports = {
    callGemini
};
