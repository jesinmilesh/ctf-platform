const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();
/**
 * XPLOITX // CYBER BATTLEFIELD
 * Express Core API & WebSocket Engine (backend/server.js)
 */

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');

// Database Engine
const db = require('./config/database');

// Middleware
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Real-Time EventBus & WebSocket Server
const eventBus = require('./realtime/eventBus');
const wsServer = require('./realtime/websocketServer');
const agentWss = require('./agents/agentWebSocketServer');
const cleanupWorker = require('./instances/cleanupWorker');

// Services & Controllers
const submissionService = require('./services/submissionService');
const adminController = require('./controllers/adminController');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const competitionRoutes = require('./routes/competitions');
const challengeRoutes = require('./routes/challenges');
const submissionRoutes = require('./routes/submissions');
const scoreboardRoutes = require('./routes/scoreboard');
const hintRoutes = require('./routes/hints');
const announcementRoutes = require('./routes/announcements');
const fileRoutes = require('./routes/files');
const instanceRoutes = require('./routes/instances');
const syncRoutes = require('./routes/sync');
const adminRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agents');
const healthRoutes = require('./routes/health.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const ADMIN_DIR = path.join(__dirname, '..', 'frontend', 'admin');
const ASSETS_DIR = path.join(__dirname, '..', 'frontend', 'assets');

// 1. Security & Core Middleware Setup
const { sanitizeInputMiddleware } = require('./middleware/sanitizer');
const { massAssignmentShield, aggregationShield } = require('./middleware/validation');

// Request ID generation first for complete request tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Restrictive Content Security Policy & Security Headers (Section 7, 8, 42, 80)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// Apply rate limiting across endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use(limiter);

// Explicit Production Origins — configured via CORS_ORIGIN environment variable.
// Do NOT hardcode domain names here; use the environment to configure allowed origins.
const TRUSTED_ORIGINS = new Set();

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean).forEach(o => TRUSTED_ORIGINS.add(o));
}


app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    if (TRUSTED_ORIGINS.has(origin)) {
      return callback(null, true);
    }
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('CORS_ORIGIN_DENIED: Request origin is not permitted.'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie', 'X-Request-ID']
}));

// Payload parsing with size limit DoS defense
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Input sanitization against NoSQL injection and Prototype Pollution (Section 14, 68, 69)
app.use(aggregationShield);
app.use(sanitizeInputMiddleware);

// Cookie parsing helper
app.use((req, res, next) => {
  req.cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(c => {
      const [k, v] = c.trim().split('=');
      if (k && v) req.cookies[k] = decodeURIComponent(v);
    });
  }
  next();
});

// CSRF Defense for authenticated cookie requests (Section 5)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (req.cookies && req.cookies['xploitx_token']) {
      const origin = req.headers['origin'];
      const referer = req.headers['referer'];
      const host = req.headers['host'];

      if (origin) {
        try {
          const originHost = new URL(origin).host;
          const isDev = process.env.NODE_ENV !== 'production' && (originHost.includes('localhost') || originHost.includes('127.0.0.1'));
          if (originHost !== host && !TRUSTED_ORIGINS.has(origin) && !isDev) {
            return res.status(403).json({
              success: false,
              error: { code: 'CSRF_REJECTED', message: 'Cross-site request validation failed.' },
              requestId: req.id
            });
          }
        } catch (e) {
          return res.status(403).json({
            success: false,
            error: { code: 'CSRF_REJECTED', message: 'Invalid origin header.' },
            requestId: req.id
          });
        }
      }
    }
  }
  next();
});

// Ensure database initialization (especially in serverless environments)
let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = db.init().catch(err => {
      console.error('[DATABASE] Initialization error:', err.message);
      dbInitPromise = null;
    });
  }
  await dbInitPromise;
  next();
});

// Authentication state detection
app.use(authMiddleware);
app.use(massAssignmentShield);

// --------------------------------------------------------------------------
// WebSocket Real-time Telemetry Grid (Redis EventBus Attached)
// --------------------------------------------------------------------------
wsServer.attach(server);

// --------------------------------------------------------------------------
// Agent WebSocket Channel (Dedicated agent authentication gateway)
// --------------------------------------------------------------------------
agentWss.attach(server);

function broadcastEvent(type, payload) {
  wsServer.broadcast({
    type,
    event: type,
    timestamp: new Date().toISOString(),
    payload
  });
}

