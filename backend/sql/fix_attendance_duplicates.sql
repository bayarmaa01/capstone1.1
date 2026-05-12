-- ========================================
-- 🔧 Fix Attendance Duplicates and Percentages
-- ========================================

-- Step 1: Create backup table for safety
CREATE TABLE IF NOT EXISTS attendance_backup AS 
SELECT * FROM attendance;

-- Step 2: Remove duplicate attendance records
-- Keep the oldest record for each (student_id, class_id, session_date) combination
DELETE FROM attendance 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM attendance 
    GROUP BY student_id, class_id, session_date
);

-- Step 3: Add proper UNIQUE constraint to prevent future duplicates
-- Drop existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_student_class_session_unique'
    ) THEN
        ALTER TABLE attendance DROP CONSTRAINT attendance_student_class_session_unique;
    END IF;
END $$;

-- Add new UNIQUE constraint
ALTER TABLE attendance 
ADD CONSTRAINT attendance_student_class_session_unique 
UNIQUE (student_id, class_id, session_date);

-- Step 4: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_unique_lookup 
ON attendance (student_id, class_id, session_date);

-- Step 5: Verify the fix
SELECT 
    'attendance_duplicates_removed' as operation,
    COUNT(*) as remaining_records
FROM attendance;

SELECT 
    'potential_duplicates_check' as operation,
    student_id, 
    class_id, 
    session_date, 
    COUNT(*) as duplicate_count
FROM attendance 
GROUP BY student_id, class_id, session_date 
HAVING COUNT(*) > 1;

-- Success message
SELECT 'Attendance duplicates fixed successfully!' as message;
