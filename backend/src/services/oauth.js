const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../db');

class MoodleOAuthService {
  constructor() {
    this.clientId = process.env.MOODLE_CLIENT_ID;
    this.clientSecret = process.env.MOODLE_CLIENT_SECRET;
    this.redirectUri = process.env.MOODLE_REDIRECT_URI || 'https://attendance-ml.duckdns.org/auth/callback';
    this.moodleUrl = process.env.MOODLE_URL;
    this.tokenUrl = `${this.moodleUrl}/local/oauth/access_token.php`;
    this.authorizeUrl = `${this.moodleUrl}/local/oauth/authorize.php`;
    this.userInfoUrl = `${this.moodleUrl}/webservice/rest/server.php`;
  }

  getAuthorizationUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read write',
      state: this.generateState()
    });

    return `${this.authorizeUrl}?${params.toString()}`;
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async exchangeCodeForToken(code, state) {
    try {
      const response = await axios.post(this.tokenUrl, {
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      });

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for token');
    }
  }

  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(this.userInfoUrl, {
        params: {
          wstoken: accessToken,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting user info:', error.response?.data || error.message);
      throw new Error('Failed to retrieve user information');
    }
  }

  async getUserCourses(accessToken) {
    try {
      const response = await axios.get(this.userInfoUrl, {
        params: {
          wstoken: accessToken,
          wsfunction: 'core_course_get_courses',
          moodlewsrestformat: 'json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting user courses:', error.response?.data || error.message);
      throw new Error('Failed to retrieve user courses');
    }
  }

  async getUserRole(accessToken, courseId) {
    try {
      const response = await axios.get(this.userInfoUrl, {
        params: {
          wstoken: accessToken,
          wsfunction: 'core_enrol_get_enrolled_users',
          courseid: courseId,
          moodlewsrestformat: 'json'
        }
      });

      // Check if user has editing capabilities (teacher) or is just enrolled (student)
      const enrolledUsers = response.data;
      const userResponse = await this.getUserInfo(accessToken);
      const currentUserId = userResponse.userid;

      const user = enrolledUsers.find(u => u.id === currentUserId);
      
      if (user) {
        // Check if user has any teacher-like roles
        const hasTeacherRole = user.roles.some(role => 
          role.shortname === 'editingteacher' || 
          role.shortname === 'teacher' || 
          role.shortname === 'manager'
        );
        
        return hasTeacherRole ? 'teacher' : 'student';
      }

      return 'student';
    } catch (error) {
      console.error('Error getting user role:', error.response?.data || error.message);
      return 'student'; // Default to student role
    }
  }

  async createOrUpdateUser(userData, tokens) {
    try {
      const { userid, username, firstname, lastname, email } = userData;
      const fullName = `${firstname} ${lastname}`.trim();

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT * FROM users WHERE lms_id = $1 OR username = $2',
        [userid, username]
      );

      let user;
      if (existingUser.rows.length > 0) {
        // Update existing user
        const updateResult = await db.query(
          `UPDATE users 
           SET lms_id = $1, username = $2, email = $3, name = $4, 
               lms_token = $5, lms_refresh_token = $6, updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [userid, username, email, fullName, tokens.access_token, tokens.refresh_token, existingUser.rows[0].id]
        );
        user = updateResult.rows[0];
      } else {
        // Create new user
        const insertResult = await db.query(
          `INSERT INTO users (lms_id, username, email, name, role, lms_token, lms_refresh_token)
           VALUES ($1, $2, $3, $4, 'student', $5, $6)
           RETURNING *`,
          [userid, username, email, fullName, tokens.access_token, tokens.refresh_token]
        );
        user = insertResult.rows[0];
      }

      return user;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw new Error('Failed to create or update user');
    }
  }

  generateJWT(user) {
    return jwt.sign(
      {
        id: user.id,
        lms_id: user.lms_id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET || 'default_secret_change_this',
      { expiresIn: '24h' }
    );
  }

  async refreshToken(refreshToken) {
    try {
      const response = await axios.post(this.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }
}

module.exports = new MoodleOAuthService();
