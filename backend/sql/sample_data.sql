-- Sample data for testing attendance flow

-- Insert sample schedules for class 1
INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, room_number, is_active)
VALUES 
  (1, 1, '09:00', '10:30', 'A101', true),  -- Monday
  (1, 1, '11:00', '12:30', 'A101', true),  -- Monday second session
  (1, 2, '09:00', '10:30', 'B202', true),  -- Tuesday
  (1, 3, '09:00', '10:30', 'A101', true),  -- Wednesday
  (1, 4, '09:00', '10:30', 'B202', true),  -- Thursday
  (1, 5, '09:00', '10:30', 'A101', true);  -- Friday

-- Insert some sample enrollments for class 1
INSERT INTO enrollments (class_id, student_id)
SELECT 1, id FROM students LIMIT 5;

-- Set specific dates for today's sessions
UPDATE class_schedules 
SET scheduled_date = CURRENT_DATE 
WHERE class_id = 1 AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE);

SELECT 'Sample data inserted successfully!' as message;
