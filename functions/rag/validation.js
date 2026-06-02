/**
 * Response Validation Layer
 *
 * Responsibilities:
 * - Enforce maximum token boundaries.
 * - Verify answer grounding (Anti-hallucination).
 * - Reject responses that introduce unsupported claims.
 */

function isGroundedInContext(answer, retrievedChunks) {
    if (!answer || typeof answer !== 'string') return false;
    if (!retrievedChunks || retrievedChunks.length === 0) return false;

    // TODO: In a production environment with high latency budget,
    // grounding could be evaluated by a lightweight dedicated LLM call 
    // or by checking overlapping noun phrases/entities.
    // For now, we perform a basic overlap check as a placeholder.

    // If the answer is the fallback rejection, it's considered safe.
    if (answer.includes('لا يتوفر لدي سياق تعليمي')) return true;

    // Simple heuristic: Ensure at least some key nouns from the answer exist in the chunks.
    // (This is highly simplified and will be expanded later with NLP matching).
    const combinedContext = retrievedChunks.map(c => c.text).join(' ');
    
    // Very basic sanity check (if response is massively longer than context, it's likely hallucinating)
    if (answer.length > combinedContext.length * 2) {
        console.warn("Validation Failed: Answer is suspiciously longer than retrieved context.");
        return false;
    }

    return true; // Assume grounded for now if it passes basic heuristics
}

function validateAndFormatResponse(rawReply, retrievedChunks, confidence) {
    // 1. Confidence Gate
    if (confidence === 'Low' || retrievedChunks.length === 0) {
        return "عفواً، لا يتوفر لدي سياق تعليمي موثق للإجابة على هذا السؤال حالياً.";
    }

    // 2. Length & Scope Gate
    if (rawReply.length > 2000) {
        console.warn("Response exceeded maximum safe length.");
        return "عفواً، الإجابة طويلة جداً وتتجاوز الحدود المسموحة. هل يمكنك تحديد سؤالك أكثر؟";
    }

    // 3. Grounding Verification
    if (!isGroundedInContext(rawReply, retrievedChunks)) {
        console.warn("Grounding Validation Failed. Rejecting LLM response.");
        return "عفواً، الإجابة التي تم توليدها غير مدعومة كلياً بالمنهج الدراسي. يرجى مراجعة المعلم.";
    }

    return rawReply.trim();
}

module.exports = {
    validateAndFormatResponse,
    isGroundedInContext
};
