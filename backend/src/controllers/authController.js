const bcrypt = require('bcryptjs');
const { pool } = require('../db');

/**
 * Moodle Authentication Controller
 * Integrates with Moodle database for user authentication
 */

// Helper function to convert Moodle bcrypt hash to Node.js compatible format
const convertMoodleHash = (moodleHash) => {
  // Moodle uses $2y$ prefix, Node.js bcrypt expects $2b$
  if (moodleHash && moodleHash.startsWith('$2y$')) {
    return moodleHash.replace('$2y$', '$2b$');
  }
  return moodleHash;
};

// Helper function to check if user is a teacher
const isTeacher = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM mdl_role_assignments ra 
      JOIN mdl_role r ON ra.roleid = r.id 
      WHERE ra.userid = ? AND r.shortname IN ('teacher', 'editingteacher', 'manager')
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0].count > 0;
  } catch (error) {
    console.error('Error checking teacher role:', error);
    return false;
  }
};

/**
 * Login Controller
 * Authenticates user against Moodle database
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    console.log('=== LOGIN ATTEMPT ===');
    console.log('Username:', username);
    console.log('Password length:', password.length);

    // Query user from Moodle database
    const userQuery = `
      SELECT id, username, email, password, auth, firstname, lastname, confirmed
      FROM mdl_user 
      WHERE (username = ? OR email = ?) 
      AND deleted = 0 
      AND suspended = 0
      LIMIT 1
    `;

    const userResult = await pool.query(userQuery, [username, username]);
    
    if (userResult.rows.length === 0) {
      console.log('User not found in database');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = userResult.rows[0];
    console.log('User found:', user.username);
    console.log('User ID:', user.id);
    console.log('Auth type:', user.auth);
    console.log('DB hash (original):', user.password.substring(0, 10) + '...');

    // Check if user has manual auth type (required for password login)
    if (user.auth !== 'manual') {
      console.log('User auth type is not manual:', user.auth);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid authentication method' 
      });
    }

    // Convert Moodle bcrypt hash to Node.js compatible format
    const nodeCompatibleHash = convertMoodleHash(user.password);
    console.log('Converted hash:', nodeCompatibleHash.substring(0, 10) + '...');

    // Compare password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, nodeCompatibleHash);
    console.log('Password comparison result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Password comparison failed');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if user is confirmed
    if (!user.confirmed) {
      console.log('User account not confirmed');
      return res.status(401).json({ 
        success: false, 
        message: 'Account not confirmed' 
      });
    }

    // Check if user is a teacher (optional - uncomment if needed)
    // const isTeacherUser = await isTeacher(user.id);
    // if (!isTeacherUser) {
    //   console.log('User is not a teacher');
    //   return res.status(403).json({ 
    //     success: false, 
    //     message: 'Access denied. Teacher role required.' 
    //   });
    // }

    // Create user session/token (you can implement JWT here)
    const userSession = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      auth: user.auth
    };

    console.log('=== LOGIN SUCCESS ===');
    console.log('User authenticated successfully:', user.username);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: userSession,
      // You can add JWT token here if needed
      // token: generateJWT(userSession)
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

/**
 * Test function to verify database connection and hash conversion
 */
const testAuth = async (req, res) => {
  try {
    // Test database connection
    const testQuery = 'SELECT COUNT(*) as count FROM mdl_user WHERE deleted = 0';
    const result = await pool.query(testQuery);
    
    // Test hash conversion
    const testHash = '$2y$10$JcmLcKMiTWyjYIV4HvYeD.sWMR8aE12r2GHeWK7Zh1i0caNnHi1q.';
    const convertedHash = convertMoodleHash(testHash);
    
    res.json({
      success: true,
      message: 'Auth system test successful',
      database: {
        connected: true,
        activeUsers: result.rows[0].count
      },
      hashConversion: {
        original: testHash.substring(0, 10) + '...',
        converted: convertedHash.substring(0, 10) + '...'
      }
    });
  } catch (error) {
    console.error('Auth test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Auth system test failed',
      error: error.message 
    });
  }
};

module.exports = {
  login,
  testAuth,
  convertMoodleHash,
  isTeacher
};
