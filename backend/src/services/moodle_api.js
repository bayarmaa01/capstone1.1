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
}

module.exports = new MoodleAPIService();
