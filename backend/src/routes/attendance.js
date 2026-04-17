// =======================================
// 📘 Attendance Routes (Enhanced)
// =======================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// =======================================
// 1️⃣ Record Attendance
// =======================================
router.post('/record', async (req, res) => {
  console.log("📝 Attendance record route hit:", req.originalUrl);
  try {
    const { class_id, student_id, session_date, session_id, method, confidence } = req.body;

    console.log('📥 ATTENDANCE REQUEST:', { 
      class_id, 
      student_id, 
      session_date, 
      session_id,
      method, 
      confidence,
      bodyKeys: Object.keys(req.body)
    });

    if (!class_id || !student_id || (!session_date && !session_id)) {
      console.log('❌ MISSING REQUIRED FIELDS:', { class_id, student_id, session_date, session_id });
      return res.status(400).json({ error: 'class_id, student_id, and either session_date or session_id are required' });
    }

    console.log('📥 Received:', { class_id, student_id, session_date, session_id });

    // Convert string student_id (like "STU001") to numeric database ID
    let numericStudentId;
    
    if (typeof student_id === 'string' && isNaN(student_id)) {
      const lookup = await db.query('SELECT id FROM students WHERE student_id = $1', [student_id]);
      
      if (lookup.rows.length === 0) {
        return res.status(404).json({ error: `Student ${student_id} not found` });
      }
      
      numericStudentId = lookup.rows[0].id;
      console.log(`🔍 ${student_id} → ID: ${numericStudentId}`);
    } else {
      numericStudentId = parseInt(student_id);
    }

    // Check enrollment
    const enrolled = await db.query(
      'SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2',
      [class_id, numericStudentId]
    );

    if (enrolled.rows.length === 0) {
      return res.status(400).json({ error: 'Student not enrolled in this class' });
    }

    // Generate unique session_id if not provided to prevent cross-week duplication
    const uniqueSessionId = session_id || uuidv4();
    
    // Mark attendance (session-scoped when session_id is provided).
    // This fixes cross-session bleed on the same calendar date.
    let result;
    if (uniqueSessionId) {
      // Requires a unique constraint/index for (class_id, student_id, session_id) when session_id is not null.
      result = await db.query(`
        INSERT INTO attendance (class_id, student_id, session_id, session_date, present, method, confidence)
        VALUES ($1, $2, $3, $4, true, $5, $6)
        ON CONFLICT (class_id, student_id, session_id)
        DO UPDATE SET present = true, method = EXCLUDED.method,
                      confidence = GREATEST(attendance.confidence, EXCLUDED.confidence),
                      recorded_at = now()
        RETURNING *;
      `, [
        class_id,
        numericStudentId,
        uniqueSessionId,
        session_date || new Date().toISOString().slice(0, 10),
        method || 'face_recognition',
        confidence || 1.0
      ]);
    } else {
      result = await db.query(`
        INSERT INTO attendance (class_id, student_id, session_date, present, method, confidence)
        VALUES ($1, $2, $3, true, $4, $5)
        ON CONFLICT (class_id, student_id, session_date)
        DO UPDATE SET present = true, method = EXCLUDED.method, 
                      confidence = GREATEST(attendance.confidence, EXCLUDED.confidence),
                      recorded_at = now()
        RETURNING *;
      `, [class_id, numericStudentId, session_date, method || 'face_recognition', confidence || 1.0]);
    }

    console.log(`✅ Marked: ${student_id} (ID: ${numericStudentId})`);
    res.json({ success: true, attendance: result.rows[0] });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Compatibility endpoint expected by deployments/scripts
router.post('/mark', async (req, res) => {
  try {
    const { user_id, course_id, session_date, method, confidence } = req.body;

    if (!user_id || !course_id) {
      return res.status(400).json({ error: 'user_id and course_id are required' });
    }

    const studentLookup = await db.query(
      'SELECT id, student_id, name FROM students WHERE lms_user_id = $1 OR id = $1 LIMIT 1',
      [user_id]
    );
    const classLookup = await db.query(
      'SELECT id, code, name FROM classes WHERE lms_course_id = $1 OR id = $1 LIMIT 1',
      [course_id]
    );

    if (studentLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Student mapping not found for user_id' });
    }
    if (classLookup.rows.length === 0) {
      return res.status(404).json({ error: 'Class mapping not found for course_id' });
    }

    const student = studentLookup.rows[0];
    const cls = classLookup.rows[0];
    const targetDate = session_date || new Date().toISOString().slice(0, 10);

    const result = await db.query(`
      INSERT INTO attendance (class_id, student_id, session_date, present, method, confidence)
      VALUES ($1, $2, $3, true, $4, $5)
      ON CONFLICT (class_id, student_id, session_date)
      DO UPDATE SET
        present = true,
        method = EXCLUDED.method,
        confidence = GREATEST(attendance.confidence, EXCLUDED.confidence),
        recorded_at = now()
      RETURNING *;
    `, [cls.id, student.id, targetDate, method || 'manual', confidence || 1.0]);

    res.json({
      success: true,
      attendance: result.rows[0],
      mapped: {
        class_id: cls.id,
        student_id: student.id,
        class_name: cls.name,
        student_name: student.name
      }
    });
  } catch (error) {
    console.error('Error in /attendance/mark:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/student/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const totalClassesResult = await db.query(
      'SELECT COUNT(DISTINCT session_date) AS total_classes FROM attendance WHERE student_id = $1',
      [studentId]
    );
    const attendedResult = await db.query(
      'SELECT COUNT(*) AS attended_classes FROM attendance WHERE student_id = $1 AND present = true',
      [studentId]
    );
    const recentResult = await db.query(`
      SELECT a.session_date, a.present, a.method, a.recorded_at, c.code as class_code, c.name as class_name
      FROM attendance a
      JOIN classes c ON c.id = a.class_id
      WHERE a.student_id = $1
      ORDER BY a.session_date DESC, a.recorded_at DESC
      LIMIT 20
    `, [studentId]);

    const totalClasses = parseInt(totalClassesResult.rows[0].total_classes || 0, 10);
    const attendedClasses = parseInt(attendedResult.rows[0].attended_classes || 0, 10);

    res.json({
      student_id: studentId,
      total_classes: totalClasses,
      attended_classes: attendedClasses,
      attendance_rate: totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0,
      recent_records: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: error.message });
  }
});


// =======================================
// 2️⃣ Get Attendance for a Class on a Specific Date
// =======================================
router.get('/class/:classId/date/:date', async (req, res) => {
  console.log("📊 Attendance class/date route hit:", req.originalUrl);
  try {
    const { classId, date } = req.params;
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId, 10) : null;
    if (req.query.sessionId && Number.isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    const result = sessionId
      ? await db.query(`
        SELECT 
          s.id, s.student_id, s.name, s.photo_url,
          COALESCE(a.present, false) AS present,
          a.method, a.confidence, a.recorded_at
        FROM students s
        JOIN enrollments e ON s.id = e.student_id
        LEFT JOIN attendance a 
          ON a.student_id = s.id 
          AND a.class_id = $1 
          AND a.session_id = $2
        WHERE e.class_id = $1
        ORDER BY s.name;
      `, [classId, sessionId])
      : await db.query(`
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
// 📊 Get Attendance Session Analytics
// =======================================
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session details
    const sessionResult = await db.query(`
      SELECT cs.*, c.code as class_code, c.name as class_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.id = $1
    `, [sessionId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get attendance records for this session
    const sessionDate = session.scheduled_date || new Date().toISOString().slice(0, 10);
    const recordsResult = await db.query(`
      SELECT 
        s.student_id,
        s.name as student_name,
        COALESCE(a.present, false) as present,
        COALESCE(a.method, 'manual') as method,
        COALESCE(a.recorded_at, NOW()) as timestamp
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      LEFT JOIN attendance a ON a.student_id = s.id 
        AND a.class_id = $1
        AND a.session_date = $2
      WHERE e.class_id = $1
      ORDER BY s.name
    `, [session.class_id, sessionDate]);

    const records = recordsResult.rows;
    const stats = {
      total: records.length,
      present: records.filter(r => r.present).length,
      absent: records.filter(r => !r.present).length,
      percentage: records.length > 0 ? 
        Math.round((records.filter(r => r.present).length / records.length) * 100) : 0
    };

    res.json({
      session: {
        id: session.id,
        class_name: session.class_name,
        class_code: session.class_code,
        session_date: sessionDate,
        start_time: session.start_time,
        end_time: session.end_time,
        room_number: session.room_number
      },
      stats,
      records: records.map(record => ({
        student_id: record.student_id,
        student_name: record.student_name,
        status: record.present ? 'present' : 'absent',
        method: record.method,
        timestamp: record.timestamp
      }))
    });

  } catch (error) {
    console.error('Error fetching session analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/session/:sessionId/records', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionResult = await db.query(
      'SELECT id, class_id, scheduled_date FROM class_schedules WHERE id = $1',
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const sessionDate = session.scheduled_date || new Date().toISOString().slice(0, 10);
    const recordsResult = await db.query(`
      SELECT 
        s.student_id,
        s.name as student_name,
        COALESCE(a.present, false) as present,
        COALESCE(a.method, 'manual') as method,
        COALESCE(a.recorded_at, NOW()) as timestamp
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      LEFT JOIN attendance a ON a.student_id = s.id
        AND a.class_id = $1
        AND a.session_date = $2
      WHERE e.class_id = $1
      ORDER BY s.name
    `, [session.class_id, sessionDate]);

    const records = recordsResult.rows.map((record) => ({
      student_id: record.student_id,
      student_name: record.student_name,
      status: record.present ? 'present' : 'absent',
      method: record.method,
      timestamp: record.timestamp
    }));

    const present = records.filter((r) => r.status === 'present').length;
    const total = records.length;

    res.json({
      records,
      stats: {
        total,
        present,
        absent: total - present,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching session records:', error);
    res.status(500).json({ error: error.message });
  }
});

// =======================================
// 4️⃣ Get Attendance for a Specific Student
// =======================================
router.get('/student/:studentId', async (req, res) => {
  console.log("👤 Student attendance route hit:", req.originalUrl);
  try {
    const { studentId } = req.params;
    
    // Convert string student_id to numeric database ID if needed
    let numericStudentId;
    if (typeof studentId === 'string' && isNaN(studentId)) {
      const lookup = await db.query('SELECT id FROM students WHERE student_id = $1', [studentId]);
      if (lookup.rows.length === 0) {
        return res.status(404).json({ error: `Student ${studentId} not found` });
      }
      numericStudentId = lookup.rows[0].id;
    } else {
      numericStudentId = parseInt(studentId);
    }
    
    const result = await db.query(`
      SELECT 
        a.id,
        a.class_id,
        a.session_date,
        a.present,
        a.method,
        a.confidence,
        a.recorded_at,
        c.code as class_code,
        c.name as class_name,
        s.name as student_name
      FROM attendance a
      JOIN classes c ON c.id = a.class_id
      JOIN students s ON s.id = a.student_id
      WHERE a.student_id = $1
      ORDER BY a.session_date DESC, a.recorded_at DESC
    `, [numericStudentId]);
    
    // Calculate attendance statistics
    const totalSessions = result.rows.length;
    const presentSessions = result.rows.filter(r => r.present).length;
    const attendanceRate = totalSessions > 0 ? (presentSessions / totalSessions * 100).toFixed(2) : 0;
    
    res.json({
      attendance: result.rows,
      stats: {
        total_sessions: totalSessions,
        present_sessions: presentSessions,
        attendance_rate: parseFloat(attendanceRate)
      }
    });
    
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// =======================================
// ✅ Export Routes
// =======================================
module.exports = router;
