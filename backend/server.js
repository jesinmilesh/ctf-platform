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
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

// Database Engine
const db = require('./config/database');

// Middleware
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Real-Time EventBus & WebSocket Server
const eventBus = require('./realtime/eventBus');
const wsServer = require('./realtime/websocketServer');
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

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend', 'public');
const ADMIN_DIR = path.join(__dirname, '..', 'frontend', 'admin');
const ASSETS_DIR = path.join(__dirname, '..', 'frontend', 'assets');

// Security imports
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Basic settings
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP to allow fonts and icons
}));

// Apply rate limiting to all requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true, 
  legacyHeaders: false, 
});
app.use(limiter);

// Dynamic CORS for local development, Vercel deployments, and production domains
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    if (process.env.CORS_ORIGIN) {
      const allowed = process.env.CORS_ORIGIN.split(',').map(s => s.trim());
      if (allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie']
}));

app.use(express.json({ limit: '10kb' })); // Limit body payload to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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

// --------------------------------------------------------------------------
// WebSocket Real-time Telemetry Grid (Redis EventBus Attached)
// --------------------------------------------------------------------------
wsServer.attach(server);

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

// --------------------------------------------------------------------------
// API Route Router & Mounting
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

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/teams', teamRoutes);
apiRouter.use('/competitions', competitionRoutes);
apiRouter.use('/challenges', challengeRoutes);
apiRouter.use('/submissions', submissionRoutes);
apiRouter.use('/scoreboard', scoreboardRoutes);
apiRouter.use('/hints', hintRoutes);
apiRouter.use('/announcements', announcementRoutes);
apiRouter.use('/files', fileRoutes);
apiRouter.use('/instances', instanceRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/admin', adminRoutes);

// Mount on /api (standard)
app.use('/api', apiRouter);

// Fallback mount for Serverless Functions where Vercel strips the /api prefix
app.use((req, res, next) => {
  const apiPaths = ['/auth', '/users', '/teams', '/competitions', '/challenges', '/submissions', '/scoreboard', '/hints', '/announcements', '/files', '/instances', '/sync', '/admin', '/status'];
  if (apiPaths.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return apiRouter(req, res, next);
  }
  next();
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

// Fallback for Public SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Central Error Handler
app.use(errorHandler);

// Start listening with Database, Redis EventBus & Cleanup Worker initialization
if (require.main === module) {
  db.init().then(() => {
    return eventBus.init();
  }).then(() => {
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
