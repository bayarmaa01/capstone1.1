const axios = require('axios');
const cron = require('node-cron');
const db = require('../db');
const oauthService = require('./oauth');

class LMSSyncService {
  constructor() {
    this.moodleUrl = process.env.MOODLE_URL;
    this.isRunning = false;
  }

  async syncCourses() {
    try {
      console.log('🔄 Starting course synchronization...');
      
      // Get teachers with valid tokens
      const teachers = await db.query(
        'SELECT * FROM users WHERE role = $1 AND lms_token IS NOT NULL',
        ['teacher']
      );

      for (const teacher of teachers.rows) {
        try {
          const courses = await this.getMoodleCourses(teacher.lms_token);
          
          for (const course of courses) {
            await this.upsertCourse(course, teacher.id);
          }
        } catch (error) {
          console.error(`Error syncing courses for teacher ${teacher.id}:`, error.message);
        }
      }

      console.log('✅ Course synchronization completed');
    } catch (error) {
      console.error('❌ Course sync error:', error);
    }
  }

  async syncStudents() {
    try {
      console.log('🔄 Starting student synchronization...');
      
      const courses = await db.query('SELECT * FROM classes WHERE lms_course_id IS NOT NULL');
      
      for (const course of courses.rows) {
        try {
          const enrolledUsers = await this.getEnrolledUsers(course.lms_course_id);
          
          for (const user of enrolledUsers) {
            if (user.roles.some(role => role.shortname === 'student')) {
              await this.upsertStudent(user);
              await this.upsertEnrollment(course.id, user.id);
            }
          }
        } catch (error) {
          console.error(`Error syncing students for course ${course.id}:`, error.message);
        }
      }

      console.log('✅ Student synchronization completed');
    } catch (error) {
      console.error('❌ Student sync error:', error);
    }
  }

  async getMoodleCourses(token) {
    const response = await axios.get(`${this.moodleUrl}/webservice/rest/server.php`, {
      params: {
        wstoken: token,
        wsfunction: 'core_course_get_courses',
        moodlewsrestformat: 'json'
      }
    });
    return response.data;
  }

  async getEnrolledUsers(courseId) {
    const teachers = await db.query(
      'SELECT lms_token FROM users WHERE role = $1 AND lms_token IS NOT NULL LIMIT 1',
      ['teacher']
    );

    if (teachers.rows.length === 0) {
      throw new Error('No teacher tokens available for API calls');
    }

    const response = await axios.get(`${this.moodleUrl}/webservice/rest/server.php`, {
      params: {
        wstoken: teachers.rows[0].lms_token,
        wsfunction: 'core_enrol_get_enrolled_users',
        courseid: courseId,
        moodlewsrestformat: 'json'
      }
    });
    return response.data;
  }

  async upsertCourse(moodleCourse, teacherId) {
    const result = await db.query(
      `INSERT INTO classes (code, name, instructor_id, lms_course_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lms_course_id) 
       DO UPDATE SET name = $2, instructor_id = $3, updated_at = NOW()
       RETURNING *`,
      [moodleCourse.shortname, moodleCourse.fullname, teacherId, moodleCourse.id]
    );
    return result.rows[0];
  }

  async upsertStudent(moodleUser) {
    const result = await db.query(
      `INSERT INTO students (student_id, name, email, lms_user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lms_user_id) 
       DO UPDATE SET name = $2, email = $3, updated_at = NOW()
       RETURNING *`,
      [moodleUser.id.toString(), moodleUser.fullname, moodleUser.email, moodleUser.id]
    );
    return result.rows[0];
  }

  async upsertEnrollment(classId, studentId) {
    await db.query(
      `INSERT INTO enrollments (class_id, student_id, enrolled_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (class_id, student_id) DO NOTHING`,
      [classId, studentId]
    );
  }

  startScheduledSync() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        this.isRunning = true;
        try {
          await this.syncCourses();
          await this.syncStudents();
        } catch (error) {
          console.error('Scheduled sync error:', error);
        } finally {
          this.isRunning = false;
        }
      }
    });

    console.log('📅 LMS sync scheduler started (runs every hour)');
  }
}

// Temporarily disabled to prevent crashes
// module.exports = new LMSSyncService();
module.exports = null;
