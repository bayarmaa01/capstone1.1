const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const jwt = require('jsonwebtoken');

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

// JWT Verification Middleware
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_this');
    
    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Apply auth middleware to all routes
router.use(authenticateToken);

// GET /api/moodle-schedule - Fetch teacher's Moodle schedule
router.get('/', async (req, res) => {
  try {
    // Get authenticated user from middleware
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    // Query teacher's Moodle sessions with correct Moodle context and time conversion
    const query = `
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
      WHERE EXISTS (
        SELECT 1 
        FROM mdl_role_assignments ra
        JOIN mdl_context ctx ON ra.contextid = ctx.id
        WHERE ra.userid = ? 
        AND ctx.contextlevel = 50
        AND ctx.instanceid = c.id
        AND ra.roleid IN (3, 4)  -- Teacher roles
      )
      ORDER BY s.sessdate ASC
    `;
    
    let connection;
    try {
      connection = await moodlePool.getConnection();
      const [rows] = await connection.execute(query, [userId]);
      
      if (!rows || !rows.length) {
        console.log('No Moodle sessions found for teacher:', userId);
        return res.json({ success: true, data: [] });
      }
      
      console.log(`✓ Retrieved ${rows.length} Moodle sessions for teacher ${userId}`);
      res.json({ 
        success: true, 
        data: rows 
      });
    } catch (error) {
      console.error('Moodle schedule fetch error:', error);
      
      // Never crash - always return safe response
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch schedule',
        data: [] 
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Moodle schedule fetch error:', error);
    
    // Never crash - always return safe response
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch schedule',
      data: [] 
    });
  }
});

// POST /api/attendance/check
router.post('/check', async (req, res) => {
  try {
    const { studentId, sessionId } = req.body;
    
    if (!studentId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and Session ID required'
      });
    }
    
    let connection;
    try {
      connection = await moodlePool.getConnection();
      
      const query = `
        SELECT * FROM mdl_attendance_log 
        WHERE studentid = ? 
        AND sessionid = ? 
        AND WEEK(FROM_UNIXTIME(timetaken)) = WEEK(NOW())
      `;
      
      const [rows] = await connection.execute(query, [studentId, sessionId]);
      
      if (rows.length > 0) {
        res.json({
          success: true,
          data: {
            alreadyMarked: true,
            attendance: rows[0]
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            alreadyMarked: false,
            canMark: true
          }
        });
      }
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
  } catch (error) {
    console.error('Attendance check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check attendance'
    });
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
    
    if (!studentId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID and Session ID required'
      });
    }
    
    let connection;
    try {
      connection = await moodlePool.getConnection();
      
      // Check if already marked
      const checkQuery = `
        SELECT id FROM mdl_attendance_log 
        WHERE studentid = ? 
        AND sessionid = ? 
        AND WEEK(FROM_UNIXTIME(timetaken)) = WEEK(NOW())
      `;
      
      const [checkRows] = await connection.execute(checkQuery, [studentId, sessionId]);
      
      if (checkRows.length > 0) {
        return res.json({
          success: false,
          error: 'Attendance already marked for this session'
        });
      }
      
      // Mark attendance
      const insertQuery = `
        INSERT INTO mdl_attendance_log (studentid, sessionid, timetaken, statusid, takenbyid)
        VALUES (?, ?, NOW(), 1, ?)
      `;
      
      await connection.execute(insertQuery, [studentId, sessionId, req.user?.id || 1]);
      
      console.log(`✓ Attendance marked: Student ${studentId}, Session ${sessionId}`);
      res.json({
        success: true,
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
  } catch (error) {
    console.error('Attendance mark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance'
    });
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
