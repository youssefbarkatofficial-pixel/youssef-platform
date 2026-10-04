/**
 * LLM Provider Abstraction
 *
 * Orchestrates calls between Groq (Primary - fast & was the original engine)
 * and Gemini (Fallback - used automatically if Groq fails or quota is missing).
 */

const { generateGroqReply } = require('./groq');
const { generateGeminiReply } = require('./gemini');

async function callLLM(prompt) {
    // 1) Try Groq first (this is what the bot originally used and sounded "smart" with).
    const groqResult = await generateGroqReply(prompt);
    if (!groqResult.fallback) {
        return groqResult;
    }
    console.warn('[LLM ROUTER] Groq failed or has no key, falling back to Gemini. Reason:', groqResult.reason);

    // 2) Fallback to Gemini.
    return await generateGeminiReply(prompt);
}

module.exports = {
    callLLM
};
