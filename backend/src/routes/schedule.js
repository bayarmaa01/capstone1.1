const express = require('express');
const router = express.Router();
const db = require('../db');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toDateOnly = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getThisWeekDateForDay = (dayOfWeek) => {
  const now = new Date();
  const today = toDateOnly(now);
  const diff = dayOfWeek - today.getDay();
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target;
};

const combineDateAndTime = (dateObj, timeStr) => {
  const [h, m] = String(timeStr || '00:00').split(':').map((v) => parseInt(v, 10));
  const out = new Date(dateObj);
  out.setHours(Number.isNaN(h) ? 0 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return out;
};

const classifyStatus = (startAt, endAt, now = new Date()) => {
  if (now < startAt) return 'upcoming';
  if (now >= startAt && now <= endAt) return 'ongoing';
  return 'completed';
};

// University-style smart schedule view (all classes)
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(`
      SELECT 
        cs.id,
        cs.class_id,
        cs.scheduled_date,
        cs.day_of_week,
        cs.start_time,
        cs.end_time,
        cs.room_number,
        c.name AS course_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.is_active = true
      ORDER BY cs.scheduled_date NULLS FIRST, cs.day_of_week, cs.start_time
    `);

    const now = new Date();
    const sessions = rows.rows.map((row) => {
      const sessionDate = row.scheduled_date
        ? toDateOnly(row.scheduled_date)
        : getThisWeekDateForDay(row.day_of_week);
      const startAt = combineDateAndTime(sessionDate, row.start_time);
      const endAt = combineDateAndTime(sessionDate, row.end_time);
      const status = classifyStatus(startAt, endAt, now);

      return {
        id: row.id,
        class_id: row.class_id,
        course_name: row.course_name,
        session_date: sessionDate.toISOString().slice(0, 10),
        start_time: row.start_time,
        end_time: row.end_time,
        day_of_week: row.day_of_week,
        day_name: DAY_NAMES[row.day_of_week] || 'Unknown',
        room_number: row.room_number,
        status,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString()
      };
    }).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

    const todayKey = now.toISOString().slice(0, 10);
    const today = sessions.filter((s) => s.session_date === todayKey);
    const ongoing = sessions.filter((s) => s.status === 'ongoing');
    const upcoming = sessions
      .filter((s) => s.status === 'upcoming')
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      .slice(0, 5);
    const completed = sessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

    res.json({
      today,
      upcoming,
      ongoing,
      completed,
      all: sessions
    });
  } catch (err) {
    console.error('Error fetching smart schedules:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get specific schedule by ID
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid schedule ID" });
    }

    const result = await db.query(`
      SELECT cs.*, c.code as class_code, c.name as class_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("SCHEDULE ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Create new schedule
router.post('/', async (req, res) => {
  try {
    const { class_id, day_of_week, scheduled_date, start_time, end_time, room_number } = req.body;
    const result = await db.query(`
      INSERT INTO class_schedules (class_id, day_of_week, scheduled_date, start_time, end_time, room_number)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;
    `, [class_id, day_of_week, scheduled_date || null, start_time, end_time, room_number || null]);
    res.status(201).json({ success: true, schedule: result.rows[0] });
  } catch (err) {
    console.error('Error creating schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get today's active schedules
router.get('/today', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT cs.*, c.code as class_code, c.name as class_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE (cs.scheduled_date = CURRENT_DATE OR cs.scheduled_date IS NULL)
        AND (cs.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::int)
      ORDER BY cs.start_time;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching today schedules:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get schedules for class
router.get('/class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await db.query(`
      SELECT id, class_id, day_of_week, scheduled_date, start_time, end_time, room_number, is_completed
      FROM class_schedules
      WHERE class_id = $1
      ORDER BY scheduled_date NULLS FIRST, day_of_week, start_time;
    `, [classId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit schedule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, scheduled_date, start_time, end_time, room_number } = req.body;

    console.log('SCHEDULE UPDATE REQUEST:', {
      id,
      day_of_week,
      scheduled_date,
      start_time,
      end_time,
      room_number,
      bodyKeys: Object.keys(req.body)
    });

    // Validate required fields
    if (!id) {
      return res.status(400).json({ error: "Schedule ID is required" });
    }

    const scheduleId = parseInt(id);
    if (isNaN(scheduleId)) {
      return res.status(400).json({ error: "Invalid schedule ID" });
    }

    // Check if schedule exists
    const existingSchedule = await db.query('SELECT id FROM class_schedules WHERE id = $1', [scheduleId]);
    if (existingSchedule.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (day_of_week !== undefined) {
      updateFields.push(`day_of_week = $${paramIndex++}`);
      updateValues.push(day_of_week);
    }
    if (scheduled_date !== undefined) {
      updateFields.push(`scheduled_date = $${paramIndex++}`);
      updateValues.push(scheduled_date);
    }
    if (start_time !== undefined) {
      updateFields.push(`start_time = $${paramIndex++}`);
      updateValues.push(start_time);
    }
    if (end_time !== undefined) {
      updateFields.push(`end_time = $${paramIndex++}`);
      updateValues.push(end_time);
    }
    if (room_number !== undefined) {
      updateFields.push(`room_number = $${paramIndex++}`);
      updateValues.push(room_number);
    }

    // Always update updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(scheduleId);

    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({ error: "No fields to update" });
    }

    const updateQuery = `
      UPDATE class_schedules
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    console.log('EXECUTING QUERY:', updateQuery);
    console.log('VALUES:', updateValues);

    const result = await db.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Schedule not found after update" });
    }

    console.log('SCHEDULE UPDATED SUCCESSFULLY:', result.rows[0]);
    res.json({ success: true, schedule: result.rows[0] });

  } catch (err) {
    console.error('SCHEDULE UPDATE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete schedule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM class_schedules WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting schedule:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get today’s active schedules
router.get('/today', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT cs.*, c.code as class_code, c.name as class_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE (cs.scheduled_date = CURRENT_DATE OR cs.scheduled_date IS NULL)
        AND (cs.day_of_week = EXTRACT(DOW FROM CURRENT_DATE)::int)
      ORDER BY cs.start_time;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching today schedules:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get attendance status for a schedule
router.get('/attendance/status', async (req, res) => {
  try {
    const { scheduleId } = req.query;
    
    if (!scheduleId) {
      return res.status(400).json({ error: 'Schedule ID is required' });
    }

    // Check if schedule exists and is active
    const scheduleResult = await db.query(`
      SELECT cs.*, c.code as class_code, c.name as class_name
      FROM class_schedules cs
      JOIN classes c ON c.id = cs.class_id
      WHERE cs.id = $1
    `, [scheduleId]);

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleResult.rows[0];
    
    // Check if current time is within schedule range
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, etc.
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm format
    
    const isActive = schedule.day_of_week === currentDay && 
                   currentTime >= schedule.start_time && 
                   currentTime < schedule.end_time;

    // Get attendance statistics for this schedule
    const attendanceStats = await db.query(`
      SELECT 
        COUNT(*) as total_students,
        COUNT(CASE WHEN present = true THEN 1 END) as present_count,
        COUNT(CASE WHEN present = false THEN 1 END) as absent_count
      FROM attendance 
      WHERE class_id = $1 
        AND session_date = CURRENT_DATE
    `, [schedule.class_id]);

    const stats = attendanceStats.rows[0];

    res.json({
      success: true,
      schedule: {
        id: schedule.id,
        class_id: schedule.class_id,
        class_code: schedule.class_code,
        class_name: schedule.class_name,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        room_number: schedule.room_number
      },
      is_active: isActive,
      current_time: now.toISOString(),
      attendance_stats: {
        total_students: parseInt(stats.total_students) || 0,
        present_count: parseInt(stats.present_count) || 0,
        absent_count: parseInt(stats.absent_count) || 0,
        attendance_rate: stats.total_students > 0 
          ? ((stats.present_count / stats.total_students) * 100).toFixed(2) + '%'
          : '0%'
      }
    });

  } catch (err) {
    console.error('Error getting attendance status:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
