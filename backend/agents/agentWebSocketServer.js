/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent WebSocket Gateway (backend/agents/agentWebSocketServer.js)
 *
 * Dedicated WSS endpoint: /api/v1/agents/channel
 * Authenticates incoming agent connections via Bearer token (agent secret).
 * Routes incoming agent messages to agentManager.
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const agentManager = require('./agentManager');

let _broadcaster = null;

/**
 * Attach the Agent WebSocket server to the existing HTTP server.
 * Only connections to the path /api/v1/agents/channel are accepted.
 */
function attach(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/v1/agents/channel'
  });

  wss.on('connection', async (ws, req) => {
    // ── 1. Extract Bearer token from headers ──────────────────────────────
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const agentIdHeader = req.headers['x-agent-id'] || null;

    if (!token || !agentIdHeader) {
      ws.close(4001, 'Missing credentials');
      return;
    }

    // ── 2. Verify token against stored hash ───────────────────────────────
    let agentDoc;
    try {
      const Agent = require('../models/Agent');
      agentDoc = await Agent.findOne({ agentId: agentIdHeader, status: { $ne: 'REVOKED' } });
      if (!agentDoc) {
        ws.close(4003, 'Unknown agent');
        return;
      }
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      if (tokenHash !== agentDoc.secretHash) {
        ws.close(4003, 'Invalid credentials');
        return;
      }
    } catch (err) {
      console.error('[AGENT WS] Auth DB error:', err.message);
      ws.close(1011, 'Internal error');
      return;
    }

    console.log(`[AGENT WS] Authenticated agent: ${agentIdHeader}`);

    // ── 3. Register connection with agentManager ──────────────────────────
    await agentManager.registerConnection(agentDoc, ws);

    // Broadcast AGENT_ONLINE to admin dashboards
    if (_broadcaster) {
      _broadcaster('AGENT_ONLINE', {
        agentId: agentDoc.agentId,
        name: agentDoc.name,
        version: agentDoc.version
      });
    }

    // ── 4. Route incoming messages from agent ─────────────────────────────
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'HEARTBEAT':
          agentManager.updateHeartbeat(agentIdHeader, msg.payload || {});
          // Echo heartbeat back to confirm
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: new Date().toISOString() }));
          // Broadcast telemetry to admins
          if (_broadcaster) {
            _broadcaster('AGENT_HEARTBEAT', {
              agentId: agentIdHeader,
              ...msg.payload
            });
          }
          break;

        case 'INSTANCE_ONLINE':
        case 'INSTANCE_FAILED':
        case 'INSTANCE_STOPPED':
        case 'INSTANCE_EXPIRED': {
          // Forward instance lifecycle events to all connected participants/admins
          const eventPayload = msg.payload || {};
          if (_broadcaster) {
            _broadcaster(msg.type, eventPayload);
          }
          // Persist instance status update to MongoDB
          _persistInstanceUpdate(msg.type, eventPayload).catch(() => {});
          break;
        }

        default:
          // Unrecognized message types are silently dropped (no relay)
          break;
      }
    });

    ws.on('close', () => {
      agentManager.handleDisconnect(agentIdHeader);
      if (_broadcaster) {
        _broadcaster('AGENT_OFFLINE', { agentId: agentIdHeader });
      }
    });
  });

  console.log('[AGENT WS] Agent WebSocket gateway mounted on /api/v1/agents/channel');
  return wss;
}

async function _persistInstanceUpdate(type, payload) {
  const Instance = require('../models/Instance');
  if (!payload.instanceId) return;

  const statusMap = {
    INSTANCE_ONLINE:  'RUNNING',
    INSTANCE_FAILED:  'FAILED',
    INSTANCE_STOPPED: 'STOPPED',
    INSTANCE_EXPIRED: 'EXPIRED'
  };

  const update = { status: statusMap[type] || 'FAILED' };
  if (type === 'INSTANCE_ONLINE') {
    update.url = payload.url || null;
    update.host = payload.host || null;
    update.port = payload.port || null;
    update.connection_url = payload.connectionCommand || null;
    update.startedAt = new Date();
    update.healthCheckStatus = 'HEALTHY';
  } else if (type === 'INSTANCE_FAILED') {
    update.failureReason = payload.error || 'Unknown agent-side failure';
  } else if (type === 'INSTANCE_STOPPED' || type === 'INSTANCE_EXPIRED') {
    update.stoppedAt = new Date();
  }

  await Instance.findOneAndUpdate({ instanceId: payload.instanceId }, { $set: update });
}

function setBroadcaster(fn) {
  _broadcaster = fn;
}

module.exports = { attach, setBroadcaster };
