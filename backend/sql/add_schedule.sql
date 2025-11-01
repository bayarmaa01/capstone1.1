-- Create class_schedules table
CREATE TABLE IF NOT EXISTS class_schedules (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    scheduled_date DATE, -- optional specific date (useful for one-off sessions)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number VARCHAR(50),
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, day_of_week, start_time, scheduled_date)
);

COMMENT ON COLUMN class_schedules.day_of_week IS '0=Sunday,1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday';

-- Holidays table (optional - prevents auto-absent on holiday)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    holiday_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add status, notes, marked_at columns to existing attendance (if not present)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present','absent','late','excused'));
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
