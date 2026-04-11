const client = require('prom-client');

// Safe singleton pattern for metrics initialization
const collectDefaultMetrics = () => {
  if (!global._metricsInitialized) {
    const collectDefaultMetrics = require('prom-client').collectDefaultMetrics;
    collectDefaultMetrics({
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      gctimeBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
    global._metricsInitialized = true;
  }
};

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000]
});

const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000]
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const nodejsHeapSizeUsed = new client.Gauge({
  name: 'nodejs_heap_size_used_bytes',
  help: 'Process heap size used in bytes'
});

const nodejsHeapSizeTotal = new client.Gauge({
  name: 'nodejs_heap_size_total_bytes',
  help: 'Process heap size total in bytes'
});

const nodejsExternalMemory = new client.Gauge({
  name: 'nodejs_external_memory_bytes',
  help: 'Process external memory size in bytes'
});

const nodejsRssMemory = new client.Gauge({
  name: 'nodejs_rss_memory_bytes',
  help: 'Process RSS memory size in bytes'
});

const eventLoopLag = new client.Gauge({
  name: 'app_eventloop_lag_seconds',
  help: 'Application event loop lag in seconds'
});

const attendanceSubmissions = new client.Counter({
  name: 'attendance_submissions_total',
  help: 'Total number of attendance submissions',
  labelNames: ['class_id', 'status']
});

const faceRecognitionSuccess = new client.Counter({
  name: 'face_recognition_success_total',
  help: 'Total number of successful face recognitions',
  labelNames: ['user_id', 'confidence_level']
});

const faceRecognitionFailure = new client.Counter({
  name: 'face_recognition_failure_total',
  help: 'Total number of failed face recognitions',
  labelNames: ['reason', 'user_id']
});

const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const databaseQueries = new client.Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table']
});

const updateMemoryMetrics = () => {
  const memUsage = process.memoryUsage();
  nodejsHeapSizeUsed.set(memUsage.heapUsed);
  nodejsHeapSizeTotal.set(memUsage.heapTotal);
  nodejsExternalMemory.set(memUsage.external);
  nodejsRssMemory.set(memUsage.rss);
};

const updateEventLoopLag = () => {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1e9;
    eventLoopLag.set(lag);
  });
};

module.exports = {
  collectDefaultMetrics,
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
  nodejsHeapSizeUsed,
  nodejsHeapSizeTotal,
  nodejsExternalMemory,
  nodejsRssMemory,
  eventLoopLag,
  attendanceSubmissions,
  faceRecognitionSuccess,
  faceRecognitionFailure,
  databaseConnections,
  databaseQueries,
  updateMemoryMetrics,
  updateEventLoopLag
};
