const cron = require('node-cron');
const db = require('./db');

function startAutoAbsentJob() {
  // Run every 2 minutes (adjust as needed)
  cron.schedule('*/2 * * * *', async () => {
    try {
      console.log('🕒 autoAbsentJob: checking schedules to finalize...');

      // 1) find schedules for today that have ended and are not completed
      const schedules = await db.query(`
        SELECT id, class_id, scheduled_date, start_time, end_time
        FROM class_schedules
        WHERE is_completed = false
          AND (scheduled_date = CURRENT_DATE OR scheduled_date IS NULL)
          AND end_time < (CURRENT_TIME AT TIME ZONE 'UTC')::time at time zone 'UTC'; -- using server time
      `);

      if (!schedules.rows.length) {
        // no schedules finished
        return;
      }

      for (const sched of schedules.rows) {
        // skip if holiday
        const holiday = await db.query('SELECT 1 FROM holidays WHERE holiday_date = $1', [sched.scheduled_date || new Date().toISOString().slice(0,10)]);
        if (holiday.rows.length) {
          console.log(`🎉 schedule ${sched.id} is on holiday, skipping`);
          // mark completed to avoid future processing if desired:
          await db.query('UPDATE class_schedules SET is_completed = true WHERE id = $1', [sched.id]);
          continue;
        }

        // get all enrolled students for the class
        const enrolled = await db.query('SELECT student_id FROM enrollments WHERE class_id = $1', [sched.class_id]);
        const enrolledIds = enrolled.rows.map(r => r.student_id);

        // get already-present student_ids for this session_date
        const present = await db.query(`
          SELECT student_id FROM attendance
          WHERE class_id = $1 AND session_date = $2 AND present = true
        `, [sched.class_id, sched.scheduled_date || new Date().toISOString().slice(0,10)]);
        const presentIds = present.rows.map(r => r.student_id);

        // mark all missing as absent
        const missing = enrolledIds.filter(id => !presentIds.includes(id));
        console.log(`autoAbsentJob: class ${sched.class_id} missing ${missing.length} students`);

        for (const sid of missing) {
          await db.query(`
            INSERT INTO attendance (class_id, student_id, session_date, present, status, method, marked_at)
            VALUES ($1, $2, $3, false, 'absent', 'auto', NOW())
            ON CONFLICT (class_id, student_id, session_date) DO UPDATE
            SET present = false, status = 'absent', method = 'auto', marked_at = NOW();
          `, [sched.class_id, sid, sched.scheduled_date || new Date().toISOString().slice(0,10)]);
        }

        // mark schedule completed
        await db.query('UPDATE class_schedules SET is_completed = true WHERE id = $1', [sched.id]);
        console.log(`autoAbsentJob: marked ${missing.length} absent for class ${sched.class_id} (schedule id ${sched.id})`);
      }

    } catch (err) {
      console.error('autoAbsentJob error:', err);
    }
  });
}

module.exports = { startAutoAbsentJob };
