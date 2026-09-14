/**
 * XPLOITX // Dedicated Instance Worker - Reconciliation Engine (instance-worker/reconciliation/index.js)
 */

const containers = require('../docker/containers');
const cleanup = require('../cleanup');

class ReconciliationEngine {
  async reconcile(activeInstances = []) {
    const validIds = activeInstances.map(i => i.containerId).filter(Boolean);
    const result = await cleanup.sweepOrphans(validIds);
    return {
      status: 'reconciled',
      ...result
    };
  }
}

module.exports = new ReconciliationEngine();
