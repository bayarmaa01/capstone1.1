const express = require('express');
const router = express.Router();
const moodleApi = require('../services/moodle_api');
const db = require('../db');
const mysql = require('mysql2/promise');

const moodlePool = mysql.createPool({
    host: process.env.MOODLE_DB_HOST || 'moodle-db',
    user: process.env.MOODLE_DB_USER || 'moodle',
    password: process.env.MOODLE_DB_PASSWORD || 'moodle_secret',
    database: process.env.MOODLE_DB_NAME || 'moodle',
    port: process.env.MOODLE_DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get Moodle courses
router.get('/courses', async (req, res) => {
    try {
        console.log('📚 API: Fetching Moodle courses...');
        
        const courses = await moodleApi.getCourses();
        
        // Transform for frontend
        const transformedCourses = courses.map(course => ({
            id: course.id,
            code: course.shortname,
            name: course.fullname,
            moodle_course_id: course.id,
            created_at: new Date()
        }));

        res.json({
            success: true,
            data: transformedCourses,
            total: transformedCourses.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching courses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch courses from Moodle'
        });
    }
});

// Get enrolled students for a course
router.get('/courses/:courseId/students', async (req, res) => {
    try {
        const { courseId } = req.params;

        console.log(`👥 API: Fetching students for course ${courseId} from Moodle DB...`);

        const studentsQuery = `
            SELECT 
              u.id,
              u.username,
              u.firstname,
              u.lastname,
              u.email,
              c.id as course_id,
              c.fullname as course_name
            FROM mdl_user u
            JOIN mdl_user_enrolments ue ON ue.userid = u.id
            JOIN mdl_enrol e ON e.id = ue.enrolid
            JOIN mdl_course c ON c.id = e.courseid
            JOIN mdl_role_assignments ra ON ra.userid = u.id
            JOIN mdl_role r ON r.id = ra.roleid
            WHERE r.shortname = 'student'
              AND u.deleted = 0
              AND c.id = ?
        `;

        const [students] = await moodlePool.execute(studentsQuery, [courseId]);

        res.json({
            success: true,
            data: students
        });
        
    } catch (error) {
        console.error('❌ Error fetching students:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students from Moodle'
        });
    }
});

// Sync Moodle data to local database
router.post('/sync', async (req, res) => {
    try {
        console.log('🔄 API: Starting Moodle sync...');
        
        const syncData = await moodleApi.syncCoursesAndStudents();
        
        // Update local database
        for (const courseData of syncData) {
            // Upsert course
            const courseResult = await db.query(`
                INSERT INTO classes (code, name, lms_course_id, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                ON CONFLICT (lms_course_id) 
                DO UPDATE SET 
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    updated_at = NOW()
                RETURNING id
            `, [courseData.course_code, courseData.course_name, courseData.moodle_course_id]);
            
            const localCourseId = courseResult.rows[0].id;
            
            // Upsert students
            for (const student of courseData.enrolled_students) {
                await db.query(`
                    INSERT INTO students (student_id, name, email, lms_user_id, created_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (student_id) 
                    DO UPDATE SET 
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        lms_user_id = EXCLUDED.lms_user_id
                `, [student.username, student.fullname, student.email, student.moodle_user_id]);
                
                // Create enrollment
                await db.query(`
                    INSERT INTO enrollments (class_id, student_id, enrolled_at)
                    VALUES (
                        (SELECT id FROM students WHERE student_id = $1),
                        $2,
                        NOW()
                    )
                    ON CONFLICT (class_id, student_id) DO NOTHING
                `, [student.username, localCourseId]);
            }
        }

        res.json({
            success: true,
            message: 'Moodle sync completed successfully',
            synced_courses: syncData.length
        });
        
    } catch (error) {
        console.error('❌ Error during Moodle sync:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync Moodle data'
        });
    }
});

// Test Moodle connection
router.get('/test', async (req, res) => {
    try {
        const isConnected = await moodleApi.testConnection();
        
        res.json({
            success: true,
            connected: !!isConnected,
            site_info: isConnected || null
        });
        
    } catch (error) {
        console.error('❌ Moodle connection test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Moodle connection test failed'
        });
    }
});

