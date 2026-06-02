/**
 * Prompt Builder Module
 *
 * Responsibilities:
 * - Construct the final prompt for the LLM.
 * - Compress and format chat history to save tokens.
 * - Inject strict system constraints and retrieved context.
 */

const SYSTEM_INSTRUCTIONS = `
You are an educational assistant for Egyptian Social Studies students.

Rules:
- Answer ONLY using the provided educational context.
- If context is insufficient, say so clearly.
- Keep explanations concise and direct.
- Never invent historical facts.
- Never roleplay.
- Never use exaggerated encouragement.
- Never generate unsupported claims.
`;

/**
 * Compress history to prevent token explosion.
 * @param {Array} history Array of previous messages [{role, text}, ...]
 * @param {number} maxTurns Maximum number of recent turns to keep.
 */
function compressHistory(history, maxTurns = 4) {
    if (!history || !Array.isArray(history)) return "";
    
    // Keep only the last N turns to save tokens
    const recentHistory = history.slice(-maxTurns);
    
    if (recentHistory.length === 0) return "No previous history.";

    return recentHistory.map(msg => {
        const role = msg.role === 'user' ? 'Student' : 'Tutor';
        return `${role}: ${msg.text}`;
    }).join('\n');
}

/**
 * Format retrieved chunks into a context block.
 */
function formatContext(chunks) {
    if (!chunks || chunks.length === 0) return "No educational context retrieved.";

    return chunks.map(c => {
        return `---
Source: ${c.sourceBook} | Unit: ${c.unit} | Lesson: ${c.lesson}
${c.text}
---`;
    }).join('\n\n');
}

/**
 * Build the final structured prompt.
 */
function buildEducationalPrompt(question, retrievedChunks, history) {
    const compressedHistory = compressHistory(history);
    const contextBlock = formatContext(retrievedChunks);

    const prompt = `
[SYSTEM INSTRUCTIONS]
${SYSTEM_INSTRUCTIONS.trim()}

[RETRIEVED CONTEXT]
${contextBlock}

[CHAT HISTORY (LAST ${history ? Math.min(history.length, 4) : 0} TURNS)]
${compressedHistory}

[STUDENT QUESTION]
Student: ${question}

[TUTOR RESPONSE]
Tutor:
`;

    return prompt.trim();
}

module.exports = {
    buildEducationalPrompt
};
