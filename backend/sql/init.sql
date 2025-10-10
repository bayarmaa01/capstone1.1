-- Create tables for attendance system

-- Users table (teachers/admins)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMP DEFAULT now()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  instructor_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Enrollments (which students are in which classes)
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id) ON DELETE CASCADE,
  student_id INT REFERENCES students(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  present BOOLEAN DEFAULT true,
  method TEXT CHECK (method IN ('qr', 'face', 'manual')),
  confidence FLOAT DEFAULT 1.0,
  recorded_at TIMESTAMP DEFAULT now(),
  UNIQUE(class_id, student_id, session_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(session_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);

-- Insert a default admin user
-- Username: admin
-- Password: admin123
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$TvD0sEYySdWLPCrOLDUckOD23EiBTbiggQdG05zjyWyYciNBl4vpK', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Log completion
SELECT 'Database schema initialized successfully!' as message;