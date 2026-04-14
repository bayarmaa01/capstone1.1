// =======================================
// 🔄 Moodle Auto Sync Cron Job
// =======================================
// Runs every 5 minutes to sync Moodle schedules

const cron = require('node-cron');
const db = require('../db');
const axios = require('axios');

// Moodle API Configuration
const MOODLE_URL = process.env.MOODLE_URL || 'http://moodle/webservice/rest/server.php';
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || 'your-moodle-token';
const MOODLE_WS_FUNCTION = 'core_course_get_courses_by_field';

// Sync function
async function syncMoodle() {
  try {
    console.log('🔄 Starting Moodle sync...');
    
    // Fetch courses from Moodle
    const moodleResponse = await axios.get(MOODLE_URL, {
      params: {
        wstoken: MOODLE_TOKEN,
        wsfunction: MOODLE_WS_FUNCTION,
        moodlewsrestformat: 'json'
      }
    });

    if (!moodleResponse.data || !Array.isArray(MoodleResponse.data)) {
      console.error('❌ Invalid Moodle response:', moodleResponse.data);
      return;
    }

    const moodleCourses = moodleResponse.data;
    console.log(`📚 Found ${moodleCourses.length} courses in Moodle`);

    // Sync each course
    for (const course of moodleCourses) {
      try {
        // Check if course exists in local DB
        const existingClass = await db.query(
          'SELECT id FROM classes WHERE lms_course_id = $1',
          [course.id]
        );

        let classId;
        if (existingClass.rows.length > 0) {
          classId = existingClass.rows[0].id;
          console.log(`✅ Course ${course.shortname} already exists (ID: ${classId})`);
        } else {
          // Create new class
          const newClass = await db.query(`
            INSERT INTO classes (code, name, lms_course_id, instructor_id)
            VALUES ($1, $2, $3, 1)
            RETURNING id
          `, [course.shortname, course.fullname, course.id]);

          classId = newClass.rows[0].id;
          console.log(`➕ Created new class: ${course.shortname} (ID: ${classId})`);
        }

        // Sync schedules for this course
        const existingSchedules = await db.query(
          'SELECT id, day_of_week, start_time, end_time, room_number FROM class_schedules WHERE class_id = $1',
          [classId]
        );

        const existingScheduleKeys = new Set(
          existingSchedules.rows.map(s => `${s.day_of_week}-${s.start_time}-${s.end_time}`)
        );

        // Extract schedules from Moodle course (assuming they're in course format)
        const courseSchedules = extractSchedulesFromCourse(course);
        let addedCount = 0;

        for (const schedule of courseSchedules) {
          const scheduleKey = `${schedule.day_of_week}-${schedule.start_time}-${schedule.end_time}`;
          
          if (!existingScheduleKeys.has(scheduleKey)) {
            await db.query(`
              INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, room_number, is_active, source)
              VALUES ($1, $2, $3, $4, $5, true, 'moodle')
            `, [classId, schedule.day_of_week, schedule.start_time, schedule.end_time, schedule.room_number]);
            
            addedCount++;
            console.log(`➕ Added schedule: Day ${schedule.day_of_week}, ${schedule.start_time}-${schedule.end_time}`);
          }
        }

        if (addedCount > 0) {
          console.log(`✅ Added ${addedCount} new schedules for ${course.shortname}`);
        } else {
          console.log(`⏭ No new schedules to add for ${course.shortname}`);
        }

      } catch (error) {
        console.error(`❌ Error syncing course ${course.shortname}:`, error.message);
      }
    }

    console.log('✅ Moodle sync completed');

  } catch (error) {
    console.error('❌ Moodle sync error:', error);
  }
}

// Helper function to extract schedules from Moodle course data
function extractSchedulesFromCourse(course) {
  // This is a simplified extraction - in real implementation,
  // you'd parse the course schedule data structure
  const schedules = [];
  
  // Example: Extract typical class schedules
  // In production, this would parse actual Moodle schedule data
  if (course.shortname.includes('CSE')) {
    schedules.push(
      { day_of_week: 1, start_time: '09:00', end_time: '10:30', room_number: 'A101' },
      { day_of_week: 1, start_time: '11:00', end_time: '12:30', room_number: 'A101' },
      { day_of_week: 2, start_time: '09:00', end_time: '10:30', room_number: 'B202' },
      { day_of_week: 3, start_time: '09:00', end_time: '10:30', room_number: 'A101' },
      { day_of_week: 4, start_time: '09:00', end_time: '10:30', room_number: 'B202' },
      { day_of_week: 5, start_time: '09:00', end_time: '10:30', room_number: 'A101' }
    );
  }

  return schedules;
}

// Schedule cron job to run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('⏰ Running Moodle sync cron job...');
  await syncMoodle();
});

console.log('🚀 Moodle sync cron job started - runs every 5 minutes');
