const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Find user
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'default_secret_change_this',
      { expiresIn: '24h' }
    );
    
    console.log(`✓ User logged in: ${username}`);
    res.json({ 
      success: true, 
      token, 
      user: { id: user.id, username: user.username, role: user.role }
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

// OAuth2 Login - Redirect to Moodle
router.get('/oauth/login', (req, res) => {
  try {
    const authUrl = oauthService.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth login error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth login' });
  }
});

// OAuth2 Callback - Handle Moodle response
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Exchange code for tokens
    const tokens = await oauthService.exchangeCodeForToken(code, state);
    
    // Get user information from Moodle
    const userInfo = await oauthService.getUserInfo(tokens.access_token);
    
    // Get user courses to determine role
    const courses = await oauthService.getUserCourses(tokens.access_token);
    
    // Determine user role (default to student, check if teacher in any course)
    let userRole = 'student';
    if (courses && courses.length > 0) {
      // Check first course for role (could be enhanced to check all courses)
      userRole = await oauthService.getUserRole(tokens.access_token, courses[0].id);
    }
    
    // Create or update user in database
    const user = await oauthService.createOrUpdateUser(userInfo, tokens);
    
    // Update user role if determined from courses
    if (userRole !== user.role) {
      await db.query(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
        [userRole, user.id]
      );
      user.role = userRole;
    }
    
    // Generate JWT token
    const jwtToken = oauthService.generateJWT(user);
    
    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'https://attendance-ml.duckdns.org';
    res.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}&user=${encodeURIComponent(JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role
    }))}`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://attendance-ml.duckdns.org';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_this');
    
    // Get fresh user data from database
    const result = await db.query(
      'SELECT id, lms_id, username, email, name, role, created_at FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;