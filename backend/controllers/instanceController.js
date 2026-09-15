/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Controller (backend/controllers/instanceController.js)
 * Implements Sections 10, 11, 12, 31, 32 of Architectural Specification:
 * - Real Docker Instance Lifecycle API: POST, GET, DELETE /api/v1/instances
 * - Strict server-side RBAC and IDOR protection
 * - Rate limiting and concurrency safeguards
 */

const db = require('../config/database');
const instanceManager = require('../instances/instanceManager');

exports.spawn = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required to spawn challenge instances.' }
    });
  }

  const challengeId = req.body?.challengeId || req.params?.id;
  if (!challengeId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Target challengeId is required.' }
    });
  }

  // 1. Check competition status
  const competitions = db.getCompetitions ? db.getCompetitions() : [];
  const currentComp = competitions[0];
  if (currentComp && currentComp.status !== 'LIVE' && req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: { code: 'COMPETITION_NOT_LIVE', message: 'Instances can only be launched while competition is active.' }
    });
  }

  // 2. Spawn real container instance
  try {
    const result = await instanceManager.spawnInstance(challengeId, req.user);
    return res.status(201).json(result);
  } catch (err) {
    const status = err.statusCode || (err.message.includes('NOT_FOUND') ? 404 : err.message.includes('PORT_EXHAUSTION') ? 503 : 400);
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INSTANCE_SPAWN_FAILED',
        message: err.message || 'Failed to spawn challenge instance.'
      }
    });
  }
};

exports.terminate = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' }
    });
  }

  const targetId = req.params?.id || req.body?.challengeId || req.body?.instanceId;
  if (!targetId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Target instanceId or challengeId is required.' }
    });
  }

  try {
    const result = await instanceManager.terminateInstance(targetId, req.user);
    return res.json(result);
  } catch (err) {
    const status = err.statusCode || (err.message.includes('FORBIDDEN') ? 403 : err.message.includes('NOT_FOUND') ? 404 : err.message.includes('AUTH') ? 403 : 400);
    return res.status(status).json({
      success: false,
      error: {
        code: status === 403 ? 'FORBIDDEN' : 'INSTANCE_TERMINATE_FAILED',
        message: err.message
      }
    });
  }
};

exports.getStatus = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' }
    });
  }

  const targetId = req.params?.id || req.query?.challengeId || req.params?.challengeId;
  if (!targetId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Instance ID or Challenge ID required.' }
    });
  }

  try {
    const status = await instanceManager.getAuthoritativeStatus(targetId, req.user);
    if (!status) {
      return res.json({ success: true, instance: null });
    }
    return res.json({ success: true, instance: status });
  } catch (err) {
    const status = err.statusCode || (err.message.includes('FORBIDDEN') ? 403 : err.message.includes('AUTH') ? 401 : 500);
    return res.status(status).json({
      success: false,
      error: { code: status === 403 ? 'FORBIDDEN' : 'STATUS_CHECK_FAILED', message: err.message }
    });
  }
};

exports.getAll = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' }
    });
  }

  const isAdmin = req.user.role === 'ADMIN';
  const all = instanceManager.getAllInstances();

  if (isAdmin) {
    return res.json({ success: true, instances: all });
  }

  // Filter for player's squad
  const teamId = req.user.team_id || req.user.teamId;
  const userInstances = all.filter(i =>
    (teamId && (i.teamId === teamId || i.team_id === teamId)) ||
    (i.ownerUserId === req.user.id || i.userId === req.user.id || i.user_id === req.user.id)
  );

  return res.json({ success: true, instances: userInstances });
};