// 🎓 Get attendance records from Moodle
router.get('/attendance/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        
        console.log(`🎓 API: Fetching Moodle attendance for course ${courseId}...`);
        
        const attendance = await moodleApi.getAttendance(courseId);
        
        res.json({
            success: true,
            data: attendance,
            total: attendance.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching Moodle attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Moodle attendance'
        });
    }
});

// ✅ Take attendance in Moodle
router.post('/attendance/take', async (req, res) => {
    try {
        const { sessionId, studentId, status } = req.body;
        
        console.log('✅ API: Taking Moodle attendance:', { sessionId, studentId, status });
        
        const result = await moodleApi.takeAttendance(sessionId, studentId, status);
        
        res.json({
            success: true,
            data: result,
            message: 'Attendance recorded in Moodle'
        });
        
    } catch (error) {
        console.error('❌ Error taking Moodle attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record Moodle attendance'
        });
    }
});

// 🔄 Update attendance in Moodle
router.put('/attendance/:attendanceId', async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const { status } = req.body;
        
        console.log('🔄 API: Updating Moodle attendance:', { attendanceId, status });
        
        const result = await moodleApi.updateAttendance(attendanceId, status);
        
        res.json({
            success: true,
            data: result,
            message: 'Moodle attendance updated'
        });
        
    } catch (error) {
        console.error('❌ Error updating Moodle attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update Moodle attendance'
        });
    }
});

// 📅 Get attendance sessions from Moodle
router.get('/sessions/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        
        console.log(`📅 API: Fetching Moodle sessions for course ${courseId}...`);
        
        const sessions = await moodleApi.getSessions(courseId);
        
        res.json({
            success: true,
            data: sessions,
            total: sessions.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching Moodle sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Moodle sessions'
        });
    }
});

// ➕ Create attendance session in Moodle
router.post('/sessions', async (req, res) => {
    try {
        const { courseId, sessionId, description } = req.body;
        
        console.log('➕ API: Creating Moodle session:', { courseId, sessionId, description });
        
        const result = await moodleApi.createSession(courseId, sessionId, description);
        
        res.json({
            success: true,
            data: result,
            message: 'Moodle session created'
        });
        
    } catch (error) {
        console.error('❌ Error creating Moodle session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create Moodle session'
        });
    }
});

// 🗑️ Delete attendance session in Moodle
router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        console.log(`🗑️ API: Deleting Moodle session ${sessionId}...`);
        
        const result = await moodleApi.deleteSession(sessionId);
        
        res.json({
            success: true,
            data: result,
            message: 'Moodle session deleted'
        });
        
    } catch (error) {
        console.error('❌ Error deleting Moodle session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete Moodle session'
        });
    }
});

// 👤 Get user attendance from Moodle
router.get('/user-attendance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`👤 API: Fetching Moodle user attendance for ${userId}...`);
        
        const attendance = await moodleApi.getUserAttendance(userId);
        
        res.json({
            success: true,
            data: attendance,
            total: attendance.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching Moodle user attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch Moodle user attendance'
        });
    }
});

// ✅ Mark multiple users as present in Moodle
router.post('/attendance/mark-present', async (req, res) => {
    try {
        const { sessionId, userIds } = req.body;
        
        console.log('✅ API: Marking users present in Moodle:', { sessionId, userIds });
        
        const result = await moodleApi.markUsersPresent(sessionId, userIds);
        
        res.json({
            success: true,
            data: result,
            message: 'Users marked present in Moodle'
        });
        
    } catch (error) {
        console.error('❌ Error marking users present in Moodle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark users present in Moodle'
        });
    }
});

// ❌ Mark multiple users as absent in Moodle
router.post('/attendance/mark-absent', async (req, res) => {
    try {
        const { sessionId, userIds } = req.body;
        
        console.log('❌ API: Marking users absent in Moodle:', { sessionId, userIds });
        
        const result = await moodleApi.markUsersAbsent(sessionId, userIds);
        
        res.json({
            success: true,
            data: result,
            message: 'Users marked absent in Moodle'
        });
        
    } catch (error) {
        console.error('❌ Error marking users absent in Moodle:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark users absent in Moodle'
        });
    }
});

module.exports = router;
