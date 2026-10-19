-- Migration 0003: Teaching Data Model for Bousala Knowledge Base
-- Adds course_id, lesson_id, stage, kind, status, source_note, updated_at to lesson_chunks

ALTER TABLE lesson_chunks ADD COLUMN course_id TEXT;
ALTER TABLE lesson_chunks ADD COLUMN stage TEXT;
ALTER TABLE lesson_chunks ADD COLUMN kind TEXT DEFAULT 'شرح';
ALTER TABLE lesson_chunks ADD COLUMN status TEXT DEFAULT 'verified';
ALTER TABLE lesson_chunks ADD COLUMN source_note TEXT;
ALTER TABLE lesson_chunks ADD COLUMN updated_at INTEGER;

-- Backfill existing 44 chunks:
-- All 44 chunks belong to prep2 (الثاني الإعدادي) - Unit 1 Lesson 1
UPDATE lesson_chunks
SET 
    course_id = 'c1785199571849',
    stage = 'prep2',
    kind = 'شرح',
    status = 'verified',
    grade = 'الثاني الإعدادي',
    source_note = 'مهاجر من القاعدة السابقة: تانية إعدادي - الوحدة 1 الدرس 1',
    updated_at = created_at
WHERE updated_at IS NULL;

-- Fix the 10 chunks that had empty grade:
UPDATE lesson_chunks
SET grade = 'الثاني الإعدادي'
WHERE (grade IS NULL OR grade = '') AND lesson_id = 'lesson_prep2_u1_l1';

-- Create performant indexes
CREATE INDEX IF NOT EXISTS idx_chunks_course_lesson ON lesson_chunks(course_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_chunks_stage ON lesson_chunks(stage);
CREATE INDEX IF NOT EXISTS idx_chunks_status ON lesson_chunks(status);
