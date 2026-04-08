const axios = require('axios');

class MoodleAPIService {
    constructor() {
        this.baseUrl = process.env.MOODLE_URL || 'http://moodle/webservice/rest/server.php';
        this.token = process.env.MOODLE_TOKEN;
        this.restFormat = 'json';
    }

    async getCourses() {
        try {
            console.log('🎓 Fetching Moodle courses...');
            
            const params = {
                wstoken: this.token,
                wsfunction: 'core_course_get_courses',
                moodlewsrestformat: this.restFormat
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data && Array.isArray(response.data)) {
                const courses = response.data.filter(course => 
                    course.id !== 1 && // Filter out "Site" course
                    course.shortname && 
                    course.fullname
                );

                console.log(`✅ Found ${courses.length} Moodle courses`);
                return courses;
            }

            return [];
        } catch (error) {
            console.error('❌ Error fetching Moodle courses:', error.message);
            return [];
        }
    }

    async getEnrolledUsers(courseId) {
        try {
            console.log(`👥 Fetching enrolled users for course ${courseId}...`);
            
            const params = {
                wstoken: this.token,
                wsfunction: 'core_enrol_get_enrolled_users',
                moodlewsrestformat: this.restFormat,
                courseid: courseId
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.data && Array.isArray(response.data)) {
                const students = response.data.filter(user => 
                    user.enrolled && 
                    user.roles && 
                    user.roles.some(role => role.shortname === 'student')
                );

                console.log(`✅ Found ${students.length} enrolled students`);
                return students;
            }

            return [];
        } catch (error) {
            console.error(`❌ Error fetching enrolled users for course ${courseId}:`, error.message);
            return [];
        }
    }

    async syncCoursesAndStudents() {
        try {
            console.log('🔄 Starting Moodle sync...');
            
            // Get all courses
            const courses = await this.getCourses();
            
            const syncData = [];
            
            for (const course of courses) {
                // Get enrolled students for each course
                const students = await this.getEnrolledUsers(course.id);
                
                syncData.push({
                    moodle_course_id: course.id,
                    course_code: course.shortname,
                    course_name: course.fullname,
                    enrolled_students: students.map(student => ({
                        moodle_user_id: student.id,
                        email: student.email,
                        fullname: student.fullname,
                        username: student.username
                    }))
                });
            }

            console.log(`✅ Sync completed: ${syncData.length} courses with students`);
            return syncData;
            
        } catch (error) {
            console.error('❌ Moodle sync failed:', error.message);
            return [];
        }
    }

    async testConnection() {
        try {
            const params = {
                wstoken: this.token,
                wsfunction: 'core_webservice_get_site_info',
                moodlewsrestformat: this.restFormat
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 5000
            });

            return response.data && response.data.sitename;
        } catch (error) {
            console.error('❌ Moodle connection test failed:', error.message);
            return false;
        }
    }

    // 🎓 ATTENDANCE FUNCTIONS
    async getAttendance(courseId) {
        try {
            console.log(`🎓 Fetching Moodle attendance for course ${courseId}...`);
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_get_attendance',
                moodlewsrestformat: this.restFormat,
                courseid: courseId
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data || [];
        } catch (error) {
            console.error('❌ Error fetching attendance:', error.message);
            return [];
        }
    }

    async takeAttendance(sessionId, studentId, status) {
        try {
            console.log('✅ Taking Moodle attendance:', { sessionId, studentId, status });
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_take_attendance',
                moodlewsrestformat: this.restFormat,
                sessionid: sessionId,
                studentid: studentId,
                status: status // 1 = present, 0 = absent
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error taking attendance:', error.message);
            throw error;
        }
    }

    async updateAttendance(attendanceId, status) {
        try {
            console.log('🔄 Updating Moodle attendance:', { attendanceId, status });
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_update_attendance',
                moodlewsrestformat: this.restFormat,
                attendanceid: attendanceId,
                status: status
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error updating attendance:', error.message);
            throw error;
        }
    }

    async getSessions(courseId) {
        try {
            console.log(`📅 Fetching Moodle sessions for course ${courseId}...`);
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_get_sessions',
                moodlewsrestformat: this.restFormat,
                courseid: courseId
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data || [];
        } catch (error) {
            console.error('❌ Error fetching sessions:', error.message);
            return [];
        }
    }

    async createSession(courseId, sessionId, description) {
        try {
            console.log('➕ Creating Moodle session:', { courseId, sessionId, description });
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_create_session',
                moodlewsrestformat: this.restFormat,
                courseid: courseId,
                sessionid: sessionId,
                description: description
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error creating session:', error.message);
            throw error;
        }
    }

    async deleteSession(sessionId) {
        try {
            console.log(`🗑️ Deleting Moodle session ${sessionId}...`);
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_delete_session',
                moodlewsrestformat: this.restFormat,
                sessionid: sessionId
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error deleting session:', error.message);
            throw error;
        }
    }

    async getUserAttendance(userId) {
        try {
            console.log(`👤 Fetching Moodle user attendance for ${userId}...`);
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_get_user_attendance',
                moodlewsrestformat: this.restFormat,
                userid: userId
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data || [];
        } catch (error) {
            console.error('❌ Error fetching user attendance:', error.message);
            return [];
        }
    }

    async markUsersPresent(sessionId, userIds) {
        try {
            console.log('✅ Marking users present in Moodle:', { sessionId, userIds });
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_mark_users_present',
                moodlewsrestformat: this.restFormat,
                sessionid: sessionId,
                userids: Array.isArray(userIds) ? userIds.join(',') : userIds
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error marking users present:', error.message);
            throw error;
        }
    }

    async markUsersAbsent(sessionId, userIds) {
        try {
            console.log('❌ Marking users absent in Moodle:', { sessionId, userIds });
            
            const params = {
                wstoken: this.token,
                wsfunction: 'mod_attendance_mark_users_absent',
                moodlewsrestformat: this.restFormat,
                sessionid: sessionId,
                userids: Array.isArray(userIds) ? userIds.join(',') : userIds
            };

            const response = await axios.post(this.baseUrl, params, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Error marking users absent:', error.message);
            throw error;
        }
    }
}

module.exports = new MoodleAPIService();
