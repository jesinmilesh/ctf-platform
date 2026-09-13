/**
 * XPLOITX // CYBER BATTLEFIELD
 * Redis Pub/Sub Adapter (backend/config/redis.js)
 * Implements Section 4 & 5 of Architectural Blueprint:
 * Authoritative PostgreSQL data writes emit real-time event notifications via Redis Pub/Sub.
 */

const EventEmitter = require('events');
const env = require('./environment');

class RedisAdapter {
  constructor() {
    this.inMemoryBus = new EventEmitter();
    this.inMemoryBus.setMaxListeners(200);
    this.isRedisConnected = false;
    this.client = null;
  }

  async init() {
    // Check if redis package or server is reachable
    try {
      const Redis = require('ioredis');
      this.client = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
      });

      await this.client.connect();
      this.subscriber = this.client.duplicate();
      await this.subscriber.connect();
      this.isRedisConnected = true;
      console.log('⚡ [REDIS PUB/SUB CONNECTED]: Real-time event propagation active on', env.REDIS_URL);
    } catch (e) {
      // Graceful in-process Pub/Sub fallback for dev/standalone mode
      this.isRedisConnected = false;
      console.log('ℹ️  [REDIS NOTICE]: Running standalone in-memory Pub/Sub engine.');
    }
  }

  async publish(channel, message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.isRedisConnected && this.client) {
      try {
        await this.client.publish(channel, payload);
        return;
      } catch (err) {
        console.warn('Redis publish failed, falling back to in-memory bus:', err.message);
      }
    }

    // In-memory dispatch
    this.inMemoryBus.emit(channel, payload);
  }

  subscribe(channel, callback) {
    if (this.isRedisConnected && this.subscriber) {
      this.subscriber.subscribe(channel, (err) => {
        if (err) console.error('Redis subscribe error:', err);
      });
      this.subscriber.on('message', (ch, msg) => {
        if (ch === channel) {
          callback(msg);
        }
      });
      return;
    }

    // In-memory subscription
    this.inMemoryBus.on(channel, callback);
  }
}

const redisAdapter = new RedisAdapter();
module.exports = redisAdapter;
