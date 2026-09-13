/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real-Time WebSocket Server (backend/realtime/websocketServer.js)
 * Implements Section 18 & 31: Broadcasts Redis event envelopes to connected browsers.
 */

const { WebSocketServer } = require('ws');
const eventBus = require('./eventBus');

class TacticalWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  attach(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);

      // Send standard Handshake
      ws.send(JSON.stringify({
        event: 'system.handshake',
        timestamp: new Date().toISOString(),
        payload: {
          status: 'CONNECTED',
          connectedOperatives: this.clients.size,
          serverTime: new Date().toISOString()
        }
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
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

    // Subscribe to all EventBus events and broadcast
    eventBus.on('*', (envelope) => {
      this.broadcast(envelope);
    });

    console.log('⚡ [WEBSOCKET ENGINE ATTACHED]: Listening on /ws for live battlefield telemetry.');
  }

  broadcast(envelope) {
    const raw = JSON.stringify(envelope);
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        try {
          client.send(raw);
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
