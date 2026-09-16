/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Controller (backend/controllers/challengeController.js)
 */

const db = require('../config/database');
const challengeService = require('../services/challengeService');
const submissionService = require('../services/submissionService');
const fileService = require('../services/fileService');
const instanceManager = require('../instances/instanceManager');
const auditService = require('../services/auditService');

exports.getAll = async (req, res) => {
  // Hydrate in-memory cache from Atlas if needed
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    try {
      await db.syncFromMongo();
    } catch (syncErr) {
      console.error('[CHALLENGE] getAll DB sync failed:', syncErr.message);
      // Return 503 — the client should retry, not treat this as "no challenges"
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Challenge database is temporarily unavailable. Please try again shortly.'
      });
    }
  }
  const challenges = challengeService.getAllPublicChallenges(req.user);
  res.json({ challenges });
};


exports.getOne = async (req, res) => {
  const challengeId = req.params.id;
  const reqId = req.id || 'req-?';
  const userId = req.user ? req.user.id : 'ANONYMOUS';

  if (!challengeId || challengeId === 'undefined' || challengeId === 'null') {
    console.log(`[CHALLENGE] req=${reqId} user=${userId} id=MISSING status=400`);
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

  // Ensure memory cache is hydrated from Atlas if empty
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    try {
      await db.syncFromMongo();
    } catch (syncErr) {
      // Database unavailable — return 503, NOT 404
      console.error(`[CHALLENGE] req=${reqId} user=${userId} id=${challengeId} result=DB_SYNC_FAILED status=503:`, syncErr.message);
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Mission database is temporarily unavailable. Please try again shortly.',
        requestId: reqId
      });
    }
  }

  let challenge = challengeService.getChallengeDetails(challengeId, req.user);

  // Fallback: direct Atlas lookup if not found in memory cache.
  // This handles the case where the cache is stale or a challenge was added
  // after the last hydration without triggering a cache push.
  if (!challenge && db.isMongo && db.mongoDb && challengeId) {
    try {
      const cleanId = String(challengeId).trim();
      const orConditions = [
        { publicRouteId: cleanId },
        { challengeId: cleanId },
        { id: cleanId },
        { id: cleanId.toLowerCase() },
        { mission_id: cleanId },
        { slug: cleanId },
        { slug: cleanId.toLowerCase() }
      ];

      // Add ObjectId query if the ID looks like a valid MongoDB ObjectId
      try {
        const { ObjectId } = require('mongodb');
        if (ObjectId.isValid(cleanId) && cleanId.length === 24) {
          orConditions.push({ _id: new ObjectId(cleanId) });
        }
      } catch (oidErr) {}

      const rawDoc = await db.mongoDb.collection('challenges').findOne({ $or: orConditions });

      if (rawDoc) {
        const item = { ...rawDoc };
        if (rawDoc._id) {
          item._id = rawDoc._id.toString();
        }
        item.id = rawDoc.id ? String(rawDoc.id) : (rawDoc._id ? rawDoc._id.toString() : cleanId);

        // Merge into in-memory cache
        const existing = db.getChallenges().find(c => c.id === item.id);
        if (!existing) {
          Array.prototype.push.call(db.getChallenges(), item);
        } else {
          Object.assign(existing, item);
        }

        // Now look up with the public id
        challenge = challengeService.getChallengeDetails(item.id, req.user);
      }
    } catch (e) {
      // Atlas lookup failed — this is a DB error, not a missing challenge
      console.error(`[CHALLENGE] req=${reqId} user=${userId} id=${challengeId} result=ATLAS_FALLBACK_FAILED status=503:`, e.message);
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Mission database is temporarily unavailable. Please try again shortly.',
        requestId: reqId
      });
    }
  }

  if (!challenge) {
    // Check if challenge exists but is restricted/draft — return 403, not 404
    const anyChallenge = db.getChallenges().find(c =>
      c.id === challengeId ||
      c.mission_id === challengeId ||
      c.slug === challengeId ||
      (c._id && String(c._id) === challengeId)
    );
    if (anyChallenge && anyChallenge.status === 'DRAFT') {
      console.log(`[CHALLENGE] req=${reqId} user=${userId} id=${challengeId} result=DRAFT_RESTRICTED status=403`);
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Mission dossier classified or in draft status' });
    }
    console.log(`[CHALLENGE] req=${reqId} user=${userId} id=${challengeId} result=NOT_FOUND status=404`);
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Mission dossier not found' });
  }

  console.log(`[CHALLENGE] req=${reqId} user=${userId} id=${challengeId} result=FOUND title="${challenge.title}" status=200`);

  if (req.user) {
    const canonicalCId = challenge.id;
    auditService.record({
      action: 'CHALLENGE.VIEWED',
      category: 'CHALLENGE',
      severity: 'INFO',
      actor: req.user,
      resource: { type: 'CHALLENGE', id: canonicalCId, challengeId: canonicalCId },
      result: 'SUCCESS',
      description: `Operative ${req.user.username} viewed mission dossier "${challenge.title}"`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { challengeId: canonicalCId, title: challenge.title }
    }).catch(() => {});
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
    return res.json(result);
  } else {
    const status = result.status === 'FORBIDDEN' || result.status === 'COMPETITION_NOT_ACTIVE' ? 403 :
                   result.status === 'NOT_FOUND' ? 404 : 400;
    return res.status(status).json(result);
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

  // Hydrate cache from Atlas if empty
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    await db.syncFromMongo().catch(() => {});
  }

  const challenge = challengeService.resolveChallenge(challengeId);
  if (!challenge) {
    return res.status(404).json({ success: false, error: 'Challenge not found' });
  }

  const isAdmin = req.user && req.user.role === 'ADMIN';
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Mission classified. Asset access restricted.' });
  }

  const publicId = challenge.id;
  const files = fileService.getChallengeFiles(publicId, challenge._id).map(f => ({
    id: f.id,
    name: f.filename,
    filename: f.filename,
    size: f.file_size_bytes || f.size,
    file_size_bytes: f.file_size_bytes || f.size,
    mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
    sha256: f.sha256,
    downloadUrl: `/api/v1/challenges/${publicId}/files/${f.id}/download`,
    uploadedAt: f.uploaded_at || f.uploadedAt
  }));

  res.json({ success: true, files });
};

