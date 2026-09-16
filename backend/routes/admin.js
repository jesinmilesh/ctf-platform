/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Routes (backend/routes/admin.js)
 *
 * SECURITY: Every route in this file MUST pass through:
 *   authMiddleware (attached globally in server.js) → requireAuth → requireAdmin
 *
 * No admin endpoint is accessible without a valid session AND ADMIN role.
 * The role is always verified server-side from the database — never from the request body.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { adminLoginLimiter } = require('../middleware/rateLimit');

// ── File Upload Config ────────────────────────────────────────────────────────
const MAX_FILE_SIZE = parseInt(process.env.MAX_CHALLENGE_FILE_SIZE, 10) || (100 * 1024 * 1024);

const ALLOWED_MIME_TYPES = new Set([
  'application/zip', 'application/x-zip', 'application/x-zip-compressed',
  'application/octet-stream', 'application/x-tar', 'application/gzip',
  'application/x-gzip', 'application/x-7z-compressed', 'application/x-rar-compressed',
  'application/pdf', 'text/plain', 'text/x-python', 'text/javascript', 'text/html',
  'image/png', 'image/jpeg', 'image/gif', 'binary/octet-stream'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter: (req, file, cb) => {
    const dangerous = new Set(['application/x-msdownload', 'application/x-msdos-program']);
    if (dangerous.has(file.mimetype)) {
      return cb(new Error('FILE_TYPE_REJECTED: Executable file types are not allowed.'), false);
    }
    cb(null, true);
  }
});

// ── Dedicated Public Admin Authentication Routes ──────────────────────────────
// Canonical dedicated Admin login: POST /api/v1/admin/auth/login
// Strictly separated from participant authentication
router.post('/auth/login', adminLoginLimiter, authController.adminLogin);

// Admin logout: POST /api/v1/admin/auth/logout
router.post('/auth/logout', authController.logout);

// ── Authorization Guard ───────────────────────────────────────────────────────
// Applied to ALL subsequent routes in this file — no exceptions.
// requireAuth → 401 if not authenticated
// requireAdmin → 403 if authenticated but not ADMIN
router.use(requireAuth, requireAdmin);


// ── Admin Identity ────────────────────────────────────────────────────────────
const adminIdentityHandler = (req, res) => {
  const db = require('../config/database');
  // Always fetch fresh from database — never trust req.user.role alone
  const freshUser = db.getUsers().find(u => u.id === req.user.id);
  if (!freshUser || freshUser.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Admin clearance required.' });
  }
  res.json({
    success: true,
    user: {
      id: freshUser.id,
      username: freshUser.username,
      email: freshUser.email,
      role: freshUser.role,
      callsign: freshUser.callsign
    }
  });
};

router.get('/me', adminIdentityHandler);
router.get('/auth/me', adminIdentityHandler);

// ── Dashboard Overview ────────────────────────────────────────────────────────
router.get('/overview', (req, res) => adminController.getOverview(req, res));
router.get('/dashboard', (req, res) => adminController.getOverview(req, res));

// ── Challenges ────────────────────────────────────────────────────────────────
router.get('/challenges', (req, res) => adminController.getChallenges(req, res));
router.get('/challenges/validate', (req, res) => adminController.validateChallenge?.(req, res) || res.json({ valid: true }));
router.get('/challenges/:id/validate', (req, res) => adminController.validateChallenge?.(req, res) || res.json({ valid: true }));
router.get('/challenges/:id/files', (req, res) => adminController.getChallengeFiles(req, res));
router.post('/challenges', (req, res) => adminController.createChallenge(req, res));
router.put('/challenges/:id', (req, res) => adminController.updateChallenge(req, res));
router.delete('/challenges/:id', (req, res) => adminController.deleteChallenge(req, res));
router.post('/challenges/:id/files', upload.array('files', 10), (req, res) => adminController.uploadChallengeFiles(req, res));
router.delete('/challenges/:id/files/:fileId', (req, res) => adminController.deleteChallengeFile(req, res));
router.post('/challenges/test-flag', (req, res) => adminController.testFlag?.(req, res) || res.json({ valid: false }));

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', (req, res) => adminController.getCategories(req, res));

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.post('/users/:id/ban', (req, res) => adminController.toggleUserBan(req, res));

// ── Teams ─────────────────────────────────────────────────────────────────────
router.get('/teams', (req, res) => adminController.getTeams(req, res));

// ── Submissions ───────────────────────────────────────────────────────────────
router.get('/submissions', (req, res) => adminController.getSubmissions(req, res));

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics', (req, res) => adminController.getAnalytics(req, res));

// ── Instances ─────────────────────────────────────────────────────────────────
router.get('/instances', (req, res) => adminController.getInstances(req, res));

// ── Audit Logs ────────────────────────────────────────────────────────────────
router.get('/audit', (req, res) => adminController.getAuditLogs(req, res));
router.get('/audit-logs', (req, res) => adminController.getAuditLogs(req, res));
router.get('/audit-logs/stats', (req, res) => adminController.getAuditStats(req, res));
router.get('/audit-logs/export', (req, res) => adminController.exportAuditLogs(req, res));
router.get('/audit-logs/:id', (req, res) => adminController.getAuditLogEntry(req, res));

// ── Settings ──────────────────────────────────────────────────────────────────
router.post('/settings', (req, res) => adminController.updateSettings(req, res));

// ── Announcements ─────────────────────────────────────────────────────────────
router.post('/announcements', (req, res) => adminController.dispatchAnnouncement(req, res));

module.exports = router;
