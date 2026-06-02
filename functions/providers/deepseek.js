/**
 * Provider: DeepSeek (Stub)
 * 
 * Future usage: Answer simple educational queries automatically
 * without hitting Gemini limits, using DeepSeek's cheaper/faster API.
 */

async function generateDeepSeekReply(prompt) {
    // Stub implementation
    return {
        fallback: true,
        reply: null,
        reason: "not_implemented_yet",
        provider: "deepseek"
    };
}

module.exports = {
    generateDeepSeekReply
};
