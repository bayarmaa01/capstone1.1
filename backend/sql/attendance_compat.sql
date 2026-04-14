-- Compatibility migration for attendance mark API usage
-- Keeps existing class_id/student_id flow intact while supporting user_id/course_id payloads.

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  class_id INT,
  student_id INT,
  session_date DATE DEFAULT CURRENT_DATE,
  present BOOLEAN DEFAULT true,
  method TEXT DEFAULT 'manual',
  confidence FLOAT DEFAULT 1.0,
  recorded_at TIMESTAMP DEFAULT now()
);

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS user_id INT,
  ADD COLUMN IF NOT EXISTS course_id INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
