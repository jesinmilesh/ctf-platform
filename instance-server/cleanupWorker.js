/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Cleanup Background Worker (instance-server/cleanupWorker.js)
 * Implements Section 37 of Master Production Specification:
 * - Scans active containers every 15 seconds
 * - Identifies expired instances (Date.now() >= expiresAt)
 * - Gracefully stops & removes containers
 * - Atomically releases host port reservation
 * - Emits instance.expired event
 */

const dockerManager = require('./dockerManager');
const portAllocator = require('./portAllocator');

class CleanupWorker {
  constructor() {
    this.intervalHandle = null;
    this.checkIntervalMs = 15000; // 15 seconds
    this.onExpireCallback = null;
    this.isRunning = false;
  }

  /**
   * Set callback when an instance expires
   */
  setOnExpire(callback) {
    this.onExpireCallback = callback;
  }

  /**
   * Start periodic scanner
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalHandle = setInterval(() => this.runCleanupCycle(), this.checkIntervalMs);
    console.log('⚡ [INSTANCE CLEANUP WORKER] Active. Polling interval: 15s');
  }

  /**
   * Stop worker
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }

  /**
   * Run a single sweep over all active instances
   */
  async runCleanupCycle() {
    const active = dockerManager.getAllActive();
    const now = Date.now();

    for (const inst of active) {
      const expiresAt = new Date(inst.expiresAt).getTime();
      if (now >= expiresAt) {
        console.log(`🧹 [CLEANUP] Instance ${inst.instanceId} expired. Initiating automatic teardown...`);
        try {
          await dockerManager.destroyContainer(inst.instanceId);
          await portAllocator.release(inst.hostPort);

          if (typeof this.onExpireCallback === 'function') {
            this.onExpireCallback(inst);
          }
        } catch (err) {
          console.error(`[CLEANUP ERROR] Failed to cleanly teardown instance ${inst.instanceId}:`, err);
        }
      }
    }
  }

  /**
   * Force immediate cleanup of a single specific instance
   */
  async terminateInstance(instanceId) {
    const status = await dockerManager.getStatus(instanceId);
    if (!status) return false;

    await dockerManager.destroyContainer(instanceId);
    if (status.hostPort) {
      await portAllocator.release(status.hostPort);
    }
    return true;
  }
}

module.exports = new CleanupWorker();
