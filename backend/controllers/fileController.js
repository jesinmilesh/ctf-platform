/**
 * XPLOITX // CYBER BATTLEFIELD
 * Secure File Controller (backend/controllers/fileController.js)
 * Implements Section 28, 29, 38 of Architectural Blueprint
 */

const fileService = require('../services/fileService');
const db = require('../config/database');

exports.downloadFile = async (req, res) => {
  const fileId = req.params.fileId;
  const fileMeta = fileService.getFileRecord(fileId);

  if (!fileMeta) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Challenge asset not found' });
  }

  // Authorization validation (Rule 29)
  const challenge = db.getChallenges().find(c => c.id === (fileMeta.challenge_id || fileMeta.challengeId));
  if (!challenge) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Unauthorized asset access' });
  }

  const isAdmin = req.user && req.user.role === 'ADMIN';
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ error: 'ACCESS_RESTRICTED', message: 'Mission classified. Asset access restricted.' });
  }

  try {
    const stream = await fileService.getFileStream(fileMeta);
    if (!stream) {
      return res.status(404).json({ error: 'STORAGE_ERROR', message: 'File payload missing from isolated storage' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileMeta.filename}"`);
    res.setHeader('Content-Type', fileMeta.mime_type || fileMeta.mimeType || 'application/octet-stream');
    res.setHeader('X-SHA256-Checksum', fileMeta.sha256);
    if (fileMeta.file_size_bytes || fileMeta.size) {
      res.setHeader('Content-Length', fileMeta.file_size_bytes || fileMeta.size);
    }

    stream.on('error', (err) => {
      console.error('[STREAM ERROR]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'STREAM_FAILED', message: 'Failed to stream challenge file' });
      }
    });

    stream.pipe(res);
  } catch (err) {
    // Fallback to local sendFile if stream not supported
    try {
      const diskPath = fileService.getFilePath(fileMeta);
      res.setHeader('Content-Disposition', `attachment; filename="${fileMeta.filename}"`);
      res.setHeader('Content-Type', fileMeta.mime_type || fileMeta.mimeType || 'application/octet-stream');
      res.setHeader('X-SHA256-Checksum', fileMeta.sha256);
      res.sendFile(diskPath);
    } catch (e) {
      res.status(500).json({ error: 'DOWNLOAD_FAILED', message: err.message });
    }
  }
};
