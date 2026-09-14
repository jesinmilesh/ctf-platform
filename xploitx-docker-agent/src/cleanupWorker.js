/**
 * XPLOITX // CYBER BATTLEFIELD
 * Automatic TTL Expiration & Container Cleanup Worker (src/cleanupWorker.js)
 */

class CleanupWorker {
  constructor({ instanceManager, intervalSeconds = 15 }) {
    this.instanceManager = instanceManager;
    this.intervalMs = intervalSeconds * 1000;
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.running = true;
    this.timer = setInterval(() => this.sweep(), this.intervalMs);
    console.log(`⚡ [AGENT CLEANUP WORKER ONLINE]: Sweeping expired containers every ${this.intervalMs / 1000}s.`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  async sweep() {
    try {
      const expired = this.instanceManager.getExpiredInstances();
      for (const inst of expired) {
        console.log(`[CLEANUP] Neutralizing expired instance ${inst.instanceId} (container: ${inst.containerId})...`);
        try {
          await this.instanceManager.terminateInstance(inst.instanceId, 'EXPIRED');
        } catch (e) {
          console.error(`[CLEANUP ERROR] Failed to terminate expired instance ${inst.instanceId}:`, e.message);
        }
      }
    } catch (err) {
      console.error('[CLEANUP SWEEPER ERROR]:', err);
    }
  }
}

module.exports = CleanupWorker;
