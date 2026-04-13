const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all classes
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, u.username as instructor_name,
             (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) as student_count
      FROM classes c 
      LEFT JOIN users u ON c.instructor_id = u.id 
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single class
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*, u.username as instructor_name 
      FROM classes c 
      LEFT JOIN users u ON c.instructor_id = u.id 
      WHERE c.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new class
router.post('/', async (req, res) => {
  try {
    const { code, name, instructor_id } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }
    
    const result = await db.query(
      'INSERT INTO classes (code, name, instructor_id) VALUES ($1, $2, $3) RETURNING *',
      [code, name, instructor_id || null]
    );
    
    console.log(`✓ Class created: ${code} - ${name}`);
    res.json({ success: true, class: result.rows[0] });
  } catch (error) {
    console.error('Class creation error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Class code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Enroll student in class
router.post('/:classId/enroll', async (req, res) => {
  try {
    const { student_id } = req.body;
    const { classId } = req.params;
    
    if (!student_id) {
      return res.status(400).json({ error: 'student_id required' });
    }
    
    // Check if student exists
    const studentCheck = await db.query('SELECT id FROM students WHERE id = $1', [student_id]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    await db.query(
      'INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [classId, student_id]
    );
    
    console.log(`✓ Student ${student_id} enrolled in class ${classId}`);
    res.json({ success: true, message: 'Student enrolled successfully' });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class with attendance data
router.get('/:classId/students', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.student_id, s.name, s.email, s.photo_url, e.enrolled_at,
             COALESCE(
               (SELECT COUNT(*)::float / NULLIF(
                 (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1), 0
               ) * 100 
                FROM attendance a 
                WHERE a.student_id = s.id AND a.class_id = $1 AND a.present = true
               ), 0
             ) as attendance_percentage
      FROM students s 
      JOIN enrollments e ON s.id = e.student_id 
      WHERE e.class_id = $1 
      ORDER BY s.name
    `, [req.params.classId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get schedule for a class
router.get('/:classId/schedule', async (req, res) => {
  try {
    // First try to get from class_schedules table
    const scheduleResult = await db.query(`
      SELECT cs.id, cs.day_of_week, cs.start_time, cs.end_time, cs.scheduled_date, cs.room_number, cs.is_active,
             'scheduled' as source
      FROM class_schedules cs 
      WHERE cs.class_id = $1 AND cs.is_active = true
      ORDER BY cs.day_of_week, cs.start_time
    `, [req.params.classId]);
    
    // If no schedule, fallback to attendance sessions
    if (scheduleResult.rows.length === 0) {
      const attendanceResult = await db.query(`
        SELECT DISTINCT session_date, start_time, end_time,
               (SELECT COUNT(*) FROM attendance a2 WHERE a2.session_date = a1.session_date AND a2.class_id = $1 AND a2.present = true) as attendance_count,
               'attendance' as source
        FROM attendance a1 
        WHERE a1.class_id = $1 
        ORDER BY session_date
      `, [req.params.classId]);
      
      res.json(attendanceResult.rows);
    } else {
      res.json(scheduleResult.rows);
    }
  } catch (error) {
    console.error('Error fetching class schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance data for a class
router.get('/:classId/attendance', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id, a.class_id, a.student_id, a.present, a.session_date, a.method, a.confidence, a.recorded_at,
             s.name as student_name
      FROM attendance a 
      JOIN students s ON a.student_id = s.id 
      WHERE a.class_id = $1 
      ORDER BY a.session_date, a.recorded_at
    `, [req.params.classId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete class
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM classes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ success: true, message: 'Class deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;