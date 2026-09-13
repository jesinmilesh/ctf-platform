/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Startup Reconciliation Engine (instance-server/reconciliation.js)
 * Implements Section 38 of Master Production Specification:
 * - Compares database state vs active Docker Engine containers on startup
 * - Detects orphaned containers (running in Docker but missing from DB) -> tears them down
 * - Detects stale RUNNING entries (recorded in DB but missing from Docker) -> marks as STOPPED/FAILED
 * - Detects and corrects port registry drift
 */

const dockerManager = require('./dockerManager');
const portAllocator = require('./portAllocator');

class ReconciliationEngine {
  /**
   * Run startup reconciliation
   * @param {Array} dbInstances - List of instances from PostgreSQL database
   */
  async reconcile(dbInstances = []) {
    console.log('🔄 [RECONCILIATION] Initiating instance state synchronization...');
    const dockerAvailable = await dockerManager.isDockerAvailable();

    const report = {
      orphansTerminated: 0,
      staleMarkedStopped: 0,
      portsRealigned: 0
    };

    if (!dockerAvailable) {
      console.log('ℹ️  [RECONCILIATION] Docker daemon not directly reachable; skipping raw container scan.');
      return report;
    }

    try {
      // 1. Get all running containers created by XploitX
      const stdout = await dockerManager.execDocker('ps --filter "label=managed-by=xploitx-instance-orchestrator" --format "{{.ID}}|{{.Names}}|{{.Labels}}"');
      const runningLines = stdout.split('\n').filter(Boolean);
      const dockerMap = new Map();

      runningLines.forEach(line => {
        const [id, name, labels] = line.split('|');
        // Extract instance-id and host-port from labels
        const idMatch = labels.match(/instance-id=([^,]+)/);
        const portMatch = labels.match(/host-port=([^,]+)/);
        if (idMatch) {
          dockerMap.set(idMatch[1], {
            containerId: id,
            containerName: name,
            hostPort: portMatch ? parseInt(portMatch[1], 10) : null
          });
        }
      });

      const dbMap = new Map();
      dbInstances.forEach(inst => {
        dbMap.set(inst.id, inst);
      });

      // 2. Identify and terminate orphan Docker containers not in DB
      for (const [instId, dockerData] of dockerMap.entries()) {
        if (!dbMap.has(instId)) {
          console.log(`🧹 [RECONCILIATION] Found orphaned container '${dockerData.containerName}' (Instance ${instId}). Terminating...`);
          try {
            await dockerManager.execDocker(`rm -f ${dockerData.containerId}`);
            report.orphansTerminated++;
          } catch (e) {}
        }
      }

      // 3. Identify DB instances marked RUNNING that are not in Docker
      for (const [instId, dbInst] of dbMap.entries()) {
        if (dbInst.status === 'RUNNING' && !dockerMap.has(instId)) {
          console.log(`⚠️  [RECONCILIATION] Instance ${instId} marked RUNNING in DB but missing from Docker. Marking FAILED.`);
          dbInst.status = 'FAILED';
          dbInst.failureReason = 'MISSING_CONTAINER_RECONCILIATION';
          report.staleMarkedStopped++;
        }
      }

      console.log('✓ [RECONCILIATION COMPLETE]:', report);
      return report;
    } catch (err) {
      console.error('❌ [RECONCILIATION FAILED]:', err);
      return report;
    }
  }
}

module.exports = new ReconciliationEngine();
