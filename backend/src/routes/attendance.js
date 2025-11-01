// =======================================
// 📘 Attendance Routes (Enhanced)
// =======================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// =======================================
// 1️⃣ Record Attendance
// =======================================
router.post('/record', async (req, res) => {
  try {
    const { class_id, student_id, session_date, method, confidence } = req.body;

    if (!class_id || !student_id || !session_date) {
      return res.status(400).json({ error: 'class_id, student_id, and session_date are required' });
    }

    // Insert or update attendance — prevents duplicates
    const result = await db.query(`
      INSERT INTO attendance (class_id, student_id, session_date, present, method, confidence)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT (class_id, student_id, session_date)
      DO UPDATE SET 
        present = true,
        method = COALESCE(EXCLUDED.method, attendance.method),
        confidence = GREATEST(attendance.confidence, EXCLUDED.confidence),
        recorded_at = now()
      RETURNING *;
    `, [class_id, student_id, session_date, method || 'manual', confidence || 1.0]);

    console.log(`✅ Attendance recorded: Student ${student_id} | Class ${class_id} | Date ${session_date}`);
    res.json({ success: true, attendance: result.rows[0] });

  } catch (error) {
    console.error('❌ Attendance recording error:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 2️⃣ Get Attendance for a Class on a Specific Date
// =======================================
router.get('/class/:classId/date/:date', async (req, res) => {
  try {
    const { classId, date } = req.params;

    const result = await db.query(`
      SELECT 
        s.id, s.student_id, s.name, s.photo_url,
        COALESCE(a.present, false) AS present,
        a.method, a.confidence, a.recorded_at
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN attendance a 
        ON a.student_id = s.id 
        AND a.class_id = $1 
        AND a.session_date = $2
      WHERE e.class_id = $1
      ORDER BY s.name;
    `, [classId, date]);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error fetching attendance by date:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 3️⃣ Get Class Attendance Statistics
// =======================================
router.get('/class/:classId/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id, s.student_id, s.name, s.email,
        COUNT(CASE WHEN a.present = true THEN 1 END) AS total_present,
        (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) AS total_sessions,
        CASE 
          WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) = 0 THEN 0
          ELSE ROUND(
            ((COUNT(CASE WHEN a.present = true THEN 1 END)::float /
              (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1)) * 100)::numeric,
            2
          )
        END AS attendance_percentage
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = $1
      WHERE e.class_id = $1
      GROUP BY s.id, s.student_id, s.name, s.email
      ORDER BY attendance_percentage DESC NULLS LAST, s.name;
    `, [req.params.classId]);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 4️⃣ Filter Students Above 75% Attendance
// =======================================
router.get('/class/:classId/stats/above75', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id, s.student_id, s.name, s.email,
        COUNT(CASE WHEN a.present = true THEN 1 END) AS total_present,
        (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) AS total_sessions,
        CASE 
          WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) = 0 THEN 0
          ELSE ROUND(
            ((COUNT(CASE WHEN a.present = true THEN 1 END)::float /
              (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1)) * 100)::numeric,
            2
          )
        END AS attendance_percentage
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN attendance a ON a.student_id = s.id AND a.class_id = $1
      WHERE e.class_id = $1
      GROUP BY s.id, s.student_id, s.name, s.email
      HAVING 
        (CASE 
          WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1) = 0 THEN 0
          ELSE ROUND(
            ((COUNT(CASE WHEN a.present = true THEN 1 END)::float /
              (SELECT COUNT(DISTINCT session_date) FROM attendance WHERE class_id = $1)) * 100)::numeric,
            2
          )
        END) >= 75
      ORDER BY attendance_percentage DESC, s.name;
    `, [req.params.classId]);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error fetching students above 75%:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 5️⃣ Get Attendance Dates for a Class
// =======================================
router.get('/class/:classId/dates', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT session_date,
             COUNT(*) AS present_count,
             (SELECT COUNT(*) FROM enrollments WHERE class_id = $1) AS total_students
      FROM attendance 
      WHERE class_id = $1 AND present = true
      GROUP BY session_date
      ORDER BY session_date DESC;
    `, [req.params.classId]);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Error fetching attendance dates:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 6️⃣ Health Check (optional for debugging)
// =======================================
router.get('/health', (req, res) => {
  res.json({ status: 'ok', route: 'attendance', timestamp: new Date() });
});


// =======================================
// ✅ Export Routes
// =======================================
module.exports = router;
