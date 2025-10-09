const express = require('express');
const router = express.Router();
const db = require('../db');

// Record attendance (prevents duplicates)
router.post('/record', async (req, res) => {
  try {
    const { class_id, student_id, session_date, method, confidence } = req.body;
    
    if (!class_id || !student_id || !session_date) {
      return res.status(400).json({ error: 'class_id, student_id, and session_date are required' });
    }
    
    // Insert or update attendance (unique constraint prevents duplicates)
    const result = await db.query(`
      INSERT INTO attendance (class_id, student_id, session_date, present, method, confidence)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT (class_id, student_id, session_date) 
      DO UPDATE SET 
        present = true,
        method = COALESCE(EXCLUDED.method, attendance.method),
        confidence = GREATEST(attendance.confidence, EXCLUDED.confidence),
        recorded_at = now()
      RETURNING *
    `, [class_id, student_id, session_date, method || 'manual', confidence || 1.0]);
    
    console.log(`✓ Attendance recorded: Student ${student_id} in class ${class_id} on ${session_date}`);
    res.json({ success: true, attendance: result.rows[0] });
  } catch (error) {
    console.error('Attendance recording error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance for a class on a specific date
router.get('/class/:classId/date/:date', async (req, res) => {
  try {
    const { classId, date } = req.params;
    
    const result = await db.query(`
      SELECT s.id, s.student_id, s.name, s.photo_url,
             COALESCE(a.present, false) as present,
             a.method, a.confidence, a.recorded_at
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN attendance a ON a.student_id = s.id 
        AND a.class_id = $1 
        AND a.session_date = $2
      WHERE e.class_id = $1
      ORDER BY s.name
    `, [classId, date]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get attendance statistics for a class
router.get('/class/:classId/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id, s.student_id, s.name, s.email,
        COUNT(CASE WHEN a.present = true THEN 1 END) as total_present,
        (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) as total_sessions,
        CASE 
          WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) = 0 THEN 0
          ELSE ROUND(
            (COUNT(CASE WHEN a.present = true THEN 1 END)::float / 
            (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1)) * 100,
            2
          )
        END as attendance_percentage
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = $1
      WHERE e.class_id = $1
      GROUP BY s.id, s.student_id, s.name, s.email
      ORDER BY attendance_percentage DESC NULLS LAST, s.name
    `, [req.params.classId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all attendance dates for a class
router.get('/class/:classId/dates', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT session_date, 
             COUNT(*) as present_count,
             (SELECT COUNT(*) FROM enrollments WHERE class_id = $1) as total_students
      FROM attendance 
      WHERE class_id = $1 AND present = true
      GROUP BY session_date
      ORDER BY session_date DESC
    `, [req.params.classId]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;