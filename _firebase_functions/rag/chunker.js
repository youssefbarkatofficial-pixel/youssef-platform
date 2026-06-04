/**
 * Semantic Content Chunker
 *
 * Responsibilities:
 * - Semantic-first chunking.
 * - Generate deterministic IDs.
 * - Generate content hashes for deduplication.
 * - Attach versioning metadata.
 */

const crypto = require('crypto');

/**
 * Creates a stable deterministic ID.
 * Example: history_u2_l3_c04
 */
function generateDeterministicId(meta, index) {
    const s = (meta.subject || 'sub').toLowerCase().replace(/\s+/g, '_');
    const u = (meta.unit || 'u0').toLowerCase().replace(/\s+/g, '_');
    const l = (meta.lesson || 'l0').toLowerCase().replace(/\s+/g, '_');
    const cIdx = String(index).padStart(2, '0');
    return `${s}_${u}_${l}_c${cIdx}`;
}

/**
 * Creates a content hash for the chunk text.
 */
function generateHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function chunkEducationalContent(text, metadata) {
    if (!text || typeof text !== 'string') return [];

    const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(b => b.length > 0);
    const chunks = [];
    let currentChunkText = '';
    let chunkIndex = 0;

    const MIN_LENGTH = 300;
    const MAX_LENGTH = 800;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (currentChunkText.length + block.length > MAX_LENGTH && currentChunkText.length >= MIN_LENGTH) {
            chunks.push(createChunkObject(currentChunkText, metadata, chunkIndex));
            chunkIndex++;
            currentChunkText = block;
        } else {
            currentChunkText = currentChunkText ? currentChunkText + '\n\n' + block : block;
        }
    }

    if (currentChunkText.trim().length > 0) {
        chunks.push(createChunkObject(currentChunkText, metadata, chunkIndex));
    }

    return chunks;
}

function createChunkObject(text, meta, index) {
    const id = generateDeterministicId(meta, index);
    const contentHash = generateHash(text);
    const keywords = text.split(/\s+/).filter(w => w.length > 5).slice(0, 10);

    return {
        id: id,
        text: text.trim(),
        contentHash: contentHash,
        sourceBook: meta.sourceBook || 'Unknown Book',
        unit: meta.unit || 'Unknown Unit',
        lesson: meta.lesson || 'Unknown Lesson',
        page: meta.page || 'N/A',
        chunkIndex: index,
        keywords: keywords,
        status: meta.status || 'draft', // draft, staged, published, archived
        curriculumVersion: meta.curriculumVersion || 'v1.0',
        syllabusYear: meta.syllabusYear || new Date().getFullYear().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    chunkEducationalContent,
    generateDeterministicId,
    generateHash
};