// Wire broadcasting into services
submissionService.setBroadcaster(broadcastEvent);
adminController.setBroadcaster(broadcastEvent);
agentWss.setBroadcaster(broadcastEvent);

// --------------------------------------------------------------------------
// Canonical API Route Router & Mounting (Section 9 & 10)
// --------------------------------------------------------------------------
const apiRouter = express.Router();

apiRouter.get('/status', (req, res) => {
  res.json({
    platform: 'XPLOITX // CYBER BATTLEFIELD',
    status: 'OPERATIONAL',
    uptimeSeconds: Math.floor(process.uptime()),
    database: db.isMongo ? 'MongoDB Atlas' : (db.isPostgres ? 'PostgreSQL' : 'In-Memory'),
    databaseConnected: db.connected,
    timestamp: new Date().toISOString(),
    liveOperativesConnected: wsServer ? wsServer.getConnectedCount() : 0
  });
});

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/teams', teamRoutes);
apiRouter.use('/competitions', competitionRoutes);
apiRouter.get('/categories', (req, res) => res.json({ categories: db.getCategories() }));
apiRouter.use('/challenges', challengeRoutes);
apiRouter.use('/submissions', submissionRoutes);
apiRouter.use('/scoreboard', scoreboardRoutes);
apiRouter.use('/leaderboard', scoreboardRoutes);
apiRouter.use('/hints', hintRoutes);
apiRouter.use('/announcements', announcementRoutes);
apiRouter.use('/files', fileRoutes);
apiRouter.use('/instances', instanceRoutes);
apiRouter.use('/notifications', notificationsRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/agents', agentRoutes);

// 1. Canonical API Contract: /api/v1/*
app.use('/api/v1', apiRouter);

// 2. Compatibility mount: /api/*
app.use('/api', apiRouter);

// 3. Fallback mount for direct serverless paths (e.g. /auth/login)
app.use(apiRouter);

// Structured 404 handler for unmatched API routes
app.use(['/api/v1/*', '/api/*'], (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint '${req.originalUrl}' does not exist.`
    },
    requestId: req.id
  });
});

// --------------------------------------------------------------------------
// Static Asset & Application Serving
// --------------------------------------------------------------------------
app.use('/assets', express.static(ASSETS_DIR));
app.use('/admin', express.static(ADMIN_DIR));
app.use('/', express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Fallback for Admin SPA or Direct Entry
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});

// Challenge Public Dossier Route
app.get(['/challenge/:publicRouteId', '/challenge'], (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'challenge.html'));
});

// Fallback for Public SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Central Structured Error Handler (Section 43, 88)
app.use(errorHandler);

const reconciliation = require('./instances/reconciliation');
const dockerClient = require('./instances/dockerClient');

// Start listening with Database, Redis EventBus, Docker Reconciliation & Cleanup Worker initialization
if (require.main === module) {
  db.init().then(() => {
    return eventBus.init();
  }).then(async () => {
    try {
      const isDockerReady = await dockerClient.isAvailable();
      if (isDockerReady) {
        await dockerClient.ensureNetwork('xploitx-instances');
        await reconciliation.reconcile();
      } else {
        console.warn('⚠️ [DOCKER NOTICE]: Docker Engine not reachable at startup. Challenge instances will be enabled once Docker starts.');
      }
    } catch (e) {
      console.warn('[DOCKER INIT NOTICE]:', e.message);
    }

    cleanupWorker.start();
    server.listen(PORT, () => {
      console.log('========================================================');
      console.log('  XPLOITX // CYBER BATTLEFIELD ENGINE ONLINE');
      console.log(`  PORT: http://localhost:${PORT}`);
      console.log(`  PUBLIC PORTAL: http://localhost:${PORT}/`);
      console.log(`  ADMIN C2 ROOM: http://localhost:${PORT}/admin/`);
      console.log(`  DATABASE: ${db.isMongo ? 'MongoDB Atlas' : (db.isPostgres ? 'PostgreSQL' : 'In-Memory')} (${db.connected ? 'ONLINE' : 'CONNECTING'})`);
      console.log('  STATUS: ALL DEFENSE & OFFENSE GRIDS OPERATIONAL');
      console.log('========================================================');
    });
  }).catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

module.exports = { app, server, broadcastEvent };
