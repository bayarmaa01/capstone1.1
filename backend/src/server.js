// =======================================
// Automated Attendance System Backend
// =======================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Trust proxy for nginx reverse proxy
const app = express();
app.set('trust proxy', 1);

const { startAutoAbsentJob } = require('./autoAbsentJob');
const lmsSyncService = require('./services/lms_sync');
const azureStorageService = require('./services/azure_storage');

// Initialize Azure Storage (only if connection string is provided)
if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
  azureStorageService.initializeContainer().catch(console.error);
} else {
  console.log('⚠️ Azure Storage connection string not provided - skipping Azure initialization');
}

// Start background jobs
startAutoAbsentJob();
lmsSyncService.startScheduledSync();
// =======================================
// Middleware Setup
// =======================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://attendance-ml.duckdns.org"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});
app.use('/api/auth', authLimiter);

app.use(cors({
  origin: ['https://attendance-ml.duckdns.org', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// API Health Check Endpoint
app.get('/api/health', (req, res) => {
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
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/storage', require('./routes/storage'));
  app.use('/api/moodle', require('./routes/moodle'));
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

// Only start server if not disabled (for testing)
if (process.env.DISABLE_SERVER_START !== 'true') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend server running at: http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
}
 
