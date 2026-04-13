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

// Get schedule for a class (with Moodle integration)
router.get('/:classId/schedule', async (req, res) => {
  try {
    let scheduleData = [];
    
    // First try to get from Moodle
    try {
      const mysql = require('mysql2/promise');
      const moodleDbConfig = {
        host: process.env.MOODLE_DB_HOST || 'moodle-db',
        user: process.env.MOODLE_DB_USER || 'moodle',
        password: process.env.MOODLE_DB_PASSWORD || 'moodle_secret',
        database: process.env.MOODLE_DB_NAME || 'moodle',
        port: process.env.MOODLE_DB_PORT || 3306
      };
      const moodlePool = mysql.createPool(moodleDbConfig);
      const connection = await moodlePool.getConnection();
      
      const [moodleRows] = await connection.execute(`
        SELECT 
          s.id AS sessionId,
          s.sessdate,
          s.duration,
          c.fullname AS course,
          FROM_UNIXTIME(s.sessdate) AS session_date,
          FROM_UNIXTIME(s.sessdate) AS start_time,
          FROM_UNIXTIME(s.sessdate + s.duration) AS end_time,
          DAYOFWEEK(FROM_UNIXTIME(s.sessdate)) AS day_of_week,
          DATE_FORMAT(FROM_UNIXTIME(s.sessdate), '%H:%i') AS start_time_formatted,
          DATE_FORMAT(FROM_UNIXTIME(s.sessdate + s.duration), '%H:%i') AS end_time_formatted
        FROM mdl_attendance_sessions s
        JOIN mdl_attendance a ON a.id = s.attendanceid
        JOIN mdl_course c ON c.id = a.course
        WHERE c.idnumber = (SELECT code FROM classes WHERE id = ?)
        ORDER BY s.sessdate ASC
      `, [req.params.classId]);
      
      if (moodleRows.length > 0) {
        scheduleData = moodleRows.map(session => ({
          id: session.sessionId,
          day_of_week: session.day_of_week,
          start_time: session.start_time_formatted,
          end_time: session.end_time_formatted,
          scheduled_date: session.session_date,
          source: 'moodle'
        }));
        console.log('Using Moodle schedule:', scheduleData.length, 'sessions');
      }
      
      connection.release();
    } catch (moodleError) {
      console.log('Moodle schedule failed, using local schedule');
    }

    // Fallback to local schedule if Moodle fails or empty
    if (scheduleData.length === 0) {
      const scheduleResult = await db.query(`
        SELECT cs.id, cs.day_of_week, cs.start_time, cs.end_time, cs.scheduled_date, cs.room_number, cs.is_active,
               'scheduled' as source
        FROM class_schedules cs 
        WHERE cs.class_id = $1 AND cs.is_active = true
        ORDER BY cs.day_of_week, cs.start_time
      `, [req.params.classId]);
      
      if (scheduleResult.rows.length > 0) {
        scheduleData = scheduleResult.rows.map(session => ({
          ...session,
          source: 'manual'
        }));
        console.log('Using local schedule:', scheduleData.length, 'sessions');
      }
    }

    // If still no schedule, fallback to attendance sessions
    if (scheduleData.length === 0) {
      const attendanceResult = await db.query(`
        SELECT DISTINCT session_date, start_time, end_time,
               (SELECT COUNT(*) FROM attendance a2 WHERE a2.session_date = a1.session_date AND a2.class_id = $1 AND a2.present = true) as attendance_count,
               'attendance' as source
        FROM attendance a1 
        WHERE a1.class_id = $1 
        ORDER BY session_date
      `, [req.params.classId]);
      
      scheduleData = attendanceResult.rows;
      console.log('Using attendance sessions:', scheduleData.length, 'sessions');
    }
    
    res.json(scheduleData);
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