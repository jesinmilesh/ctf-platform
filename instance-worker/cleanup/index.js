/**
 * XPLOITX // Dedicated Instance Worker - Cleanup Engine (instance-worker/cleanup/index.js)
 */

const containers = require('../docker/containers');

class CleanupEngine {
  async sweepOrphans(validContainerIds = []) {
    const validSet = new Set(validContainerIds);
    const managed = await containers.listManaged();
    let cleanedCount = 0;

    for (const c of managed) {
      const cId = c.Id || c.ID;
      if (!validSet.has(cId)) {
        console.log(`[WORKER CLEANUP] Removing orphan managed container ${cId.substring(0, 12)}...`);
        try {
          await containers.stop(cId, 1);
          await containers.remove(cId, true);
          cleanedCount++;
        } catch (e) {
          console.warn(`[WORKER CLEANUP NOTICE] Failed to remove ${cId}:`, e.message);
        }
      }
    }

    return { cleanedCount, totalManaged: managed.length };
  }
}

module.exports = new CleanupEngine();
