/**
 * XPLOITX // CYBER BATTLEFIELD
 * Files Routes (backend/routes/files.js)
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const db = require('../config/database');
const { requireAuth, requireSquadMembership } = require('../middleware/auth');

router.use(requireAuth, requireSquadMembership);

router.get('/', (req, res) => {
  const isAdmin = req.user && req.user.role === 'ADMIN';
  const challenges = db.getChallenges();
  const publishedChallengeIds = new Set(
    challenges.filter(c => c.status === 'PUBLISHED' || c.status === 'LIVE' || isAdmin).map(c => c.id)
  );

  const files = db.getFiles()
    .filter(f => publishedChallengeIds.has(f.challenge_id || f.challengeId))
    .map(f => ({
      id: f.id,
      challenge_id: f.challenge_id || f.challengeId,
      filename: f.filename,
      size: f.file_size_bytes || f.size,
      mime_type: f.mime_type || f.mimeType,
      sha256: f.sha256,
      uploaded_at: f.uploaded_at || f.uploadedAt
    }));

  res.json({ files });
});

router.get('/:fileId', fileController.downloadFile);

module.exports = router;
