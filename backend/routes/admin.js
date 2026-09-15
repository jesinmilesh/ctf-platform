/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Routes (backend/routes/admin.js)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/roles');

// Configure multer memory storage for secure challenge asset uploads.
// Size limit is configurable via MAX_CHALLENGE_FILE_SIZE env var (default: 100MB).
// The backend fileService independently validates file content via SHA-256 and magic bytes.
const MAX_FILE_SIZE = parseInt(process.env.MAX_CHALLENGE_FILE_SIZE, 10) || (100 * 1024 * 1024);

const ALLOWED_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'application/pdf',
  'text/plain',
  'text/x-python',
  'text/javascript',
  'text/html',
  'image/png',
  'image/jpeg',
  'image/gif',
  'binary/octet-stream'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    // Accept files with known challenge MIME types. Unknown types are also accepted
    // since the real validation happens in fileService (magic bytes + extension check).
    // Only reject files that are explicitly known-dangerous executable types with no
    // legitimate CTF use case.
    const dangerous = new Set([
      'application/x-msdownload',  // .exe
      'application/x-msdos-program'
    ]);
    if (dangerous.has(file.mimetype)) {
      return cb(new Error('FILE_TYPE_REJECTED: Executable file types are not allowed.'), false);
    }
    cb(null, true);
  }
});

// Admin Challenge Asset Management (Section 4, 5, 16, 30)
router.get('/challenges/:id/files', (req, res) => adminController.getChallengeFiles(req, res));
router.post('/challenges/:id/files', upload.array('files', 10), (req, res) => adminController.uploadChallengeFiles(req, res));
router.delete('/challenges/:id/files/:fileId', (req, res) => adminController.deleteChallengeFile(req, res));


router.get('/categories', (req, res) => adminController.getCategories(req, res));
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.post('/users/:id/ban', (req, res) => adminController.toggleUserBan(req, res));
router.get('/teams', (req, res) => adminController.getTeams(req, res));
router.get('/submissions', (req, res) => adminController.getSubmissions(req, res));
router.get('/analytics', (req, res) => adminController.getAnalytics(req, res));
router.get('/instances', (req, res) => adminController.getInstances(req, res));
router.get('/audit', (req, res) => adminController.getAuditLogs(req, res));
router.get('/audit-logs', (req, res) => adminController.getAuditLogs(req, res));
router.get('/audit-logs/stats', (req, res) => adminController.getAuditStats(req, res));
router.get('/audit-logs/export', (req, res) => adminController.exportAuditLogs(req, res));
router.get('/audit-logs/:id', (req, res) => adminController.getAuditLogEntry(req, res));
router.post('/settings', (req, res) => adminController.updateSettings(req, res));
router.post('/announcements', (req, res) => adminController.dispatchAnnouncement(req, res));

module.exports = router;
