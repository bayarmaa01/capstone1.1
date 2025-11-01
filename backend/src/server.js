// =======================================
// Automated Attendance System Backend
// =======================================

require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const { startAutoAbsentJob } = require('./autoAbsentJob');
startAutoAbsentJob();
// =======================================
// Middleware Setup
// =======================================

app.use(cors({
  origin: '*', // or ["http://localhost:3000"] for strict CORS
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================================
// Ensure Uploads Directory Exists
// =======================================
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}
app.use('/uploads', express.static(uploadsDir));

// =======================================
// Health Check Endpoint
// =======================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'attendance-backend',
    timestamp: new Date(),
  });
});

// =======================================
// API Routes
// =======================================
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/students', require('./routes/students'));
  app.use('/api/classes', require('./routes/classes'));
  app.use('/api/attendance', require('./routes/attendance'));
  app.use('/api/schedule', require('./routes/schedule'));
  console.log('✅ Routes loaded successfully');
} catch (err) {
  console.error('❌ Error loading routes:', err);
}

// =======================================
// 404 Not Found Handler
// =======================================
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// =======================================
// Error Handling Middleware
// =======================================
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err);
  res.status(500).json({ error: err.message });
});

// =======================================
// Start Server
// =======================================


const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running at: http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
