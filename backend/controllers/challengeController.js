/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Controller (backend/controllers/challengeController.js)
 */

const db = require('../config/database');
const challengeService = require('../services/challengeService');
const submissionService = require('../services/submissionService');
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
  let challenge = challengeService.getChallengeDetails(challengeId, req.user);

  // Fallback direct Atlas lookup if not found in memory cache
  if (!challenge && db.isMongo && db.mongoDb && challengeId) {
    try {
      const cleanId = String(challengeId).trim();
      const rawDoc = await db.collection('challenges').findOne({
        $or: [
          { id: cleanId },
          { mission_id: cleanId },
          { slug: cleanId },
          { title: cleanId },
          { id: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
          { mission_id: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
          { slug: { $regex: new RegExp(`^${cleanId}$`, 'i') } }
        ]
      });

      if (rawDoc) {
        const item = { ...rawDoc };
        delete item._id;
        if (!item.id && rawDoc._id) item.id = rawDoc._id.toString();
        const existing = db.getChallenges().find(c => c.id === item.id);
        if (!existing) {
          db.getChallenges().push(item);
        }
        challenge = challengeService.getChallengeDetails(item.id, req.user);
      }
    } catch (e) {
      console.warn('[CHALLENGE CONTROLLER] Fallback Atlas lookup warning:', e.message);
    }
  }

  if (!challenge) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Mission dossier classified or nonexistent' });
  }
  res.json(challenge);
};

exports.submitFlag = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required to submit flags' });
  }

  const { flag } = req.body;
  if (!flag) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Flag payload missing' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const result = submissionService.submitFlag({
    challengeId: req.params.id,
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
