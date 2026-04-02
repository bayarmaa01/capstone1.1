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
      connectSrc: ["'self'", "http://attendance-ml.duckdns.org"],
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
  origin: ['http://attendance-ml.duckdns.org', 'http://localhost:3000'],
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
// Blue/Green Deployment Switch API
// =======================================
const fs = require('fs').promises;
const path = require('path');

app.post('/deploy/switch', async (req, res) => {
  try {
    const upstreamConfigPath = path.join(__dirname, '../nginx.upstream.conf');
    let config = await fs.readFile(upstreamConfigPath, 'utf8');
    
    // Toggle between blue and green
    if (config.includes('blue_backend')) {
      config = config.replace(/blue_backend/g, 'green_backend');
      config = config.replace(/blue_frontend/g, 'green_frontend');
      config = config.replace(/blue_face/g, 'green_face');
      newEnv = 'green';
    } else {
      config = config.replace(/green_backend/g, 'blue_backend');
      config = config.replace(/green_frontend/g, 'blue_frontend');
      config = config.replace(/green_face/g, 'blue_face');
      newEnv = 'blue';
    }
    
    await fs.writeFile(upstreamConfigPath, config);
    
    // Reload nginx
    const { exec } = require('child_process');
    exec('nginx -s reload', (error, stdout, stderr) => {
      if (error) {
        console.error('Nginx reload failed:', error);
        return res.status(500).json({ error: 'Failed to reload nginx' });
      }
      console.log(`✅ Switched to ${newEnv} environment`);
      res.json({ 
        message: `Switched to ${newEnv} environment`,
        environment: newEnv,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Switch failed:', error);
    res.status(500).json({ error: 'Failed to switch environment' });
  }
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP backend_health Health status of backend service
# TYPE backend_health gauge
backend_health{service="attendance-backend",status="ok"} 1

# HELP backend_uptime_seconds Uptime in seconds
# TYPE backend_uptime_seconds counter
backend_uptime_seconds ${process.uptime()}

# HELP nodejs_heap_size_used_bytes Node.js heap size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}

# HELP nodejs_heap_size_total_bytes Node.js heap size total
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${process.memoryUsage().heapTotal}
  `.trim());
});


const PORT = process.env.PORT || 4000;

// Only start server if not disabled (for testing)
if (process.env.DISABLE_SERVER_START !== 'true') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend server running at: http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
}
 
