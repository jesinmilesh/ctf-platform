/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Manager (backend/agents/agentManager.js)
 *
 * In-memory registry of connected Docker Agents.
 * Routes typed command envelopes to agents over their live WebSocket connections.
 * Tracks heartbeats, system telemetry, and active instance counts.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class AgentManager extends EventEmitter {
  constructor() {
    super();
    // Map<agentId, AgentEntry>
    this._agents = new Map();
    // Map<agentId, WebSocket>
    this._sockets = new Map();
    // Heartbeat liveness threshold: 45 seconds
    this.HEARTBEAT_TIMEOUT_MS = 45_000;
    this._startLivenessMonitor();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registration & Connection Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called when an agent authenticates over WSS. Updates in-memory entry and
   * persists ONLINE status to MongoDB.
   */
  async registerConnection(agentDoc, ws) {
    const agentId = agentDoc.agentId;

    const entry = {
      agentId,
      name: agentDoc.name,
      deviceId: agentDoc.deviceId,
      version: agentDoc.version || '1.0.0',
      capabilities: agentDoc.capabilities || [],
      status: 'ONLINE',
      systemInfo: agentDoc.systemInfo || {},
      activeInstances: agentDoc.activeInstances || 0,
      lastHeartbeat: Date.now(),
      connectedAt: Date.now()
    };

    this._agents.set(agentId, entry);
    this._sockets.set(agentId, ws);

    // Persist status to MongoDB (non-blocking)
    this._persistStatus(agentId, 'ONLINE', entry.systemInfo).catch(() => {});

    // Handle WebSocket close
    ws.on('close', () => this.handleDisconnect(agentId));
    ws.on('error', () => this.handleDisconnect(agentId));

    this.emit('agent:online', { agentId, name: entry.name });
    console.log(`[AGENT MANAGER] Agent ONLINE: ${agentId} (${entry.name})`);
  }

  handleDisconnect(agentId) {
    const entry = this._agents.get(agentId);
    if (!entry || entry.status === 'OFFLINE') return;

    entry.status = 'OFFLINE';
    this._sockets.delete(agentId);

    this._persistStatus(agentId, 'OFFLINE').catch(() => {});
    this.emit('agent:offline', { agentId, name: entry.name });
    console.log(`[AGENT MANAGER] Agent OFFLINE: ${agentId}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Heartbeat & Telemetry
  // ─────────────────────────────────────────────────────────────────────────

  updateHeartbeat(agentId, payload = {}) {
    const entry = this._agents.get(agentId);
    if (!entry) return;

    entry.lastHeartbeat = Date.now();
    entry.status = 'ONLINE';
    if (payload.systemInfo) entry.systemInfo = payload.systemInfo;
    if (payload.activeInstances !== undefined) entry.activeInstances = payload.activeInstances;

    // Lightweight non-blocking persist every heartbeat
    this._persistStatus(agentId, 'ONLINE', payload.systemInfo, payload.activeInstances).catch(() => {});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command Dispatch
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Send a typed command to a specific agent and wait for acknowledgement.
   * Returns a Promise that resolves with the agent's response payload.
   * Rejects after `timeoutMs` if no reply arrives.
   */
  sendCommand(agentId, type, payload, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const ws = this._sockets.get(agentId);
      const entry = this._agents.get(agentId);

      if (!ws || !entry || entry.status !== 'ONLINE') {
        return reject(Object.assign(new Error('AGENT_OFFLINE: No connected agent available.'), { code: 'AGENT_OFFLINE', statusCode: 503 }));
      }

      const correlationId = crypto.randomUUID();
      const envelope = JSON.stringify({ type, correlationId, payload });

      // One-shot reply listener
      const replyHandler = (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (msg.correlationId !== correlationId) return;
        clearTimeout(timer);
        ws.off('message', replyHandler);
        if (msg.type === 'ERROR') {
          const err = new Error(msg.payload?.message || 'Agent returned error');
          err.code = msg.payload?.code || 'AGENT_ERROR';
          return reject(err);
        }
        resolve(msg.payload);
      };

      const timer = setTimeout(() => {
        ws.off('message', replyHandler);
        reject(Object.assign(new Error('AGENT_TIMEOUT: Agent did not respond in time.'), { code: 'AGENT_TIMEOUT', statusCode: 504 }));
      }, timeoutMs);

      ws.on('message', replyHandler);
      ws.send(envelope);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Routing Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pick the best available agent (first ONLINE agent).
   * Future: support capability-based routing or round-robin.
   */
  getBestAgent() {
    for (const [agentId, entry] of this._agents) {
      if (entry.status === 'ONLINE') return agentId;
    }
    return null;
  }

  getAgent(agentId) {
    return this._agents.get(agentId) || null;
  }

  getAllAgents() {
    return Array.from(this._agents.values());
  }

  isAgentOnline(agentId) {
    const e = this._agents.get(agentId);
    return !!(e && e.status === 'ONLINE');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────

  async _persistStatus(agentId, status, systemInfo, activeInstances) {
    try {
      const Agent = require('../models/Agent');
      const update = {
        status,
        lastHeartbeat: new Date()
      };
      if (systemInfo) update.systemInfo = systemInfo;
      if (activeInstances !== undefined) update.activeInstances = activeInstances;
      await Agent.findOneAndUpdate({ agentId }, { $set: update });
    } catch { /* non-fatal */ }
  }

  _startLivenessMonitor() {
    setInterval(() => {
      const now = Date.now();
      for (const [agentId, entry] of this._agents) {
        if (entry.status === 'ONLINE' && (now - entry.lastHeartbeat) > this.HEARTBEAT_TIMEOUT_MS) {
          console.warn(`[AGENT MANAGER] Heartbeat timeout for ${agentId} — marking OFFLINE`);
          this.handleDisconnect(agentId);
        }
      }
    }, 15_000).unref();
  }
}

module.exports = new AgentManager();
