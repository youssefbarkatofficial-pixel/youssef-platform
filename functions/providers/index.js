/**
 * LLM Provider Abstraction
 * 
 * Orchestrates calls between Gemini (Primary) and DeepSeek (Future secondary).
 */

const { generateGeminiReply } = require('./gemini');
// const { generateDeepSeekReply } = require('./deepseek');

async function callLLM(prompt) {
    // For now, only Gemini is used.
    // In the future, logic can determine whether to use DeepSeek or Gemini
    // based on query difficulty or previous learned_qa misses.
    
    return await generateGeminiReply(prompt);
}

module.exports = {
    callLLM
};
