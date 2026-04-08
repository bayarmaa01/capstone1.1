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
    
    const query = `
      SELECT 
        s.id AS sessionId,
        FROM_UNIXTIME(s.sessdate) AS date,
        a.course,
        a.name AS sessionName,
        s.description,
        s.duration,
        s.timemodified,
        c.fullname AS courseName,
        c.shortname AS courseCode
      FROM mdl_attendance_sessions s
      JOIN mdl_attendance a ON a.id = s.attendanceid
      JOIN mdl_course c ON c.id = a.course
      WHERE s.sessdate <= UNIX_TIMESTAMP()
        AND s.sessdate + s.duration >= UNIX_TIMESTAMP()
      ORDER BY s.sessdate DESC
      LIMIT 50
    `;
    
    const [rows] = await connection.execute(query);
    
    // Format the data to match manual schedule structure
    const formattedData = rows.map(row => ({
      id: row.sessionId,
      sessionId: row.sessionId,
      date: row.date,
      course: row.course,
      courseName: row.courseName,
      courseCode: row.courseCode,
      sessionName: row.sessionName,
      description: row.description,
      duration: row.duration,
      timemodified: row.timemodified,
      source: 'moodle',
      // Extract day and time from date
      day: new Date(row.date).getDay(),
      time: new Date(row.date).toTimeString().slice(0, 5),
      room: row.description ? extractRoomFromDescription(row.description) : 'TBD',
      teacher: 'Moodle Instructor' // Could be fetched from mdl_user if needed
    }));
    
    res.json({
      success: true,
      data: formattedData,
      total: formattedData.length,
      source: 'moodle'
    });
    
  } catch (error) {
    console.error('Moodle schedule fetch error:', error);
    res.json({
      success: false,
      data: [],
      error: 'Failed to fetch Moodle schedule',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Helper function to extract room from description
function extractRoomFromDescription(description) {
  if (!description) return 'TBD';
  
  // Look for room patterns like "Room: A101", "Room A101", "A101"
  const roomPatterns = [
    /(?:room|class)\s*[:\-]?\s*([A-Z]\d{3})/i,
    /([A-Z]\d{3})/,
    /(?:room|class)\s*[:\-]?\s*([A-Z]+\d+)/i
  ];
  
  for (const pattern of roomPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return 'TBD';
}

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
    
    const query = `
      SELECT * FROM mdl_attendance_log
      WHERE studentid = ?
      AND sessionid = ?
      AND WEEK(FROM_UNIXTIME(timetaken)) = WEEK(NOW())
      ORDER BY timetaken DESC
      LIMIT 1
    `;
    
    const [rows] = await connection.execute(query, [studentId, sessionId]);
    
    res.json({
      success: true,
      attended: rows.length > 0,
      attendance: rows.length > 0 ? rows[0] : null,
      source: 'moodle'
    });
    
  } catch (error) {
    console.error('Moodle attendance check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check attendance',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// POST /api/attendance/mark
router.post('/mark', async (req, res) => {
  const { studentId, sessionId, statusId = 1, remarks = 'Marked via automated system' } = req.body;
  
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
        error: 'Attendance already marked for this session',
        existing: existingRows[0]
      });
    }
    
    // Insert attendance record
    const insertQuery = `
      INSERT INTO mdl_attendance_log 
      (sessionid, studentid, statusid, timetaken, takenby, remarks)
      VALUES (?, ?, ?, UNIX_TIMESTAMP(), 'automated_system', ?)
    `;
    
    const [result] = await connection.execute(insertQuery, [
      sessionId, 
      studentId, 
      statusId, 
      remarks
    ]);
    
    res.json({
      success: true,
      attendanceId: result.insertId,
      message: 'Attendance marked successfully',
      source: 'moodle'
    });
    
  } catch (error) {
    console.error('Moodle attendance mark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance',
      details: error.message
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
