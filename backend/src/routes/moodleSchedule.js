const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Moodle database connection
const moodleDbConfig = {
  host: process.env.MOODLE_DB_HOST || 'moodle-db',
  user: process.env.MOODLE_DB_USER || 'moodle',
  password: process.env.MOODLE_DB_PASSWORD || 'moodle_secret',
  database: process.env.MOODLE_DB_NAME || 'moodle',
  port: process.env.MOODLE_DB_PORT || 3306
};

// Create Moodle database connection pool
const moodlePool = mysql.createPool({
  ...moodleDbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// GET /api/moodle-schedule
router.get('/', async (req, res) => {
  let connection;
  try {
    connection = await moodlePool.getConnection();
    
    // Exact SQL query as specified
    const query = `
      SELECT
        s.id AS sessionId,
        s.sessdate,
        s.duration,
        a.course
      FROM mdl_attendance_sessions s
      JOIN mdl_attendance a ON a.id = s.attendanceid
      ORDER BY s.sessdate DESC
      LIMIT 50
    `;
    
    const [rows] = await connection.execute(query);
    
    res.json({
      success: true,
      data: rows
    });
    
  } catch (error) {
    console.error('Moodle schedule fetch error:', error);
    res.json({
      success: false,
      data: []
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/attendance/check
router.post('/check', async (req, res) => {
  const { studentId, sessionId } = req.body;
  
  if (!studentId || !sessionId) {
    return res.status(400).json({
      success: false,
      error: 'studentId and sessionId are required'
    });
  }
  
  let connection;
  try {
    connection = await moodlePool.getConnection();
    
    // Exact SQL query as specified
    const query = `
      SELECT * FROM mdl_attendance_log
      WHERE studentid = ?
      AND sessionid = ?
      AND WEEK(FROM_UNIXTIME(timetaken)) = WEEK(NOW())
      LIMIT 1
    `;
    
    const [rows] = await connection.execute(query, [studentId, sessionId]);
    
    res.json({
      allowed: rows.length === 0
    });
    
  } catch (error) {
    console.error('Attendance check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check attendance'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/attendance/mark
router.post('/mark', async (req, res) => {
  const { studentId, sessionId } = req.body;
  
  if (!studentId || !sessionId) {
    return res.status(400).json({
      success: false,
      error: 'studentId and sessionId are required'
    });
  }
  
  let connection;
  try {
    connection = await moodlePool.getConnection();
    
    // Check if already marked
    const checkQuery = `
      SELECT id FROM mdl_attendance_log
      WHERE studentid = ? AND sessionid = ?
    `;
    
    const [existingRows] = await connection.execute(checkQuery, [studentId, sessionId]);
    
    if (existingRows.length > 0) {
      return res.json({
        success: false,
        error: 'Attendance already marked for this session'
      });
    }
    
    // Exact SQL query as specified
    const insertQuery = `
      INSERT INTO mdl_attendance_log
      (sessionid, studentid, statusid, timetaken)
      VALUES (?, ?, 1, UNIX_TIMESTAMP())
    `;
    
    const [result] = await connection.execute(insertQuery, [
      sessionId, 
      studentId
    ]);
    
    res.json({
      success: true,
      attendanceId: result.insertId,
      message: 'Attendance marked successfully'
    });
    
  } catch (error) {
    console.error('Attendance mark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET /api/moodle-schedule/health
router.get('/health', async (req, res) => {
  let connection;
  try {
    connection = await moodlePool.getConnection();
    await connection.ping();
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'moodle',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
