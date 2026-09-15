/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real-Time WebSocket Server (backend/realtime/websocketServer.js)
 * Implements Section 18 & 31: Broadcasts Redis event envelopes to connected browsers.
 */

const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const eventBus = require('./eventBus');
const db = require('../config/database');

class TacticalWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  _authenticateClient(req) {
    let token = null;

    // 1. From URL query parameter ?token=...
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      token = parsedUrl.searchParams.get('token');
    } catch (e) {}

    // 2. From Cookie header
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
        const [k, v] = c.trim().split('=');
        acc[k] = v;
        return acc;
      }, {});
      token = cookies['xploitx_token'];
    }

    if (!token) return null;

    try {
      const parts = token.split(':');
      if (parts.length >= 4) {
        const [userId, username, timestamp, signature] = parts;
        const payload = `${userId}:${username}:${timestamp}`;
        const secret = process.env.JWT_SECRET || 'c2_command_jwt_super_secret_key_change_in_production';
        const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const tokenTime = parseInt(timestamp, 10);
        const isExpired = isNaN(tokenTime) || (Date.now() - tokenTime) > (7 * 24 * 3600 * 1000);

        if (!isExpired && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
          const user = db.getUsers().find(u => u.id === userId && !u.is_banned);
          if (user) {
            return {
              id: user.id,
              username: user.username,
              role: user.role,
              team_id: user.team_id
            };
          }
        }
      }
    } catch (err) {}

    return null;
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      // Authenticate operative connection
      ws.user = this._authenticateClient(req);
      this.clients.add(ws);

      // Send standard Handshake
      ws.send(JSON.stringify({
        event: 'system.handshake',
        timestamp: new Date().toISOString(),
        payload: {
          status: 'CONNECTED',
          authenticated: !!ws.user,
          operative: ws.user ? ws.user.username : 'GUEST',
          connectedOperatives: this.clients.size,
          serverTime: new Date().toISOString()
        }
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });

      // Respond to client ping heartbeats
      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (e) {}
      });
    });

    // Subscribe to all EventBus events and broadcast with authorization
    eventBus.on('*', (envelope) => {
      this.broadcast(envelope);
    });

    console.log('⚡ [WEBSOCKET ENGINE ATTACHED]: Listening on /ws with authenticated telemetry filtering.');
  }

  broadcast(envelope) {
    if (!envelope) return;

    // Sanitize any sensitive details from broadcast
    const sanitizedEnvelope = { ...envelope };
    if (sanitizedEnvelope.payload && typeof sanitizedEnvelope.payload === 'object') {
      const p = { ...sanitizedEnvelope.payload };
      delete p.flag;
      delete p.submitted_flag;
      delete p.acceptedFlag;
      delete p.secret;
      delete p.password;
      delete p.dockerSocket;
      delete p.containerId; // internal docker detail
      sanitizedEnvelope.payload = p;
    }

    const eventName = String(sanitizedEnvelope.event || sanitizedEnvelope.type || '').toLowerCase();
    const isAdminEvent = eventName.startsWith('admin.') || eventName.startsWith('audit.') || eventName.startsWith('agent.');
    const isInstanceEvent = eventName.startsWith('instance.');

    const rawPublic = JSON.stringify(sanitizedEnvelope);

    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        const clientUser = client.user;
        const isClientAdmin = clientUser && (clientUser.role === 'ADMIN' || clientUser.role === 'SUPER_ADMIN');

        // 1. Admin events only delivered to authenticated admins
        if (isAdminEvent && !isClientAdmin) {
          continue;
        }

        // 2. Instance events strictly filtered by squad or owner
        if (isInstanceEvent && !isClientAdmin) {
          const payload = sanitizedEnvelope.payload || {};
          const targetTeamId = payload.teamId || payload.team_id;
          const targetUserId = payload.userId || payload.user_id || payload.ownerUserId;

          const isSquadMatch = clientUser && targetTeamId && clientUser.team_id === targetTeamId;
          const isUserMatch = clientUser && targetUserId && clientUser.id === targetUserId;

          if (!isSquadMatch && !isUserMatch) {
            continue;
          }
        }

        try {
          client.send(rawPublic);
        } catch (e) {
          this.clients.delete(client);
        }
      }
    }
  }

  getConnectedCount() {
    return this.clients.size;
  }
}

const wsServer = new TacticalWebSocketServer();
module.exports = wsServer;
