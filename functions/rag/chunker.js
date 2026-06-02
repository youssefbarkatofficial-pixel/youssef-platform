/**
 * Semantic Content Chunker
 *
 * Responsibilities:
 * - Split educational content into logical chunks (300-800 characters target).
 * - Preserve semantic boundaries (do not split mid-paragraph).
 * - Inject source attribution metadata.
 */

function chunkEducationalContent(text, metadata) {
    if (!text || typeof text !== 'string') return [];

    // Split by semantic blocks (e.g., paragraphs, bullet points, headers)
    // In a real scenario, this regex might be tuned to detect lesson sub-sections.
    const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
    
    const chunks = [];
    let currentChunkText = '';
    let chunkIndex = 0;

    const MIN_LENGTH = 300;
    const MAX_LENGTH = 800;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        // If adding this block exceeds max length and we already have a decent chunk, flush it.
        if (currentChunkText.length + block.length > MAX_LENGTH && currentChunkText.length >= MIN_LENGTH) {
            chunks.push(createChunkObject(currentChunkText, metadata, chunkIndex));
            chunkIndex++;
            currentChunkText = block;
        } else {
            // Append block
            currentChunkText = currentChunkText ? currentChunkText + '\n\n' + block : block;
        }

        // If the single block is massive, we might have to hard split it, but ideally we don't.
        // For strict semantic chunking, we accept slightly larger chunks over breaking meaning.
        if (currentChunkText.length > MAX_LENGTH * 1.5) {
             console.warn("Found an unusually large semantic block, preserving integrity but warning of size.");
        }
    }

    // Flush remaining
    if (currentChunkText.trim().length > 0) {
        chunks.push(createChunkObject(currentChunkText, metadata, chunkIndex));
    }

    return chunks;
}

function createChunkObject(text, meta, index) {
    // Extract keywords trivially for now. In a real pipeline, an LLM or NLP library would extract these.
    const keywords = text.split(/\s+/).filter(w => w.length > 5).slice(0, 10);

    return {
        id: `chk_${Date.now()}_${index}`,
        sourceBook: meta.sourceBook || 'Unknown Book',
        unit: meta.unit || 'Unknown Unit',
        lesson: meta.lesson || 'Unknown Lesson',
        page: meta.page || 'N/A',
        chunkIndex: index,
        text: text.trim(),
        keywords: keywords,
        difficulty: meta.difficulty || 'medium'
    };
}

module.exports = {
    chunkEducationalContent
};
