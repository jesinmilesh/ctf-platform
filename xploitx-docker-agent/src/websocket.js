/**
 * XPLOITX // CYBER BATTLEFIELD
 * Secure Agent WebSocket Client Channel (src/websocket.js)
 * Implements Section 4 & 6 of Master Architecture: Outbound Authenticated Encrypted Communication & Real Heartbeats.
 */

const WebSocket = require('ws');
const os = require('os');
const EventEmitter = require('events');

class AgentWebSocketClient extends EventEmitter {
  constructor({ wsUrl, credentials, instanceManager, heartbeatInterval = 15 }) {
    super();
    this.wsUrl = wsUrl;
    this.credentials = credentials;
    this.instanceManager = instanceManager;
    this.heartbeatIntervalMs = heartbeatInterval * 1000;
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.connected = false;
  }

  connect() {
    if (!this.credentials || !this.credentials.agentId || !this.credentials.agentSecret) {
      throw new Error('AGENT_CONFIG_ERROR: Missing agent credentials. Agent must be paired first.');
    }

    const targetUrl = new URL(this.wsUrl);
    targetUrl.searchParams.set('agentId', this.credentials.agentId);
    targetUrl.searchParams.set('agentSecret', this.credentials.agentSecret);

    console.log(`[AGENT WS] Connecting to C2 backend at ${this.wsUrl} (Agent: ${this.credentials.agentId})...`);

    this.ws = new WebSocket(targetUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${this.credentials.agentSecret}`,
        'X-Agent-ID': this.credentials.agentId,
        'X-Agent-Version': '1.0.0'
      }
    });

    this.ws.on('open', () => {
      this.connected = true;
      console.log(`⚡ [AGENT WS CONNECTED]: Authenticated communication channel online with C2 Backend.`);
      this._startHeartbeat();
      this.emit('connected');
    });

    this.ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this._handleMessage(msg);
      } catch (err) {
        console.error('[AGENT WS MESSAGE ERROR]:', err);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      this._stopHeartbeat();
      console.warn(`[AGENT WS DISCONNECTED]: Channel closed (Code: ${code}, Reason: ${reason || 'none'}).`);
      this.emit('disconnected');
      if (this.shouldReconnect) {
        this._scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      console.error(`[AGENT WS ERROR]: ${err.message}`);
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    this._stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    console.log(`[AGENT WS] Reconnecting in 3 seconds...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._sendHeartbeat(); // send immediately on connect
    this.heartbeatTimer = setInterval(() => this._sendHeartbeat(), this.heartbeatIntervalMs);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _sendHeartbeat() {
    const active = this.instanceManager.getActiveInstances();
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const cpuLoad = os.loadavg ? os.loadavg()[0] : 0;

    const payload = {
      type: 'HEARTBEAT',
      agentId: this.credentials.agentId,
      status: 'ONLINE',
      version: '1.0.0',
      activeInstances: active.length,
      systemInfo: {
        platform: process.platform,
        hostname: os.hostname(),
        cpus: os.cpus().length,
        totalMemoryMB: totalMem,
        freeMemoryMB: freeMem,
        cpuUsagePercent: Math.min(100, Math.round(cpuLoad * 10))
      },
      timestamp: new Date().toISOString()
    };

    this.send(payload);
  }

  async _handleMessage(msg) {
    const { action, requestId, payload } = msg;

    if (action === 'PING') {
      this.send({ type: 'PONG', timestamp: new Date().toISOString() });
      return;
    }

    if (action === 'START_INSTANCE') {
      console.log(`[AGENT] Received START_INSTANCE command for mission ${payload.challengeId} (Instance: ${payload.instanceId})...`);
      try {
        const instance = await this.instanceManager.spawnInstance(payload);
        this.send({
          type: 'RESPONSE',
          action: 'START_INSTANCE',
          requestId,
          success: true,
          instanceId: payload.instanceId,
          instance
        });
      } catch (err) {
        this.send({
          type: 'RESPONSE',
          action: 'START_INSTANCE',
          requestId,
          success: false,
          instanceId: payload.instanceId,
          error: {
            code: 'INSTANCE_SPAWN_FAILED',
            message: err.message
          }
        });
      }
      return;
    }

    if (action === 'STOP_INSTANCE' || action === 'TERMINATE_INSTANCE') {
      console.log(`[AGENT] Received TERMINATE command for instance ${payload.instanceId}...`);
      try {
        const res = await this.instanceManager.terminateInstance(payload.instanceId, payload.reason || 'STOPPED');
        this.send({
          type: 'RESPONSE',
          action: 'STOP_INSTANCE',
          requestId,
          success: true,
          instanceId: payload.instanceId,
          result: res
        });
      } catch (err) {
        this.send({
          type: 'RESPONSE',
          action: 'STOP_INSTANCE',
          requestId,
          success: false,
          instanceId: payload.instanceId,
          error: { message: err.message }
        });
      }
      return;
    }

    if (action === 'RESTART_INSTANCE') {
      console.log(`[AGENT] Received RESTART command for instance ${payload.instanceId}...`);
      try {
        const instance = await this.instanceManager.restartInstance(payload.instanceId);
        this.send({
          type: 'RESPONSE',
          action: 'RESTART_INSTANCE',
          requestId,
          success: true,
          instanceId: payload.instanceId,
          instance
        });
      } catch (err) {
        this.send({
          type: 'RESPONSE',
          action: 'RESTART_INSTANCE',
          requestId,
          success: false,
          instanceId: payload.instanceId,
          error: { message: err.message }
        });
      }
      return;
    }

    if (action === 'QUERY_INSTANCES') {
      this.send({
        type: 'RESPONSE',
        action: 'QUERY_INSTANCES',
        requestId,
        success: true,
        instances: Array.from(this.instanceManager.instances.values())
      });
      return;
    }
  }
}

module.exports = AgentWebSocketClient;
