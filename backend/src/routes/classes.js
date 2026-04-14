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
router.post('/:classId/students', async (req, res) => {
  try {
    const { studentId } = req.body;
    const { classId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    
    // Check if class exists
    const classCheck = await db.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if student exists
    const studentCheck = await db.query('SELECT id, name FROM students WHERE id = $1', [studentId]);
    if (studentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if already enrolled
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollments WHERE class_id = $1 AND student_id = $2',
      [classId, studentId]
    );
    if (enrollmentCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Student already enrolled in this class' });
    }
    
    // Enroll student
    const result = await db.query(
      'INSERT INTO enrollments (class_id, student_id) VALUES ($1, $2) RETURNING *',
      [classId, studentId]
    );
    
    const studentName = studentCheck.rows[0].name;
    console.log(`Student ${studentName} (ID: ${studentId}) enrolled in class ${classId}`);
    
    res.json({ 
      success: true, 
      message: 'Student enrolled successfully',
      enrollment: result.rows[0],
      student: { id: studentId, name: studentName }
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Student already enrolled in this class' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Remove student from class
router.delete('/:classId/students/:studentId', async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    
    // Check if enrollment exists
    const enrollmentCheck = await db.query(`
      SELECT e.id, s.name as student_name, c.name as class_name
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN classes c ON e.class_id = c.id
      WHERE e.class_id = $1 AND e.student_id = $2
    `, [classId, studentId]);
    
    if (enrollmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not enrolled in this class' });
    }
    
    const enrollment = enrollmentCheck.rows[0];
    
    // Remove enrollment
    await db.query('DELETE FROM enrollments WHERE class_id = $1 AND student_id = $2', [classId, studentId]);
    
    console.log(`Student ${enrollment.student_name} (ID: ${studentId}) removed from class ${enrollment.class_name} (ID: ${classId})`);
    
    res.json({ 
      success: true, 
      message: 'Student removed from class successfully',
      student: { id: studentId, name: enrollment.student_name }
    });
  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create class schedule
router.post('/schedule', async (req, res) => {
  try {
    const { class_id, day_of_week, start_time, end_time, room_number, scheduled_date } = req.body;
    
    if (!class_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ 
        error: 'class_id, day_of_week, start_time, and end_time are required' 
      });
    }
    
    // Validate day_of_week
    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' });
    }
    
    // Validate time format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({ error: 'start_time and end_time must be in HH:MM format' });
    }
    
    // Check if class exists
    const classCheck = await db.query('SELECT id, name FROM classes WHERE id = $1', [class_id]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check for duplicate schedule (same class, day, and time)
    const duplicateCheck = await db.query(`
      SELECT id FROM class_schedules 
      WHERE class_id = $1 AND day_of_week = $2 AND start_time = $3 AND is_active = true
    `, [class_id, day_of_week, start_time]);
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Schedule already exists for this day and time' });
    }
    
    // Create schedule
    const result = await db.query(`
      INSERT INTO class_schedules 
      (class_id, day_of_week, start_time, end_time, room_number, scheduled_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [class_id, day_of_week, start_time, end_time, room_number || null, scheduled_date || null]);
    
    const schedule = result.rows[0];
    const className = classCheck.rows[0].name;
    
    console.log(`Schedule created for class ${className} (ID: ${class_id}) - Day ${day_of_week}, ${start_time}-${end_time}`);
    
    res.json({ 
      success: true, 
      message: 'Schedule created successfully',
      schedule: schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete class schedule (only local schedules, not Moodle)
router.delete('/:classId/schedule/:scheduleId', async (req, res) => {
  try {
    const { classId, scheduleId } = req.params;
    
    if (!classId || !scheduleId) {
      return res.status(400).json({ 
        error: 'classId and scheduleId are required' 
      });
    }
    
    // Check if schedule exists and get its details
    const scheduleCheck = await db.query(`
      SELECT id, class_id, source FROM class_schedules 
      WHERE id = $1 AND class_id = $2
    `, [scheduleId, classId]);
    
    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const schedule = scheduleCheck.rows[0];
    
    // Prevent deletion of Moodle schedules
    if (schedule.source === 'moodle') {
      return res.status(403).json({ 
        error: 'Cannot delete Moodle schedules - they are managed by the LMS' 
      });
    }
    
    // Delete the schedule
    await db.query('DELETE FROM class_schedules WHERE id = $1 AND class_id = $2', [scheduleId, classId]);
    
    console.log(`Local schedule deleted - Class: ${classId}, Schedule: ${scheduleId}`);
    
    res.json({ 
      success: true, 
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
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
    const { classId } = req.params;
    let scheduleData = [];
    
    // Try to get from Moodle first (read-only LMS sessions)
    try {
      console.log('Attempting Moodle schedule query...');
      const mysql = require('mysql2/promise');
      const moodleDbConfig = {
        host: process.env.MOODLE_DB_HOST || 'moodle-db',
        user: process.env.MOODLE_DB_USER || 'moodle',
        password: process.env.MOODLE_DB_PASSWORD || 'moodle_secret',
        database: process.env.MOODLE_DB_NAME || 'moodle',
        port: process.env.MOODLE_DB_PORT || 3306
      };
      console.log('Moodle DB config:', moodleDbConfig);
      const moodlePool = mysql.createPool(moodleDbConfig);
      const connection = await moodlePool.getConnection();
      console.log('Moodle connection established');
      
      // Resolve LMS course id for this class (if available)
      const classMeta = await db.query(
        'SELECT lms_course_id FROM classes WHERE id = $1',
        [classId]
      );
      const lmsCourseId = classMeta.rows[0]?.lms_course_id || null;

      // Simplified query - get all Moodle sessions
      const [moodleRows] = await connection.execute(`
        SELECT 
          s.id AS sessionId,
          a.course AS course_id,
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
        ${lmsCourseId ? 'WHERE a.course = ?' : ''}
        ORDER BY s.sessdate ASC
      `, lmsCourseId ? [lmsCourseId] : []);
      
      console.log("Moodle sessions query successful:", moodleRows.length);
      console.log("Sample Moodle session:", moodleRows[0]);
      
      if (moodleRows.length > 0) {
        const moodleSchedule = moodleRows.map(session => ({
          id: session.sessionId,
          class_id: parseInt(classId, 10),
          day_of_week: session.day_of_week,
          start_time: session.start_time_formatted,
          end_time: session.end_time_formatted,
          scheduled_date: session.session_date,
          room_number: 'TBD',
          is_active: true,
          source: 'moodle',
          readonly: true
        }));
        scheduleData = scheduleData.concat(moodleSchedule);
        console.log('Using Moodle schedule:', moodleSchedule.length, 'sessions');
      }
      
      connection.release();
    } catch (moodleError) {
      console.error('Moodle schedule error:', moodleError);
      console.log('Continuing with local schedule due to Moodle error');
    }

    // Always include local/manual schedule entries
    try {
      const scheduleResult = await db.query(`
        SELECT cs.id, cs.day_of_week, cs.start_time, cs.end_time, cs.scheduled_date, cs.room_number, cs.is_active,
               'manual' as source
        FROM class_schedules cs 
        WHERE cs.class_id = $1 AND cs.is_active = true
        ORDER BY cs.day_of_week, cs.start_time
      `, [classId]);
      
      if (scheduleResult.rows.length > 0) {
        scheduleData = scheduleData.concat(scheduleResult.rows);
        console.log('Using local schedule:', scheduleResult.rows.length, 'sessions');
      }
    } catch (localError) {
      console.error('Local schedule error:', localError);
    }
    
    // Keep output stable for the dashboard
    scheduleData.sort((a, b) => {
      const aDate = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const bDate = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;
      return String(a.start_time || '').localeCompare(String(b.start_time || ''));
    });
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