exports.downloadChallengeFile = async (req, res) => {
  const { id: challengeId, fileId } = req.params;
  const cleanId = challengeId ? String(challengeId).trim() : '';

  // Hydrate cache from Atlas if empty (important after restart)
  if (db.isMongo && db.mongoDb && db.getChallenges().length === 0) {
    await db.syncFromMongo().catch(() => {});
  }

  const challenge = challengeService.resolveChallenge(cleanId);
  if (!challenge) {
    return res.status(404).json({ error: 'CHALLENGE_NOT_FOUND', message: 'Mission dossier not found' });
  }

  const isAdmin = req.user && req.user.role === 'ADMIN';
  if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
    return res.status(403).json({ error: 'ACCESS_RESTRICTED', message: 'Mission classified. Asset access restricted.' });
  }

  const fileRecord = fileService.getFileRecord(fileId);
  const targetChallengeId = challenge.id;
  const altChallengeIds = [
    challenge.id,
    challenge.challengeId,
    challenge.publicRouteId,
    String(challenge._id || ''),
    challenge.slug,
    challenge.mission_id,
    challenge.legacy_id
  ].filter(Boolean).map(s => String(s).trim());

  const fileBelongsToChallenge = fileRecord && (
    altChallengeIds.includes(String(fileRecord.challenge_id || '').trim()) ||
    altChallengeIds.includes(String(fileRecord.challengeId || '').trim()) ||
    (fileRecord.challengeObjectId && challenge._id && String(fileRecord.challengeObjectId) === String(challenge._id))
  );

  if (!fileRecord || !fileBelongsToChallenge) {
    auditService.record({
      action: 'CHALLENGE_FILE_DOWNLOAD_FAILED',
      category: 'FILE',
      severity: 'WARNING',
      actor: req.user,
      resource: { type: 'FILE', id: fileId, challengeId: targetChallengeId },
      result: 'FAILURE',
      description: 'Asset download failed: asset not found or cross-challenge boundary breach',
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { challengeId: targetChallengeId, fileId, reason: 'FILE_NOT_FOUND_OR_ISOLATED' }
    }).catch(() => {});

    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Challenge asset not found for this mission' });
  }

  try {
    const stream = await fileService.getFileStream(fileRecord);
    if (!stream) {
      return res.status(404).json({ error: 'STORAGE_ERROR', message: 'Asset payload missing from isolated storage' });
    }

    auditService.record({
      action: 'CHALLENGE_FILE_DOWNLOADED',
      category: 'FILE',
      severity: 'INFO',
      actor: req.user,
      resource: { type: 'FILE', id: fileRecord.id, challengeId: targetChallengeId },
      result: 'SUCCESS',
      description: `Challenge asset "${fileRecord.filename}" downloaded by ${req.user?.username || 'PARTICIPANT'}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: {
        challengeId: targetChallengeId,
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        size: fileRecord.file_size_bytes || fileRecord.size,
        sha256: fileRecord.sha256
      }
    }).catch(() => {});

    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
    res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
    res.setHeader('X-SHA256-Checksum', fileRecord.sha256);
    if (fileRecord.file_size_bytes || fileRecord.size) {
      res.setHeader('Content-Length', fileRecord.file_size_bytes || fileRecord.size);
    }

    stream.on('error', (streamErr) => {
      console.error('[STREAM ERROR]:', streamErr);
      if (!res.headersSent) {
        const isMissing = streamErr.code === 'ENOENT' || (streamErr.message && streamErr.message.includes('not found'));
        res.status(isMissing ? 404 : 500).json({
          error: isMissing ? 'FILE_PAYLOAD_NOT_FOUND' : 'STREAM_FAILED',
          message: isMissing ? 'Challenge asset payload missing from server storage' : 'Failed to stream challenge asset'
        });
      }
    });

    stream.pipe(res);
  } catch (err) {
    auditService.record({
      action: 'CHALLENGE_FILE_DOWNLOAD_FAILED',
      category: 'FILE',
      severity: 'WARNING',
      actor: req.user,
      resource: { type: 'FILE', id: fileId, challengeId: targetChallengeId },
      result: 'FAILURE',
      description: `Asset download failed: ${err.message}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { challengeId: targetChallengeId, fileId, error: err.message }
    }).catch(() => {});

    const isNotFound = err.code === 'ENOENT' ||
      (err.message && (err.message.includes('not found') || err.message.includes('STORAGE_ERROR')));
    const statusCode = isNotFound ? 404 : 500;
    const errorCode = isNotFound ? 'FILE_PAYLOAD_NOT_FOUND' : 'DOWNLOAD_FAILED';
    const errorMessage = isNotFound ? 'Challenge asset payload file is missing from server storage' : err.message;

    res.status(statusCode).json({ error: errorCode, message: errorMessage });
  }
};

exports.getByPublicRouteId = async (req, res) => {
  req.params.id = req.params.publicRouteId;
  return exports.getOne(req, res);
};
