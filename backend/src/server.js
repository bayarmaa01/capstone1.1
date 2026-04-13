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
const metrics = require('./metrics');
const azureStorageService = require('./services/azure_storage');
const db = require('./db');

// Trust proxy for nginx reverse proxy
const app = express();
app.set('trust proxy', 1);

// const { startAutoAbsentJob } = require('./autoAbsentJob');
const lmsSyncService = require('./services/lms_sync');

// Initialize database schema on startup
const initializeDatabase = async () => {
  try {
    const db = require('./db');
    console.log('🔍 Checking database initialization...');
    
    // Check if already initialized
    const result = await db.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'users\')');
    
    if (result.rows[0].exists) {
      console.log('✅ Database already initialized');
      return;
    }
    
    console.log('📝 Initializing database schema...');
    const initSQL = fs.readFileSync(path.join(__dirname, '../sql/init.sql'), 'utf8');
    
    // Execute each statement separately to handle multiple commands
    const statements = initSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement);
      }
    }
    
    console.log('✅ Database schema initialized successfully');
    
    // Verify tables were created
    const tables = await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name');
    console.log('📋 Created tables:', tables.rows.map(row => row.table_name).join(', '));
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('🔍 Error details:', error);
    // Don't exit, just log error and continue
  }
};

// Initialize Azure Storage (only if connection string is provided)
if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
  azureStorageService.initializeContainer().catch(err => {
    console.error('Azure Storage initialization failed:', err.message);
  });
} else {
  console.log('⚠️ Azure Storage connection string not provided - skipping Azure initialization');
}

// Start background jobs (with error handling)
// Temporarily disabled to prevent crashes
// try {
//   startAutoAbsentJob();
// } catch (err) {
//   console.error('Auto absent job failed to start:', err.message);
// }

try {
  lmsSyncService.startScheduledSync();
} catch (err) {
  console.error('LMS sync service failed to start:', err.message);
}

// =======================================
// Metrics Collection
// =======================================
metrics.collectDefaultMetrics();

// Update metrics periodically
setInterval(() => {
  metrics.updateMemoryMetrics();
  metrics.updateEventLoopLag();
}, 5000);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const status = res.statusCode;
    
    // Convert to seconds and ensure number with safety check
    const durationSec = Number(duration) / 1000;
    
    try {
      if (!isNaN(durationSec) && isFinite(durationSec)) {
        metrics.httpRequestDuration
          .labels(method, route, status)
          .observe(durationSec);
      }
    } catch (err) {
      console.error('Metrics duration observe error:', err.message);
    }
    
    metrics.httpRequestTotal
      .labels(method, route, status)
      .inc();
    
    try {
      const requestSize = parseFloat(req.get('content-length')) || 0;
      if (!isNaN(requestSize) && isFinite(requestSize)) {
        metrics.httpRequestSize
          .labels(method, route, status)
          .observe(requestSize);
      }
    } catch (err) {
      console.error('Metrics request size observe error:', err.message);
    }
    
    try {
      const responseSize = parseFloat(res.get('content-length')) || 0;
      if (!isNaN(responseSize) && isFinite(responseSize)) {
        metrics.httpResponseSize
          .labels(method, route, status)
          .observe(responseSize);
      }
    } catch (err) {
      console.error('Metrics response size observe error:', err.message);
    }
    
    // Update connection count
    metrics.activeConnections.inc();
    
    // Update attendance submission metrics
    if (route === '/api/attendance/record' && status === 200) {
      metrics.attendanceSubmissions
        .labels(req.body.class_id || 'unknown', 'success')
        .inc();
    }
    
    // Update face recognition metrics
    if (route === '/api/face/recognize' && status === 200) {
      const confidence = req.body.confidence || 0;
      if (confidence > 0.6) {
        metrics.faceRecognitionSuccess
          .labels(req.body.user_id || 'unknown', confidence > 0.8 ? 'high' : 'medium')
          .inc();
      } else {
        metrics.faceRecognitionFailure
          .labels('low_confidence', req.body.user_id || 'unknown')
          .inc();
      }
    }
    
    // Decrease connection count
    metrics.activeConnections.dec();
  });
  
  next();
});

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
  res.status(200).json({
    status: 'ok',
    service: 'backend'
  });
});

// API Health Check Endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'ok',
      service: 'attendance-backend',
      database: 'connected',
      timestamp: new Date(),
    });
  } catch (error) {
    // Return 500 if DB is down - reflect real state
    res.status(500).json({
      status: 'error',
      service: 'attendance-backend',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date(),
    });
  }
});

// Prometheus Metrics Endpoint
const client = require('prom-client');

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Debug route to test routing
app.get('/api/debug', (req, res) => {
  res.json({
    message: 'Routes are working!',
    timestamp: new Date(),
    routes: Object.keys(app._router.stack)
  });
});

// Debug POST route
app.post('/api/debug', (req, res) => {
  res.json({
    message: 'POST routes are working!',
    body: req.body,
    timestamp: new Date()
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
  app.use('/api/moodle-schedule', require('./routes/moodleSchedule'));
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
const fsPromises = fs.promises;

app.post('/deploy/switch', async (req, res) => {
  try {
    const upstreamConfigPath = path.join(__dirname, '../nginx.upstream.conf');
    let config = await fsPromises.readFile(upstreamConfigPath, 'utf8');
    
    let newEnv;
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
    
    await fsPromises.writeFile(upstreamConfigPath, config);
    
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

const PORT = process.env.PORT || 4000;

// Only start server if not disabled (for testing)
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Start server
    app.listen(4000, '0.0.0.0', () => {
      console.log('Server running on 0.0.0.0:4000');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
 
