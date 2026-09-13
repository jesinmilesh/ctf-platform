/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real-Time Event Bus (backend/realtime/eventBus.js)
 * Distributes event notifications via Redis Pub/Sub to all API nodes and WebSocket workers.
 */

const redisAdapter = require('../config/redis');
const Events = require('./events');

class EventBus {
  constructor() {
    this.channel = 'xploitx:events';
    this.handlers = new Map();
  }

  async init() {
    await redisAdapter.init();

    // Subscribe to the Redis distribution channel
    redisAdapter.subscribe(this.channel, (rawMessage) => {
      try {
        const envelope = JSON.parse(rawMessage);
        const { event } = envelope;

        if (this.handlers.has(event)) {
          this.handlers.get(event).forEach(handler => {
            try { handler(envelope); } catch (e) { console.error('Event handler error:', e); }
          });
        }

        // Global wildcard listeners
        if (this.handlers.has('*')) {
          this.handlers.get('*').forEach(handler => {
            try { handler(envelope); } catch (e) { console.error('Wildcard handler error:', e); }
          });
        }
      } catch (err) {
        console.error('Failed to parse event message:', err);
      }
    });
  }

  /**
   * Publish an event to Redis (Section 5 & 31)
   */
  async publish(eventType, payload = {}, competitionId = 1) {
    const envelope = {
      event: eventType,
      timestamp: new Date().toISOString(),
      competitionId,
      payload
    };

    await redisAdapter.publish(this.channel, envelope);
    return envelope;
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
  }
}

const eventBus = new EventBus();
module.exports = eventBus;
