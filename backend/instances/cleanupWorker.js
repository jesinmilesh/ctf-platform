/**
 * XPLOITX // CYBER BATTLEFIELD
 * Automatic Instance Expiration & Cleanup Worker (backend/instances/cleanupWorker.js)
 * Implements Section 19 of Architectural Blueprint:
 * Periodically detects expired containers, destroys them, frees allocated ports, and emits events.
 */

const db = require('../config/database');
const portAllocator = require('./portAllocator');
const dockerManager = require('./dockerManager');
const realtimeService = require('../services/realtimeService');
const Events = require('../realtime/events');

class CleanupWorker {
  constructor() {
    this.intervalId = null;
    this.checkIntervalMs = 20000; // run every 20 seconds
    this.isRunning = false;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.sweep(), this.checkIntervalMs);
    console.log('⚡ [INSTANCE CLEANUP WORKER ONLINE]: Sweeper active every 20s.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async sweep() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const instances = db.getInstances().filter(i => i.status === 'RUNNING');

      for (const inst of instances) {
        if (new Date(inst.expires_at) <= now) {
          console.log(`[CLEANUP WORKER]: Expiring instance ${inst.id} (Port ${inst.port}).`);
          await this.expireInstance(inst);
        }
      }
    } catch (err) {
      console.error('[CLEANUP WORKER ERROR]:', err);
    } finally {
      this.isRunning = false;
    }
  }

  async expireInstance(inst) {
    inst.status = 'EXPIRED';

    // 1. Destroy container
    if (inst.container_id) {
      await dockerManager.destroyContainer(inst.container_id);
    }

    // 2. Free allocated port
    if (inst.port) {
      await portAllocator.release(inst.port);
    }

    // 3. Emit real-time event
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_EXPIRED, {
      instanceId: inst.id,
      challengeId: inst.challenge_id,
      teamId: inst.team_id,
      status: 'EXPIRED'
    });
  }
}

const cleanupWorker = new CleanupWorker();
module.exports = cleanupWorker;
