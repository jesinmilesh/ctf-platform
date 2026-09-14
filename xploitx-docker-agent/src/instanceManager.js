/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Instance Lifecycle Coordinator (src/instanceManager.js)
 * Manages local challenge containers, ports, health states, and lifecycle transitions.
 */

const EventEmitter = require('events');
const AgentSecurity = require('./security');
const HealthChecker = require('./healthChecker');

class AgentInstanceManager extends EventEmitter {
  constructor({ dockerManager, portAllocator, config = {} }) {
    super();
    this.docker = dockerManager;
    this.ports = portAllocator;
    this.config = config;
    this.instances = new Map(); // instanceId -> instanceRecord
  }

  /**
   * Reconcile on startup: check existing Docker containers
   */
  async reconcile() {
    try {
      await this.docker.ensureNetwork();
      const managed = await this.docker.listManagedContainers();
      console.log(`[AGENT RECONCILIATION] Found ${managed.length} existing managed challenge containers.`);

      for (const container of managed) {
        const labels = container.Labels || {};
        const instId = labels['xploitx.instanceId'] || container.Id.substring(0, 12);
        const hostPort = labels['xploitx.hostPort'] ? parseInt(labels['xploitx.hostPort'], 10) : null;

        if (container.State === 'running' && hostPort) {
          // Track existing running container
          this.instances.set(instId, {
            instanceId: instId,
            challengeId: labels['xploitx.challengeId'] || 'unknown',
            containerId: container.Id,
            containerName: (container.Names && container.Names[0]) || instId,
            port: hostPort,
            status: 'RUNNING',
            healthStatus: 'HEALTHY',
            protocol: labels['xploitx.protocol'] || 'http',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          });
          this.ports.allocatedPorts.set(hostPort, { instanceId: instId, allocatedAt: new Date().toISOString() });
        } else {
          // Remove dead orphan container
          try {
            await this.docker.removeContainer(container.Id, true);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[AGENT RECONCILIATION WARNING]:', e.message);
    }
  }

  /**
   * Spawn a real Challenge Container
   */
  async spawnInstance({
    instanceId,
    challengeId,
    image,
    containerPort = 80,
    protocol = 'http',
    durationMinutes = 30,
    memoryMB = 256,
    cpuQuota = 0.5,
    pidsLimit = 64,
    healthCheck = { path: '/' },
    networkMode = 'LOCAL'
  }) {
    if (!instanceId) throw new Error('VALIDATION_ERROR: instanceId is required.');
    if (!image) throw new Error('VALIDATION_ERROR: Challenge container image is required.');

    // 1. Check if already active
    const existing = this.instances.get(instanceId);
    if (existing && existing.status === 'RUNNING') {
      return existing;
    }

    // 2. Allocate host port (41000-41999)
    this.emit('status', { instanceId, status: 'ALLOCATING' });
    const allocatedPort = await this.ports.allocate(instanceId);

    const containerName = `xploitx-inst-${instanceId.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
    const labels = {
      'xploitx.instanceId': instanceId,
      'xploitx.challengeId': challengeId,
      'xploitx.protocol': protocol,
      'xploitx.containerPort': String(containerPort),
      'xploitx.hostPort': String(allocatedPort)
    };

    let containerId = null;

    try {
      // 3. Create Container
      this.emit('status', { instanceId, status: 'CREATING', port: allocatedPort });
      const createRes = await this.docker.createContainer({
        image,
        name: containerName,
        hostPort: allocatedPort,
        containerPort,
        memoryMB,
        cpuQuota,
        pidsLimit,
        networkMode,
        labels
      });
      containerId = createRes.containerId;

      // 4. Start Container
      this.emit('status', { instanceId, status: 'STARTING', containerId, port: allocatedPort });
      await this.docker.startContainer(containerId);

      // 5. Health Check Verification
      this.emit('status', { instanceId, status: 'HEALTH_CHECKING', containerId, port: allocatedPort });
      const probePath = healthCheck?.path || '/';
      const healthRes = await HealthChecker.waitUntilReady({
        port: allocatedPort,
        protocol,
        path: probePath,
        host: '127.0.0.1',
        maxWaitMs: 15000,
        intervalMs: 500
      });

      if (!healthRes.healthy) {
        throw new Error(`HEALTH_CHECK_FAILED: Container failed readiness check on port ${allocatedPort}: ${healthRes.error}`);
      }

      // 6. Resolve Target Connection URL
      let targetHost = '127.0.0.1';
      if (networkMode === 'LAN') {
        targetHost = AgentSecurity.getLocalIpAddress();
      } else if (networkMode === 'TUNNEL' || networkMode === 'CUSTOM_DOMAIN') {
        targetHost = this.config.CUSTOM_DOMAIN_HOST || AgentSecurity.getLocalIpAddress();
      }

      const connectionUrl = protocol.toLowerCase() === 'tcp'
        ? `tcp://${targetHost}:${allocatedPort}`
        : `http://${targetHost}:${allocatedPort}`;

      const expiresAt = new Date(Date.now() + (durationMinutes * 60 * 1000)).toISOString();

      const record = {
        instanceId,
        challengeId,
        containerId,
        containerName,
        port: allocatedPort,
        host: targetHost,
        protocol,
        status: 'RUNNING',
        healthStatus: 'HEALTHY',
        url: connectionUrl,
        connectionCommand: protocol.toLowerCase() === 'tcp' ? `nc ${targetHost} ${allocatedPort}` : connectionUrl,
        createdAt: new Date().toISOString(),
        expiresAt,
        timeRemainingSeconds: durationMinutes * 60
      };

      this.instances.set(instanceId, record);
      this.emit('status', { ...record, status: 'RUNNING' });
      return record;

    } catch (err) {
      console.error(`[AGENT SPAWN ERROR] Failed to spawn instance ${instanceId}:`, err.message);

      // Cleanup on failure
      if (containerId) {
        await this.docker.removeContainer(containerId, true).catch(() => {});
      }
      await this.ports.release(allocatedPort);

      this.emit('status', { instanceId, status: 'FAILED', error: err.message });
      throw err;
    }
  }

  /**
   * Terminate Container and release port
   */
  async terminateInstance(instanceId, reason = 'STOPPED') {
    const record = this.instances.get(instanceId);
    if (!record) {
      // Check if port needs release
      for (const [p, meta] of this.ports.allocatedPorts.entries()) {
        if (meta.instanceId === instanceId) {
          await this.ports.release(p);
        }
      }
      return { success: true, message: 'Instance already terminated or not found' };
    }

    this.emit('status', { instanceId, status: 'STOPPING' });

    if (record.containerId) {
      try {
        await this.docker.stopContainer(record.containerId, 2);
      } catch (e) {}
      try {
        await this.docker.removeContainer(record.containerId, true);
      } catch (e) {}
    }

    if (record.port) {
      await this.ports.release(record.port);
    }

    record.status = reason === 'EXPIRED' ? 'EXPIRED' : 'STOPPED';
    record.destroyedAt = new Date().toISOString();
    this.instances.delete(instanceId);

    this.emit('status', { instanceId, status: record.status });
    return { success: true, message: 'Container destroyed and port released' };
  }

  /**
   * Restart an existing instance
   */
  async restartInstance(instanceId) {
    const record = this.instances.get(instanceId);
    if (!record || !record.containerId) {
      throw new Error(`NOT_FOUND: No running instance ${instanceId} found.`);
    }

    this.emit('status', { instanceId, status: 'STARTING' });
    await this.docker.restartContainer(record.containerId, 2);

    this.emit('status', { instanceId, status: 'HEALTH_CHECKING' });
    const health = await HealthChecker.waitUntilReady({
      port: record.port,
      protocol: record.protocol,
      maxWaitMs: 10000
    });

    if (!health.healthy) {
      throw new Error(`HEALTH_CHECK_FAILED: Container did not recover after restart.`);
    }

    record.status = 'RUNNING';
    record.healthStatus = 'HEALTHY';
    this.emit('status', { ...record, status: 'RUNNING' });
    return record;
  }

  getInstance(instanceId) {
    return this.instances.get(instanceId) || null;
  }

  getActiveInstances() {
    return Array.from(this.instances.values()).filter(i => i.status === 'RUNNING');
  }

  getExpiredInstances() {
    const now = Date.now();
    return Array.from(this.instances.values()).filter(i => {
      if (i.status !== 'RUNNING' || !i.expiresAt) return false;
      return new Date(i.expiresAt).getTime() <= now;
    });
  }
}

module.exports = AgentInstanceManager;
