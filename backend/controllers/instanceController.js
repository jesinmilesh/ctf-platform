/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Controller (backend/controllers/instanceController.js)
 * Implements Sections 16, 17, 25, 26 of Architectural Blueprint
 */

const instanceManager = require('../instances/instanceManager');

exports.spawn = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  const challengeId = req.params.id || req.body.challengeId;
  if (!challengeId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Target challengeId required' });
  }

  try {
    const result = await instanceManager.spawnInstance(challengeId, req.user);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: 'INSTANCE_SPAWN_FAILED', message: err.message });
  }
};

exports.terminate = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  const { challengeId } = req.body;
  const targetId = req.params.id || challengeId;

  try {
    const result = await instanceManager.terminateInstance(targetId, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: 'INSTANCE_TERMINATE_FAILED', message: err.message });
  }
};

exports.getStatus = (req, res) => {
  const challengeId = req.params.challengeId || req.query.challengeId;
  const active = instanceManager.getActiveInstance(challengeId, req.user);
  res.json({ instance: active });
};

exports.getAll = (req, res) => {
  const instances = instanceManager.getAllInstances();
  res.json({ instances });
};
