/**
 * XPLOITX // CYBER BATTLEFIELD
 * Docker & MongoDB State Reconciliation (backend/instances/reconciliation.js)
 * Implements Section 22 of Architectural Specification:
 * - Compares live Docker containers against authoritative MongoDB records.
 * - Detects and neutralizes orphaned containers (Docker container with no active DB record).
 * - Detects database instances whose container died/vanished, marking them FAILED/DESTROYED.
 * - Cleans up stale port allocations.
 * - Never touches containers that lack the xploitx.managed=true label.
 */

const dockerClient = require('./dockerClient');
const db = require('../config/database');
const portAllocator = require('./portAllocator');

class StateReconciliation {
  async reconcile() {
    console.log('⚡ [STATE RECONCILIATION]: Synchronizing Docker Engine and Database states...');
    try {
      const isDockerLive = await dockerClient.isAvailable();
      if (!isDockerLive) {
        console.warn('[STATE RECONCILIATION] Docker daemon unavailable; skipping container reconciliation.');
        return { success: false, reason: 'DOCKER_UNAVAILABLE' };
      }

      // 1. Fetch all Docker containers managed by XploitX
      const managedContainers = await dockerClient.listManagedContainers();
      const containerByInstanceId = new Map();

      for (const c of managedContainers) {
        const labels = c.Labels || {};
        const instanceId = labels['xploitx.instanceId'];
        const cId = c.Id || c.ID;
        if (instanceId) {
          containerByInstanceId.set(instanceId, { containerId: cId, labels, container: c });
        }
      }

      // 2. Fetch all active DB instances
      const allInstances = db.getInstances ? db.getInstances() : [];
      const activeStatuses = ['REQUESTED', 'ALLOCATING', 'PORT_RESERVED', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING'];
      const activeDbInstances = allInstances.filter(i => activeStatuses.includes(i.status));

      const activeInstanceIds = new Set(activeDbInstances.map(i => i.instanceId || i.id));

      let orphanedCount = 0;
      let missingContainerCount = 0;

      // 3. Detect and remove orphaned Docker containers
      for (const [instanceId, item] of containerByInstanceId.entries()) {
        if (!activeInstanceIds.has(instanceId)) {
          console.warn(`[RECONCILIATION] Orphan container detected: ${item.containerId} (Instance: ${instanceId}). Removing...`);
          try {
            await dockerClient.stopContainer(item.containerId, 1);
            await dockerClient.removeContainer(item.containerId, true);
            orphanedCount++;
          } catch (err) {
            console.error(`[RECONCILIATION] Failed to remove orphan ${item.containerId}:`, err.message);
          }
        }
      }

      // 4. Detect DB instances whose containers vanished
      for (const inst of activeDbInstances) {
        const instId = inst.instanceId || inst.id;
        // Only inspect RUNNING or STARTING instances
        if (inst.status === 'RUNNING') {
          const matched = containerByInstanceId.get(instId);
          let containerMissing = false;

          if (!matched) {
            containerMissing = true;
          } else {
            // Verify container is actively running
            const inspect = await dockerClient.inspectContainer(matched.containerId).catch(() => null);
            if (!inspect || !inspect.State || !inspect.State.Running) {
              containerMissing = true;
            }
          }

          if (containerMissing) {
            console.warn(`[RECONCILIATION] Active DB instance ${instId} has missing/stopped container. Reconciling to DESTROYED...`);
            inst.status = 'DESTROYED';
            inst.destroyedAt = new Date().toISOString();
            inst.failureReason = 'CONTAINER_TERMINATED_EXTERNALLY';

            if (inst.port) {
              await portAllocator.release(inst.port);
            }
            await db.persistDoc('instances', inst).catch(() => {});
            missingContainerCount++;
          }
        }
      }

      console.log(`[STATE RECONCILIATION COMPLETED]: Cleaned ${orphanedCount} orphan containers, reconciled ${missingContainerCount} dead instances.`);
      return {
        success: true,
        orphanedContainersRemoved: orphanedCount,
        missingContainersReconciled: missingContainerCount,
        activeContainers: containerByInstanceId.size - orphanedCount
      };
    } catch (err) {
      console.error('[STATE RECONCILIATION ERROR]:', err);
      return { success: false, error: err.message };
    }
  }
}

const reconciliation = new StateReconciliation();
module.exports = reconciliation;
