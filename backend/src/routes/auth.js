const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const mysql = require('mysql2/promise');

// Moodle database connection (same as moodleSchedule.js)
const moodleDbConfig = {
  host: process.env.MOODLE_DB_HOST || 'capstone11-moodle-db-1',
  user: process.env.MOODLE_DB_USER || 'moodle',
  password: process.env.MOODLE_DB_PASSWORD || 'moodle_secret',
  database: process.env.MOODLE_DB_NAME || 'moodle',
  port: process.env.MOODLE_DB_PORT || 3306
};

const moodlePool = mysql.createPool({
  ...moodleDbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const oauthService = require('../services/oauth');

// Register new teacher/admin
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Insert user
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, password_hash, role || 'teacher']
    );
    
    console.log(`✓ User registered: ${username}`);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === '23505') { // Duplicate username
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Login - Query Moodle DB for teacher authentication
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Query Moodle user database
    const moodleResult = await moodlePool.query(
      'SELECT id, username, password, email, firstname, lastname FROM mdl_user WHERE username = ? AND deleted = 0',
      [username]
    );
    
    if (moodleResult.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const moodleUser = moodleResult[0];
    
    // Verify password using Moodle's MD5 hash
    const verifyPassword = (input, hash) => {
      // Check if it's an MD5 hash (starts with $ and is 32 chars)
      if (!hash || !hash.startsWith('$') || hash.length !== 32) {
        return false;
      }
      
      const inputHash = crypto.createHash('md5').update(input).digest('hex');
      return inputHash === hash.toLowerCase();
    };
    
    const valid = verifyPassword(password, moodleUser.password);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is a teacher using Moodle role assignments
    const roleResult = await moodlePool.query(`
      SELECT ra.roleid, r.shortname, c.id as course_id, c.fullname as course_name
      FROM mdl_role_assignments ra
      JOIN mdl_role r ON ra.roleid = r.id
      JOIN mdl_context ctx ON ra.contextid = ctx.id
      JOIN mdl_course c ON ctx.instanceid = c.id
      WHERE ra.userid = ? 
      AND ctx.contextlevel = 50  -- Course context level
      AND r.shortname IN ('editingteacher', 'teacher', 'manager')
      LIMIT 1
    `, [moodleUser.id]);
    
    if (roleResult[0].length === 0) {
      return res.status(403).json({ error: 'Access denied. Teacher role required.' });
    }
    
    const userRole = roleResult[0][0].shortname;
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: moodleUser.id, 
        username: moodleUser.username, 
        email: moodleUser.email,
        name: `${moodleUser.firstname} ${moodleUser.lastname}`,
        role: userRole,
        course_id: roleResult.rows[0].course_id,
        course_name: roleResult.rows[0].course_name
      },
      process.env.JWT_SECRET || 'default_secret_change_this',
      { expiresIn: '24h' }
    );
    
    console.log(`✓ Teacher logged in: ${username} (${userRole})`);
    res.json({ 
      success: true, 
      token, 
      user: { 
        id: moodleUser.id, 
        username: moodleUser.username,
        email: moodleUser.email,
        name: `${moodleUser.firstname} ${moodleUser.lastname}`,
        role: userRole,
        course_id: roleResult.rows[0].course_id,
        course_name: roleResult.rows[0].course_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify token (optional, for frontend to check if still logged in)
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_this');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Get current user info (protected)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_this');
    
    // Get fresh user data from Moodle database
    const result = await moodlePool.query(
      'SELECT id, username, email, firstname, lastname FROM mdl_user WHERE id = ? AND deleted = 0',
      [decoded.id]
    );
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user role
    const roleResult = await moodlePool.query(`
      SELECT r.shortname, c.id as course_id, c.fullname as course_name
      FROM mdl_role_assignments ra
      JOIN mdl_role r ON ra.roleid = r.id
      JOIN mdl_context ctx ON ra.contextid = ctx.id
      JOIN mdl_course c ON ctx.instanceid = c.id
      WHERE ra.userid = ? 
      AND ctx.contextlevel = 50
      AND r.shortname IN ('editingteacher', 'teacher', 'manager')
      LIMIT 1
    `, [decoded.id]);
    
    const user = result[0];
    user.role = roleResult.length > 0 ? roleResult[0].shortname : 'student';
    user.course_id = roleResult.length > 0 ? roleResult[0].course_id : null;
    user.course_name = roleResult.length > 0 ? roleResult[0].course_name : null;
    user.name = `${user.firstname} ${user.lastname}`;
    
    res.json({ user });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;