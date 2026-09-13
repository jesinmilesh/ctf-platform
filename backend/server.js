/**
 * XPLOITX // CYBER BATTLEFIELD
 * Express Core API & WebSocket Engine (backend/server.js)
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

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
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Basic settings
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// System Telemetry Endpoint
// --------------------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    platform: 'XPLOITX // CYBER BATTLEFIELD',
    status: 'OPERATIONAL',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    liveOperativesConnected: wsServer.getConnectedCount()
  });
});

// --------------------------------------------------------------------------
// API Route Mounting
// --------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/scoreboard', scoreboardRoutes);
app.use('/api/hints', hintRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/instances', instanceRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/admin', adminRoutes);

// --------------------------------------------------------------------------
// Static Asset & Application Serving
// --------------------------------------------------------------------------
app.use('/assets', express.static(ASSETS_DIR));
app.use('/admin', express.static(ADMIN_DIR));
app.use('/', express.static(PUBLIC_DIR));

// Fallback for Admin SPA or Direct Entry
app.get('/admin', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});

// Central Error Handler
app.use(errorHandler);

// Start listening with Redis EventBus & Cleanup Worker initialization
if (require.main === module) {
  eventBus.init().then(() => {
    cleanupWorker.start();
    server.listen(PORT, () => {
      console.log('========================================================');
      console.log('  XPLOITX // CYBER BATTLEFIELD ENGINE ONLINE');
      console.log(`  PORT: http://localhost:${PORT}`);
      console.log(`  PUBLIC PORTAL: http://localhost:${PORT}/`);
      console.log(`  ADMIN C2 ROOM: http://localhost:${PORT}/admin/`);
      console.log('  STATUS: ALL DEFENSE & OFFENSE GRIDS OPERATIONAL');
      console.log('========================================================');
    });
  }).catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

module.exports = { app, server, broadcastEvent };
