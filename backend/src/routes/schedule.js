const express = require('express');
const router = express.Router();
const db = require('../db');

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

// ✅ Edit schedule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, scheduled_date, start_time, end_time, room_number } = req.body;

    const result = await db.query(`
      UPDATE class_schedules
      SET day_of_week = $1,
          scheduled_date = $2,
          start_time = $3,
          end_time = $4,
          room_number = $5
      WHERE id = $6
      RETURNING *;
    `, [day_of_week, scheduled_date, start_time, end_time, room_number, id]);

    res.json({ success: true, schedule: result.rows[0] });
  } catch (err) {
    console.error('Error updating schedule:', err);
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

module.exports = router;
