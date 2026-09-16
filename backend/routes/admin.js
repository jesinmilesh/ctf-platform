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
const MAX_FILE_SIZE = parseInt(process.env.MAX_CHALLENGE_FILE_SIZE, 10) || (50 * 1024 * 1024);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.vbs', '.js.exe', '.scr', '.com', '.msi'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter: (req, file, cb) => {
    const dangerousMimes = new Set([
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-executable',
      'application/x-dosexec'
    ]);
    if (dangerousMimes.has(file.mimetype)) {
      return cb(new Error('FILE_TYPE_REJECTED: Windows/DOS executable files (.exe, .dll) are prohibited.'), false);
    }
    const ext = require('path').extname(file.originalname || '').toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`FILE_TYPE_REJECTED: File extension '${ext}' is prohibited.`), false);
    }
    cb(null, true);
  }
});

// Resilient Multer upload middleware that catches all errors and returns standardized JSON
const challengeUploadMiddleware = (req, res, next) => {
  const uploader = upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'file', maxCount: 1 }
  ]);

  uploader(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError || (typeof err.code === 'string' && err.code.startsWith('LIMIT_'))) {
        let status = 400;
        let code = err.code || 'UPLOAD_ERROR';
        let message = err.message || 'File upload failed.';

        if (err.code === 'LIMIT_FILE_SIZE') {
          status = 413;
          code = 'FILE_TOO_LARGE';
          message = `The uploaded file exceeds the allowed size limit of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`;
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          status = 400;
          code = 'TOO_MANY_FILES';
          message = 'Maximum 10 files allowed per upload.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          status = 400;
          code = 'UNEXPECTED_FIELD';
          message = `Unexpected multipart field '${err.field || 'unknown'}'. Please use field 'files' or 'file'.`;
        }

        return res.status(status).json({
          success: false,
          code,
          message,
          error: { code, message },
          requestId: req.id || 'req-unknown'
        });
      }

      if (typeof err.message === 'string' && err.message.startsWith('FILE_TYPE_REJECTED')) {
        const message = err.message.replace(/^FILE_TYPE_REJECTED:\s*/, '');
        return res.status(415).json({
          success: false,
          code: 'FILE_TYPE_NOT_ALLOWED',
          message,
          error: { code: 'FILE_TYPE_NOT_ALLOWED', message },
          requestId: req.id || 'req-unknown'
        });
      }

      return res.status(400).json({
        success: false,
        code: 'UPLOAD_FAILED',
        message: err.message || 'Unable to upload file.',
        error: { code: 'UPLOAD_FAILED', message: err.message || 'Unable to upload file.' },
        requestId: req.id || 'req-unknown'
      });
    }

    // Normalize req.files to a flat array so controller can process identically
    if (req.files) {
      const allFiles = [];
      if (Array.isArray(req.files.files)) allFiles.push(...req.files.files);
      if (Array.isArray(req.files.file)) allFiles.push(...req.files.file);
      req.files = allFiles;
    }

    next();
  });
};

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
router.get('/challenges/:id', (req, res) => adminController.getChallenge(req, res));
router.post('/challenges', (req, res) => adminController.createChallenge(req, res));
router.put('/challenges/:id', (req, res) => adminController.updateChallenge(req, res));
router.delete('/challenges/:id', (req, res) => adminController.deleteChallenge(req, res));
router.post('/challenges/:id/files', challengeUploadMiddleware, (req, res) => adminController.uploadChallengeFiles(req, res));
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
