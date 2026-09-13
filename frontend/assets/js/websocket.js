/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real-time Tactical WebSocket Client (assets/js/websocket.js)
 * Implements Section 31 & 32: Redis event envelopes, exponential reconnect backoff,
 * client heartbeat pings, and authoritative state resync (/api/sync).
 */

class TacticalSocket {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.wasConnectedOnce = false;
    this.heartbeatTimer = null;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = window.XPLOITX_WS_URL || `${protocol}//${location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.updateStatusDot(true);
        console.log('⚡ [TELEMETRY GRID ONLINE]: Connected to C2 broadcast telemetry socket.');

        // If reconnecting after a drop, execute authoritative resync
        if (this.wasConnectedOnce) {
          console.log('🔄 [RECONNECT DETECTED]: Initiating state recovery snapshot via /api/sync...');
          this.triggerResync();
        }
        this.wasConnectedOnce = true;
        this.reconnectAttempts = 0;

        // Start ping heartbeat
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          this.handleEvent(envelope);
        } catch (e) {
          console.warn('[TELEMETRY] Socket message parse error:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.updateStatusDot(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[TELEMETRY] Connection anomaly detected, preparing failover backoff.');
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff with jitter: 1.5x up to 15s max + 500ms jitter
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 15000) + Math.floor(Math.random() * 500);

    console.log(`[TELEMETRY] Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
      }
    }, 20000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async triggerResync() {
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const syncData = await res.json();
        console.log('✅ [STATE RESYNC COMPLETE]: Synchronized with authoritative battlefield state.', syncData);

        // Notify registered resync listeners
        this.dispatch('system.resync', syncData);

        if (window.Toast) {
          window.Toast.show('Telemetry Grid Resynchronized', 'info');
        }
      }
    } catch (err) {
      console.warn('[STATE RESYNC ERROR]: Failed to fetch snapshot:', err);
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  dispatch(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Listener error for [${eventType}]:`, e); }
      });
    }

    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => {
        try { cb(eventType, data); } catch (e) { console.error('Wildcard listener error:', e); }
      });
    }
  }

  handleEvent(envelope) {
    // Normalization for Section 31 format ({ event, payload }) and legacy ({ type, data })
    const eventType = envelope.event || envelope.type;
    const eventData = envelope.payload !== undefined ? envelope.payload : (envelope.data || envelope);

    // 1. Tactical Alerts (First Blood, Announcements)
    if (eventType === 'challenge.first_blood' || eventType === 'FIRST_BLOOD') {
      if (window.Toast) {
        window.Toast.firstBlood(eventData.teamName || 'An operative squad', eventData.challengeTitle || 'Mission');
      }
    } else if (eventType === 'announcement.created' || eventType === 'ANNOUNCEMENT') {
      if (window.Toast) {
        window.Toast.show(`📢 INTEL DISPATCH: ${eventData.title}`, eventData.urgent ? 'urgent' : 'info');
      }
      if (window.NotificationBanner) {
        window.NotificationBanner.show(eventData.title, eventData.content, eventData.urgent);
      }
    }

    // 2. Dispatch to registered listeners
    this.dispatch(eventType, eventData);

    // Also dispatch legacy type if different
    if (envelope.type && envelope.type !== eventType) {
      this.dispatch(envelope.type, eventData);
    }
  }

  updateStatusDot(online) {
    const dots = document.querySelectorAll('.telemetry-status-dot');
    dots.forEach(dot => {
      dot.style.background = online ? 'var(--accent)' : 'var(--danger)';
      dot.style.boxShadow = online ? '0 0 10px var(--accent-glow)' : '0 0 10px var(--danger-glow)';
    });
  }
}

window.tacticalSocket = new TacticalSocket();

// Initialize socket connection automatically on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.tacticalSocket.connect();
});
