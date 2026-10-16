-- 0002_conversation_states.sql
-- جدول حالة المحادثات والتدخل المباشر للمعلم (Phase 6 - Part 3)

CREATE TABLE IF NOT EXISTS conversation_states (
    student_uid TEXT PRIMARY KEY,
    bot_paused INTEGER DEFAULT 0,
    admin_active INTEGER DEFAULT 0,
    last_student_message_at INTEGER,
    last_admin_message_at INTEGER,
    last_activity_at INTEGER NOT NULL,
    unread_for_admin INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conv_unread ON conversation_states(unread_for_admin);
CREATE INDEX IF NOT EXISTS idx_conv_activity ON conversation_states(last_activity_at);
