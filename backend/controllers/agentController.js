/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Controller (backend/controllers/agentController.js)
 *
 * REST endpoints for Docker Agent management:
 *   POST /api/v1/agents/generate-code   — Admin generates short-lived pairing code
 *   POST /api/v1/agents/pair            — Agent consumes code, registers itself
 *   GET  /api/v1/agents                 — Admin lists all agents with live status
 *   GET  /api/v1/agents/:id             — Admin fetches single agent details
 *   POST /api/v1/agents/:id/revoke      — Admin revokes an agent permanently
 *   GET  /api/v1/agents/:id/instances   — Admin fetches active containers on agent
 */

const crypto = require('crypto');
const Agent = require('../models/Agent');
const AgentPairingCode = require('../models/AgentPairingCode');
const Instance = require('../models/Instance');
const agentManager = require('../agents/agentManager');

// ─── Generate pairing code (Admin only) ────────────────────────────────────
exports.generateCode = async (req, res) => {
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  try {
    // Clean up expired codes first
    await AgentPairingCode.deleteMany({ expiresAt: { $lte: new Date() } });

    const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
    const code = `XPL-${raw.slice(0,4)}-${raw.slice(4,8)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await AgentPairingCode.create({
      code,
      generatedBy: req.user.id || req.user._id,
      expiresAt,
      used: false,
      usedByAgentId: null
    });

    return res.status(201).json({
      success: true,
      pairingCode: code,
      expiresAt: expiresAt.toISOString(),
      instructions: `Run on your Windows PC:\n  cd xploitx-docker-agent && npm run pair ${code}`
    });
  } catch (err) {
    console.error('[AGENT CTRL] generateCode error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// ─── Pair agent (called by agent daemon during npm run pair) ───────────────
exports.pair = async (req, res) => {
  const { pairingCode, name, deviceId, version, capabilities, systemInfo } = req.body || {};

  if (!pairingCode || !name || !deviceId) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'pairingCode, name, and deviceId are required.' }
    });
  }

  try {
    // 1. Validate pairing code
    const codeDoc = await AgentPairingCode.findOne({
      code: pairingCode,
      used: false,
      expiresAt: { $gt: new Date() }
    });
    if (!codeDoc) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'Pairing code is invalid, expired, or already used.' }
      });
    }

    // 2. Check for existing agent with same deviceId
    let agentDoc = await Agent.findOne({ deviceId });

    const agentId = agentDoc?.agentId || `agent-${deviceId.slice(0, 8)}-${crypto.randomBytes(3).toString('hex')}`;
    const agentSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(agentSecret).digest('hex');

    if (agentDoc) {
      // Re-pair: rotate secret
      agentDoc.secretHash = secretHash;
      agentDoc.name = name;
      agentDoc.version = version || agentDoc.version;
      agentDoc.capabilities = capabilities || agentDoc.capabilities;
      agentDoc.status = 'OFFLINE'; // Will go ONLINE when WSS connects
      await agentDoc.save();
    } else {
      agentDoc = await Agent.create({
        agentId,
        name,
        deviceId,
        owner: codeDoc.generatedBy,
        status: 'OFFLINE',
        version: version || '1.0.0',
        capabilities: capabilities || ['docker', 'http', 'tcp'],
        systemInfo: systemInfo || {},
        secretHash
      });
    }

    // 3. Mark code as used
    await AgentPairingCode.findOneAndUpdate(
      { code: pairingCode },
      { $set: { used: true, usedByAgentId: agentId } }
    );

    console.log(`[AGENT CTRL] Paired new agent: ${agentId} (${name})`);

    return res.status(201).json({
      success: true,
      agentId,
      agentSecret,  // ⚠️ Delivered ONCE — agent must store securely in config/agent.json
      backendWssUrl: `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/api/v1/agents/channel`,
      message: 'Agent paired successfully. Store agentSecret securely — it will not be shown again.'
    });
  } catch (err) {
    console.error('[AGENT CTRL] pair error:', err.message);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// ─── List all agents ────────────────────────────────────────────────────────
exports.list = async (req, res) => {
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  try {
    const agents = await Agent.find({ status: { $ne: 'REVOKED' } })
      .select('-secretHash')
      .sort({ lastHeartbeat: -1 })
      .lean();

    // Merge live in-memory telemetry (more up-to-date than MongoDB)
    const liveAgents = agentManager.getAllAgents();
    const liveMap = Object.fromEntries(liveAgents.map(a => [a.agentId, a]));

    const merged = agents.map(doc => {
      const live = liveMap[doc.agentId];
      return {
        ...doc,
        status: live?.status || doc.status,
        systemInfo: live?.systemInfo || doc.systemInfo,
        activeInstances: live?.activeInstances ?? doc.activeInstances,
        lastHeartbeat: live?.lastHeartbeat ? new Date(live.lastHeartbeat).toISOString() : doc.lastHeartbeat
      };
    });

    return res.json({ success: true, agents: merged, total: merged.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// ─── Get single agent ───────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  try {
    const agentDoc = await Agent.findOne({ agentId: req.params.id }).select('-secretHash').lean();
    if (!agentDoc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found.' } });
    }
    const live = agentManager.getAgent(req.params.id);
    return res.json({
      success: true,
      agent: {
        ...agentDoc,
        status: live?.status || agentDoc.status,
        systemInfo: live?.systemInfo || agentDoc.systemInfo,
        activeInstances: live?.activeInstances ?? agentDoc.activeInstances
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// ─── Revoke agent ────────────────────────────────────────────────────────────
exports.revoke = async (req, res) => {
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  try {
    const agentDoc = await Agent.findOne({ agentId: req.params.id });
    if (!agentDoc) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found.' } });
    }

    agentDoc.status = 'REVOKED';
    agentDoc.revokedAt = new Date();
    await agentDoc.save();

    // Close live connection if present
    const ws = agentManager._sockets.get(req.params.id);
    if (ws) ws.close(4003, 'Agent revoked by administrator');
    agentManager.handleDisconnect(req.params.id);
    agentManager._agents.delete(req.params.id);

    return res.json({ success: true, message: `Agent ${req.params.id} revoked.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};

// ─── Get agent's active instances ───────────────────────────────────────────
exports.getInstances = async (req, res) => {
  const isAdmin = req.user?.role === 'ADMIN';
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
  }

  try {
    const instances = await Instance.find({
      'metadata.agentId': req.params.id,
      status: { $in: ['RUNNING', 'STARTING', 'HEALTH_CHECKING', 'STOPPING'] }
    }).lean();

    return res.json({ success: true, instances, total: instances.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
};
