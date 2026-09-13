/**
 * XPLOITX // CYBER BATTLEFIELD
 * Secure File Controller (backend/controllers/fileController.js)
 * Implements Section 28, 29, 38 of Architectural Blueprint
 */

const fileService = require('../services/fileService');
const db = require('../config/database');

exports.downloadFile = (req, res) => {
  const fileId = req.params.fileId;
  const fileMeta = fileService.getFileRecord(fileId);

  if (!fileMeta) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Challenge asset not found' });
  }

  // Authorization validation (Rule 29)
  const challenge = db.getChallenges().find(c => c.id === fileMeta.challenge_id);
  if (!challenge) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Unauthorized asset access' });
  }

  const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ error: 'ACCESS_RESTRICTED', message: 'Mission classified. Asset access restricted.' });
  }

  const diskPath = fileService.getFilePath(fileMeta);

  res.setHeader('Content-Disposition', `attachment; filename="${fileMeta.filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-SHA256-Checksum', fileMeta.sha256);
  res.sendFile(diskPath);
};
