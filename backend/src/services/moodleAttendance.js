// Moodle Attendance Service Integration
// ======================================

const axios = require('axios');

class MoodleAttendanceService {
  constructor() {
    this.baseUrl = process.env.MOODLE_URL || 'http://40.90.174.78:8081';
    this.token = process.env.MOODLE_TOKEN || '';
    this.wstoken = process.env.MOODLE_WS_TOKEN || '';
  }

  // Get attendance records for a course
  async getAttendance(courseId) {
    try {
      const response = await axios.get(`${this.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: this.wstoken,
          wsfunction: 'mod_attendance_get_attendance',
          moodlewsrestformat: 'json',
          courseid: courseId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting attendance:', error.response?.data || error.message);
      throw error;
    }
  }

  // Take attendance for a course session
  async takeAttendance(sessionId, studentId, status) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_take_attendance',
        moodlewsrestformat: 'json',
        sessionid: sessionId,
        studentid: studentId,
        status: status // 1 = present, 0 = absent
      });
      return response.data;
    } catch (error) {
      console.error('Error taking attendance:', error.response?.data || error.message);
      throw error;
    }
  }

  // Update attendance records
  async updateAttendance(attendanceId, status) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_update_attendance',
        moodlewsrestformat: 'json',
        attendanceid: attendanceId,
        status: status
      });
      return response.data;
    } catch (error) {
      console.error('Error updating attendance:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get attendance sessions for a course
  async getSessions(courseId) {
    try {
      const response = await axios.get(`${this.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: this.wstoken,
          wsfunction: 'mod_attendance_get_sessions',
          moodlewsrestformat: 'json',
          courseid: courseId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting sessions:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create new attendance session
  async createSession(courseId, sessionId, description) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_create_session',
        moodlewsrestformat: 'json',
        courseid: courseId,
        sessionid: sessionId,
        description: description
      });
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error.response?.data || error.message);
      throw error;
    }
  }

  // Delete attendance session
  async deleteSession(sessionId) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_delete_session',
        moodlewsrestformat: 'json',
        sessionid: sessionId
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting session:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get attendance for a specific user
  async getUserAttendance(userId) {
    try {
      const response = await axios.get(`${this.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: this.wstoken,
          wsfunction: 'mod_attendance_get_user_attendance',
          moodlewsrestformat: 'json',
          userid: userId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting user attendance:', error.response?.data || error.message);
      throw error;
    }
  }

  // Mark multiple users as present
  async markUsersPresent(sessionId, userIds) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_mark_users_present',
        moodlewsrestformat: 'json',
        sessionid: sessionId,
        userids: userIds.join(',')
      });
      return response.data;
    } catch (error) {
      console.error('Error marking users present:', error.response?.data || error.message);
      throw error;
    }
  }

  // Mark multiple users as absent
  async markUsersAbsent(sessionId, userIds) {
    try {
      const response = await axios.post(`${this.baseUrl}/webservice/rest/server.php`, {
        wstoken: this.wstoken,
        wsfunction: 'mod_attendance_mark_users_absent',
        moodlewsrestformat: 'json',
        sessionid: sessionId,
        userids: userIds.join(',')
      });
      return response.data;
    } catch (error) {
      console.error('Error marking users absent:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get course information
  async getCourse(courseId) {
    try {
      const response = await axios.get(`${this.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: this.wstoken,
          wsfunction: 'core_course_get_courses',
          moodlewsrestformat: 'json',
          options: {
            ids: [courseId]
          }
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting course:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get enrolled users for a course
  async getEnrolledUsers(courseId) {
    try {
      const response = await axios.get(`${this.baseUrl}/webservice/rest/server.php`, {
        params: {
          wstoken: this.wstoken,
          wsfunction: 'core_enrol_get_enrolled_users',
          moodlewsrestformat: 'json',
          courseid: courseId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting enrolled users:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = MoodleAttendanceService;
