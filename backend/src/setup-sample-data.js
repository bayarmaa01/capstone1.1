const db = require('./db');

async function setupSampleData() {
  try {
    console.log('Setting up sample data...');

    // Enroll student in class
    await db.query(`
      INSERT INTO enrollments (class_id, student_id, enrolled_at)
      VALUES (1, 2, NOW())
      ON CONFLICT (class_id, student_id) DO NOTHING
    `);
    console.log('Student enrolled in class');

    // Add sample schedule data
    const schedules = [
      {
        class_id: 1,
        day_of_week: 1, // Monday
        start_time: '09:00',
        end_time: '10:50',
        room_number: 'Room 101'
      },
      {
        class_id: 1,
        day_of_week: 3, // Wednesday
        start_time: '09:00',
        end_time: '10:50',
        room_number: 'Room 101'
      },
      {
        class_id: 1,
        day_of_week: 4, // Thursday
        start_time: '12:00',
        end_time: '12:50',
        room_number: 'Room 202'
      },
      {
        class_id: 1,
        day_of_week: 5, // Friday
        start_time: '14:00',
        end_time: '15:50',
        room_number: 'Room 303'
      }
    ];

    for (const schedule of schedules) {
      await db.query(`
        INSERT INTO class_schedules (class_id, day_of_week, start_time, end_time, room_number, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT DO NOTHING
      `, [schedule.class_id, schedule.day_of_week, schedule.start_time, schedule.end_time, schedule.room_number]);
    }
    console.log('Sample schedule data added');

    // Add some attendance records
    const attendanceRecords = [
      {
        class_id: 1,
        student_id: 2,
        session_date: '2026-04-10',
        present: true,
        method: 'face',
        confidence: 0.95
      },
      {
        class_id: 1,
        student_id: 2,
        session_date: '2026-04-08',
        present: true,
        method: 'face',
        confidence: 0.92
      },
      {
        class_id: 1,
        student_id: 2,
        session_date: '2026-04-03',
        present: false,
        method: null,
        confidence: 0.0
      }
    ];

    for (const record of attendanceRecords) {
      await db.query(`
        INSERT INTO attendance (class_id, student_id, session_date, present, method, confidence, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (class_id, student_id, session_date) DO UPDATE
        SET present = EXCLUDED.present, method = EXCLUDED.method, confidence = EXCLUDED.confidence
      `, [record.class_id, record.student_id, record.session_date, record.present, record.method, record.confidence]);
    }
    console.log('Sample attendance records added');

    console.log('Sample data setup completed!');
    return true;
  } catch (error) {
    console.error('Error setting up sample data:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  setupSampleData()
    .then(success => {
      if (success) {
        console.log('Sample data setup completed successfully');
        process.exit(0);
      } else {
        console.log('Sample data setup failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Setup error:', error);
      process.exit(1);
    });
}

module.exports = { setupSampleData };
