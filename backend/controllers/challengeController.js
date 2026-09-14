/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Controller (backend/controllers/challengeController.js)
 */

const db = require('../config/database');
const challengeService = require('../services/challengeService');
const submissionService = require('../services/submissionService');
const fileService = require('../services/fileService');
const instanceManager = require('../instances/instanceManager');

exports.getAll = async (req, res) => {
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    await db.syncFromMongo().catch(() => {});
  }
  const challenges = challengeService.getAllPublicChallenges(req.user);
  res.json({ challenges });
};

exports.getOne = async (req, res) => {
  const challengeId = req.params.id;

  if (!challengeId || challengeId === 'undefined' || challengeId === 'null') {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid mission identifier provided' });
  }

  if (challengeId === 'preview') {
    return res.json({
      id: 'preview',
      mission_id: 'OP-PREVIEW',
      slug: 'preview-mission',
      title: 'Mission Dossier Live Preview',
      category: 'Web',
      category_color: '#00d8f6',
      difficulty: 'MEDIUM',
      points: 500,
      solve_count: 0,
      description: 'This is an operational live preview of your mission dossier. Save or publish to make active across the digital battlefield.',
      has_instance: false,
      requiresInstance: false,
      instance: null,
      files: [],
      hints: [],
      is_solved: false,
      is_preview: true
    });
  }

  // Ensure memory cache is hydrated if empty
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    await db.syncFromMongo().catch(() => {});
  }

  let challenge = challengeService.getChallengeDetails(challengeId, req.user);

  // Fallback direct Atlas lookup if not found in memory cache
  if (!challenge && db.isMongo && db.mongoDb && challengeId) {
    try {
      const cleanId = String(challengeId).trim();
      const orConditions = [
        { id: cleanId },
        { id: cleanId.toLowerCase() },
        { mission_id: cleanId },
        { slug: cleanId },
        { slug: cleanId.toLowerCase() },
        { title: cleanId },
        { _id: cleanId }
      ];

      // Check ObjectId conversion if valid 24-character hex string
      try {
        const { ObjectId } = require('mongodb');
        if (ObjectId.isValid(cleanId)) {
          orConditions.push({ _id: new ObjectId(cleanId) });
        }
      } catch (oidErr) {}

      const rawDoc = await db.mongoDb.collection('challenges').findOne({ $or: orConditions });

      if (rawDoc) {
        const item = { ...rawDoc };
        if (rawDoc._id) item._id = rawDoc._id.toString();
        if (!item.id && rawDoc._id) item.id = rawDoc._id.toString();
        
        const existing = db.getChallenges().find(c =>
          (item.id && c.id === item.id) ||
          (item._id && (c._id === item._id || c.id === item._id))
        );
        if (!existing) {
          db.getChallenges().push(item);
        } else {
          Object.assign(existing, item);
        }
        challenge = challengeService.getChallengeDetails(item.id || item._id, req.user);
      }
    } catch (e) {
      console.warn('[CHALLENGE CONTROLLER] Fallback Atlas lookup warning:', e.message);
    }
  }

  if (!challenge) {
    // Check if challenge exists but is restricted/draft
    const anyChallenge = db.getChallenges().find(c =>
      c.id === challengeId ||
      c.mission_id === challengeId ||
      c.slug === challengeId ||
      (c._id && String(c._id) === challengeId)
    );
    if (anyChallenge && anyChallenge.status === 'DRAFT') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Mission dossier classified or in draft status' });
    }
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Mission dossier not found' });
  }
  res.json(challenge);
};

exports.submitFlag = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required to submit flags' });
  }

  const { flag } = req.body;
  const challengeId = req.params.id || req.body?.challengeId;
  if (!flag) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Flag payload missing' });
  }
  if (!challengeId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Target challenge identifier missing' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const result = submissionService.submitFlag({
    challengeId,
    submittedFlag: flag,
    user: req.user,
    ip
  });

  if (result.correct) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
};

