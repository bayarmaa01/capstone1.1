const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const db = require('../db');

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all students
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, student_id, name, email, photo_url, created_at FROM students ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single student
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM students WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new student with photo
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { student_id, name, email } = req.body;
    
    if (!student_id || !name) {
      return res.status(400).json({ error: 'student_id and name are required' });
    }
    
    const photoPath = req.file ? req.file.filename : null;
    
    // Insert student into database
    const result = await db.query(
      'INSERT INTO students (student_id, name, email, photo_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [student_id, name, email || null, photoPath]
    );
    
    const student = result.rows[0];
    console.log(`✓ Student created: ${student_id} - ${name}`);
    
    // If photo uploaded, enroll face
    if (req.file) {
      try {
        const formData = new FormData();
        formData.append('student_id', student_id);
        formData.append('image', fs.createReadStream(req.file.path));
        
        const faceServiceUrl = process.env.FACE_SERVICE_URL || 'http://localhost:5001';
        const response = await axios.post(`${faceServiceUrl}/enroll`, formData, {
          headers: formData.getHeaders(),
          timeout: 10000
        });
        
        console.log(`✓ Face enrolled for student ${student_id}`);
        student.face_enrolled = true;
      } catch (faceError) {
        console.error('⚠️  Face enrollment error:', faceError.message);
        student.face_enrolled = false;
        student.face_error = faceError.message;
      }
    }
    
    res.json({ success: true, student });
  } catch (error) {
    console.error('Student creation error:', error);
    if (error.code === '23505') { // Duplicate student_id
      return res.status(400).json({ error: 'Student ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete student
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Delete photo file if exists
    if (result.rows[0].photo_url) {
      const photoPath = path.join(__dirname, '../../uploads/', result.rows[0].photo_url);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }
    
    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;