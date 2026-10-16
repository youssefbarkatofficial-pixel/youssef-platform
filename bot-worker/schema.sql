-- Schema for Bousala Bot D1 Database

-- 1. Settings (Dynamic platform config, schedules, daily limits, model names)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
);

-- 2. Lessons catalog
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    unit TEXT NOT NULL,
    title TEXT NOT NULL,
    archived INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- 3. Academic Lesson Chunks (For RAG retrieval)
CREATE TABLE IF NOT EXISTS lesson_chunks (
    id TEXT PRIMARY KEY,
    lesson_id TEXT,
    text TEXT NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of strings
    grade TEXT,
    unit TEXT,
    subject TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_lesson ON lesson_chunks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_chunks_grade ON lesson_chunks(grade);

-- 4. Self Learning Pending (Student questions/answers isolated for admin review)
CREATE TABLE IF NOT EXISTS self_learning_pending (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    keywords TEXT NOT NULL,
    grade TEXT,
    unit TEXT,
    subject TEXT,
    status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_self_learning_status ON self_learning_pending(status);

-- 5. Semantic Intents (Deterministic fast answers)
CREATE TABLE IF NOT EXISTS intents (
    core_id TEXT PRIMARY KEY,
    intent TEXT NOT NULL,
    category TEXT NOT NULL,
    answer TEXT NOT NULL,
    variations TEXT NOT NULL -- JSON array of strings
);

-- 6. Learned Answers (Admin verified Q&A)
CREATE TABLE IF NOT EXISTS learned_answers (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    question_norm TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learned_norm ON learned_answers(question_norm);

-- 7. Chat Logs (Zero personal identifiers: NO phone, NO email)
CREATE TABLE IF NOT EXISTS chat_logs (
    id TEXT PRIMARY KEY,
    student_uid TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_reply TEXT NOT NULL,
    source TEXT NOT NULL, -- 'intent' | 'cache' | 'llm_groq' | 'llm_gemini' | 'system_override'
    cpu_ms REAL,
    rating INTEGER DEFAULT NULL, -- 1 for 👍, -1 for 👎
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_rating ON chat_logs(rating);
CREATE INDEX IF NOT EXISTS idx_chat_logs_student ON chat_logs(student_uid);

-- 8. Daily Usage Tracking (Rate limits per student & global cap)
CREATE TABLE IF NOT EXISTS usage_daily (
    id TEXT PRIMARY KEY, -- 'YYYY-MM-DD:student_uid' OR 'YYYY-MM-DD:GLOBAL'
    date_key TEXT NOT NULL, -- 'YYYY-MM-DD'
    user_uid TEXT NOT NULL,
    count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_daily(date_key);

-- 9. General Answer Cache (7-day TTL, non-personalized questions only)
CREATE TABLE IF NOT EXISTS answer_cache (
    question_hash TEXT PRIMARY KEY,
    question_norm TEXT NOT NULL,
    answer TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON answer_cache(expires_at);
