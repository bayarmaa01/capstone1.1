const express = require('express');
const router = express.Router();
const moodleApi = require('../services/moodle_api');
const db = require('../db');

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
        
        console.log(`👥 API: Fetching students for course ${courseId}...`);
        
        const students = await moodleApi.getEnrolledUsers(courseId);
        
        // Transform for frontend
        const transformedStudents = students.map(student => ({
            id: student.id,
            student_id: student.username,
            name: student.fullname,
            email: student.email,
            moodle_user_id: student.id,
            created_at: new Date()
        }));

        res.json({
            success: true,
            data: transformedStudents,
            total: transformedStudents.length
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

module.exports = router;
