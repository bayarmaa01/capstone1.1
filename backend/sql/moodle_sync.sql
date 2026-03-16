-- Moodle Integration Database Schema
-- Add Moodle-specific fields to existing tables

-- Update classes table to include Moodle course ID
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS lms_course_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS moodle_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS moodle_last_sync TIMESTAMP;

-- Update students table to include Moodle user ID  
ALTER TABLE students
ADD COLUMN IF NOT EXISTS lms_user_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS moodle_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS moodle_last_sync TIMESTAMP;

-- Create Moodle sync log table
CREATE TABLE IF NOT EXISTS moodle_sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL, -- 'courses', 'students', 'enrollments'
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    sync_started_at TIMESTAMP DEFAULT NOW(),
    sync_completed_at TIMESTAMP
);

-- Create Moodle course enrollment mapping
CREATE TABLE IF NOT EXISTS moodle_enrollments (
    id SERIAL PRIMARY KEY,
    moodle_course_id INTEGER NOT NULL,
    moodle_user_id INTEGER NOT NULL,
    local_class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    local_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    enrollment_time TIMESTAMP,
    last_sync TIMESTAMP DEFAULT NOW(),
    UNIQUE(moodle_course_id, moodle_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_lms_course_id ON classes(lms_course_id);
CREATE INDEX IF NOT EXISTS idx_students_lms_user_id ON students(lms_user_id);
CREATE INDEX IF NOT EXISTS idx_moodle_enrollments_course ON moodle_enrollments(moodle_course_id);
CREATE INDEX IF NOT EXISTS idx_moodle_enrollments_user ON moodle_enrollments(moodle_user_id);
CREATE INDEX IF NOT EXISTS idx_moodle_sync_log_type ON moodle_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_moodle_sync_log_status ON moodle_sync_log(status);

-- Function to update Moodle sync timestamp
CREATE OR REPLACE FUNCTION update_moodle_sync_timestamp(table_name TEXT, record_id INTEGER)
RETURNS VOID AS $$
BEGIN
    IF table_name = 'classes' THEN
        UPDATE classes SET moodle_last_sync = NOW() WHERE id = record_id;
    ELSIF table_name = 'students' THEN
        UPDATE students SET moodle_last_sync = NOW() WHERE id = record_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic sync timestamp updates
CREATE OR REPLACE FUNCTION trigger_moodle_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.moodle_last_sync = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'classes_moodle_sync_trigger'
    ) THEN
        CREATE TRIGGER classes_moodle_sync_trigger
            BEFORE UPDATE ON classes
            FOR EACH ROW
            WHEN (OLD.lms_course_id IS DISTINCT FROM NEW.lms_course_id)
            EXECUTE FUNCTION trigger_moodle_sync_timestamp();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'students_moodle_sync_trigger'
    ) THEN
        CREATE TRIGGER students_moodle_sync_trigger
            BEFORE UPDATE ON students
            FOR EACH ROW
            WHEN (OLD.lms_user_id IS DISTINCT FROM NEW.lms_user_id)
            EXECUTE FUNCTION trigger_moodle_sync_timestamp();
    END IF;
END $$;
