/**
 * XPLOITX // CYBER BATTLEFIELD
 * Automatic Instance Expiration & Cleanup Worker (backend/instances/cleanupWorker.js)
 * Implements Section 21 of Architectural Specification:
 * - Periodically finds expired instances (expiresAt < now) with status === RUNNING.
 * - Stops & removes real Docker containers.
 * - Releases host ports back to pool.
 * - Marks database records as DESTROYED.
 * - Emits real-time WebSocket events.
 * - Runs reconciliation periodically.
 */

const db = require('../config/database');
const portAllocator = require('./portAllocator');
const dockerManager = require('./dockerManager');
const reconciliation = require('./reconciliation');
const realtimeService = require('../services/realtimeService');
const Events = require('../realtime/events');

class CleanupWorker {
  constructor() {
    this.intervalId = null;
    this.checkIntervalMs = parseInt(process.env.INSTANCE_CLEANUP_INTERVAL_MS || '15000', 10);
    this.isRunning = false;
    this._sweepCount = 0;
  }

  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.sweep(), this.checkIntervalMs);
    if (this.intervalId.unref) this.intervalId.unref();
    console.log(`⚡ [INSTANCE CLEANUP WORKER ONLINE]: Sweeper active every ${this.checkIntervalMs / 1000}s.`);
    
    // Run initial sweep + reconciliation
    setTimeout(() => this.sweep(), 2000);
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
    this._sweepCount++;

    try {
      const now = new Date();
      const allInstances = db.getInstances ? db.getInstances() : [];
      
      // 1. Process expired RUNNING instances
      const runningInstances = allInstances.filter(i => i.status === 'RUNNING');
      for (const inst of runningInstances) {
        const expDate = new Date(inst.expiresAt || inst.expires_at);
        if (expDate <= now) {
          console.log(`[CLEANUP WORKER]: Expiring instance ${inst.instanceId || inst.id} (Port ${inst.port}).`);
          await this.expireInstance(inst);
        }
      }

      // 2. Process stale stuck instances in ALLOCATING/STARTING for > 5 minutes
      const stuckInstances = allInstances.filter(i => 
        ['ALLOCATING', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING'].includes(i.status) &&
        (now - new Date(i.createdAt || i.created_at)) > 5 * 60 * 1000
      );

      for (const inst of stuckInstances) {
        console.warn(`[CLEANUP WORKER]: Aborting stuck initialization for ${inst.instanceId || inst.id}...`);
        await this.abortStuckInstance(inst);
      }

      // 3. Periodic full reconciliation every 4 sweeps (~60 seconds)
      if (this._sweepCount % 4 === 0) {
        await reconciliation.reconcile().catch(() => {});
      }
    } catch (err) {
      console.error('[CLEANUP WORKER ERROR]:', err);
    } finally {
      this.isRunning = false;
    }
  }

  async expireInstance(inst) {
    const instId = inst.instanceId || inst.id;
    const challengeId = inst.challengeId || inst.challenge_id;
    const teamId = inst.teamId || inst.team_id;

    inst.status = 'EXPIRED';
    await db.persistDoc('instances', inst).catch(() => {});

    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_EXPIRED || 'INSTANCE_EXPIRED', {
      instanceId: instId,
      challengeId,
      teamId,
      status: 'EXPIRED'
    });

    // Destroy container
    const cId = inst.containerId || inst.container_id;
    if (cId) {
      await dockerManager.destroyContainer(cId);
    }

    // Release port
    if (inst.port) {
      await portAllocator.release(inst.port);
    }

    // Mark DESTROYED
    inst.status = 'DESTROYED';
    inst.destroyedAt = new Date().toISOString();
    await db.persistDoc('instances', inst).catch(() => {});

    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_DESTROYED || 'INSTANCE_DESTROYED', {
      instanceId: instId,
      challengeId,
      teamId,
      status: 'DESTROYED'
    });
  }

  async abortStuckInstance(inst) {
    const instId = inst.instanceId || inst.id;
    inst.status = 'FAILED';
    inst.failureReason = 'PROVISIONING_TIMEOUT';
    await db.persistDoc('instances', inst).catch(() => {});

    const cId = inst.containerId || inst.container_id;
    if (cId) {
      await dockerManager.destroyContainer(cId);
    }
    if (inst.port) {
      await portAllocator.release(inst.port);
    }
  }
}

const cleanupWorker = new CleanupWorker();
module.exports = cleanupWorker;
