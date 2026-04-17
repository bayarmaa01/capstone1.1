const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FACE_SERVICE_URL = (process.env.FACE_SERVICE_URL || 'http://blue_face:5001').replace(/\/$/, '');

router.post('/recognize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'image is required' });
    }

    const { class_id, session_id } = req.body;
    
    // Validate required parameters
    if (!class_id) {
      return res.status(400).json({ error: 'class_id is required' });
    }

    const startedAt = Date.now();
    const form = new FormData();
    form.append('image', req.file.buffer, {
      filename: req.file.originalname || 'frame.jpg',
      contentType: req.file.mimetype || 'image/jpeg'
    });
    form.append('class_id', class_id);
    if (session_id) {
      form.append('session_id', session_id);
    }

    console.log('🧠 Sending to face service:', {
      hasImage: !!req.file,
      class_id,
      session_id
    });

    const response = await axios.post(`${FACE_SERVICE_URL}/recognize-and-mark`, form, {
      headers: form.getHeaders(),
      timeout: 20000
    });

    const elapsedMs = Date.now() - startedAt;
    console.log('🧠 Face proxy result:', {
      status: response.status,
      elapsedMs,
      faces_detected: response.data?.faces_detected,
      matches: Array.isArray(response.data?.matches) ? response.data.matches.length : undefined,
      message: response.data?.message
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ Face proxy error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message || 'Face recognition proxy failed'
    });
  }
});

module.exports = router;
