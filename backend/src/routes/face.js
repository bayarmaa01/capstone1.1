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

    const form = new FormData();
    form.append('image', req.file.buffer, {
      filename: req.file.originalname || 'frame.jpg',
      contentType: req.file.mimetype || 'image/jpeg'
    });

    const response = await axios.post(`${FACE_SERVICE_URL}/recognize-and-mark`, form, {
      headers: form.getHeaders(),
      timeout: 20000
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message || 'Face recognition proxy failed'
    });
  }
});

module.exports = router;
