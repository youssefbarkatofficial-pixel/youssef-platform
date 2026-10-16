-- 0001_initial_schema.sql
-- المخطط الأساسي لقاعدة بيانات البوصلة D1

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    unit TEXT NOT NULL,
    title TEXT NOT NULL,
    archived INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_chunks (
    id TEXT PRIMARY KEY,
    lesson_id TEXT,
    text TEXT NOT NULL,
    keywords TEXT NOT NULL,
    grade TEXT,
    unit TEXT,
    subject TEXT,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_lesson ON lesson_chunks(lesson_id);
CREATE INDEX IF NOT EXISTS idx_chunks_grade ON lesson_chunks(grade);

CREATE TABLE IF NOT EXISTS self_learning_pending (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    keywords TEXT NOT NULL,
    grade TEXT,
    unit TEXT,
    subject TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_self_learning_status ON self_learning_pending(status);

CREATE TABLE IF NOT EXISTS intents (
    core_id TEXT PRIMARY KEY,
    intent TEXT NOT NULL,
    category TEXT NOT NULL,
    answer TEXT NOT NULL,
    variations TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learned_answers (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    question_norm TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learned_norm ON learned_answers(question_norm);

CREATE TABLE IF NOT EXISTS chat_logs (
    id TEXT PRIMARY KEY,
    student_uid TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_reply TEXT NOT NULL,
    source TEXT NOT NULL,
    cpu_ms REAL,
    rating INTEGER DEFAULT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_rating ON chat_logs(rating);
CREATE INDEX IF NOT EXISTS idx_chat_logs_student ON chat_logs(student_uid);

CREATE TABLE IF NOT EXISTS usage_daily (
    id TEXT PRIMARY KEY,
    date_key TEXT NOT NULL,
    user_uid TEXT NOT NULL,
    count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_daily(date_key);

CREATE TABLE IF NOT EXISTS answer_cache (
    question_hash TEXT PRIMARY KEY,
    question_norm TEXT NOT NULL,
    answer TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON answer_cache(expires_at);