exports.unlockHint = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  try {
    const hint = challengeService.unlockHint(req.params.id, req.params.hintId, req.user);
    res.json({ success: true, hint });
  } catch (err) {
    res.status(400).json({ error: 'HINT_ERROR', message: err.message });
  }
};

exports.deployInstance = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
  }

  try {
    const result = await instanceManager.spawnInstance(req.params.id, req.user);
    res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || (err.message.includes('NOT_FOUND') ? 404 : err.message.includes('PORT_EXHAUSTION') ? 503 : 400);
    res.status(status).json({ success: false, error: { code: 'INSTANCE_ERROR', message: err.message } });
  }
};

exports.terminateInstance = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
  }

  try {
    const result = await instanceManager.terminateInstance(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    const status = err.message.includes('NOT_FOUND') ? 404 : err.message.includes('AUTH') ? 403 : 400;
    res.status(status).json({ success: false, error: { code: 'INSTANCE_ERROR', message: err.message } });
  }
};

exports.getChallengeFiles = async (req, res) => {
  const challengeId = req.params.id ? String(req.params.id).trim() : '';
  const challenge = db.getChallenges().find(c =>
    c.id === challengeId ||
    c.slug === challengeId ||
    c.mission_id === challengeId ||
    (c._id && String(c._id) === challengeId)
  );
  if (!challenge) {
    return res.status(404).json({ success: false, error: 'Challenge not found' });
  }

  const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Mission classified. Asset access restricted.' });
  }

  const files = fileService.getChallengeFiles(challenge.id, challenge._id).map(f => ({
    id: f.id,
    name: f.filename,
    filename: f.filename,
    size: f.file_size_bytes || f.size,
    file_size_bytes: f.file_size_bytes || f.size,
    mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
    sha256: f.sha256,
    downloadUrl: `/api/v1/challenges/${challenge.id || challenge._id}/files/${f.id}/download`,
    uploadedAt: f.uploaded_at || f.uploadedAt
  }));

  res.json({ success: true, files });
};

exports.downloadChallengeFile = async (req, res) => {
  const { id: challengeId, fileId } = req.params;
  const cleanId = challengeId ? String(challengeId).trim() : '';
  const challenge = db.getChallenges().find(c =>
    c.id === cleanId ||
    c.slug === cleanId ||
    c.mission_id === cleanId ||
    (c._id && String(c._id) === cleanId)
  );
  if (!challenge) {
    return res.status(404).json({ error: 'CHALLENGE_NOT_FOUND', message: 'Mission dossier not found' });
  }

  const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ error: 'ACCESS_RESTRICTED', message: 'Mission classified. Asset access restricted.' });
  }

  const fileRecord = fileService.getFileRecord(fileId);
  const fileBelongsToChallenge = fileRecord && (
    fileRecord.challenge_id === challenge.id ||
    fileRecord.challengeId === challenge.id ||
    (challenge._id && (fileRecord.challenge_id === String(challenge._id) || fileRecord.challengeId === String(challenge._id))) ||
    (challenge.mission_id && (fileRecord.challenge_id === challenge.mission_id || fileRecord.challengeId === challenge.mission_id))
  );

  if (!fileRecord || !fileBelongsToChallenge) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Challenge asset not found for this mission' });
  }

  try {
    const stream = await fileService.getFileStream(fileRecord);
    if (!stream) {
      return res.status(404).json({ error: 'STORAGE_ERROR', message: 'Asset payload missing from isolated storage' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
    res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
    res.setHeader('X-SHA256-Checksum', fileRecord.sha256);
    if (fileRecord.file_size_bytes || fileRecord.size) {
      res.setHeader('Content-Length', fileRecord.file_size_bytes || fileRecord.size);
    }

    stream.on('error', (streamErr) => {
      console.error('[STREAM ERROR]:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'STREAM_FAILED', message: 'Failed to stream challenge asset' });
      }
    });

    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'DOWNLOAD_FAILED', message: err.message });
  }
};
