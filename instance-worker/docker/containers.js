/**
 * XPLOITX // Dedicated Instance Worker - Container Lifecycle (instance-worker/docker/containers.js)
 */

const runtime = require('./runtime');
const images = require('./images');
const networks = require('./networks');
const security = require('../security');
const health = require('../health');
const config = require('../config');

class ContainerManager {
  /**
   * Spawn and verify a real challenge container
   */
  async spawn({
    name,
    image,
    hostPort,
    containerPort = 80,
    protocol = 'http',
    healthCheckPath = '/health',
    network = config.docker.network,
    labels = {},
    env = {},
    cpus = config.limits.defaultCpus,
    memory = config.limits.defaultMemory,
    pidsLimit = config.limits.defaultPids
  }) {
    // 1. Validate image & security
    const validatedImage = security.validateImage(image);
    await networks.ensureNetwork(network);
    await images.ensureImage(validatedImage);

    // 2. Remove any pre-existing container with same name
    try {
      await this.remove(name, true);
    } catch (e) {}

    // 3. Build payload
    const hostConfig = security.buildHostConfig({
      hostPort,
      containerPort,
      network,
      cpus,
      memory,
      pidsLimit
    });

    const portKey = `${containerPort}/tcp`;
    const body = {
      Image: validatedImage,
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      Labels: {
        'xploitx.managed': 'true',
        'managed-by': 'xploitx-instance-worker',
        ...labels
      },
      ExposedPorts: {
        [portKey]: {}
      },
      HostConfig: hostConfig
    };

    // 4. Create container
    console.log(`[WORKER] Creating container '${name}' on port ${hostPort}...`);
    const created = await runtime.request('POST', `/containers/create?name=${encodeURIComponent(name)}`, body);
    const containerId = created.Id;

    try {
      // 5. Start container
      console.log(`[WORKER] Starting container ${containerId.substring(0, 12)}...`);
      await runtime.request('POST', `/containers/${containerId}/start`);

      // 6. Real health check
      console.log(`[WORKER] Probing container health on port ${hostPort} (${healthCheckPath})...`);
      const probeResult = await health.probe({
        port: hostPort,
        path: healthCheckPath,
        maxRetries: 15,
        intervalMs: 1000,
        timeoutMs: 3000
      });

      console.log(`[WORKER] Container ${containerId.substring(0, 12)} healthy in ${probeResult.durationMs}ms`);

      return {
        containerId,
        containerName: name,
        hostPort,
        containerPort,
        protocol,
        status: 'RUNNING',
        healthStatus: 'HEALTHY'
      };
    } catch (err) {
      // Rollback on failure
      console.error(`[WORKER ROLLBACK] Container ${containerId.substring(0, 12)} failed:`, err.message);
      try {
        await this.remove(containerId, true);
      } catch (cleanupErr) {}
      throw err;
    }
  }

  /**
   * Start existing container
   */
  async start(containerId) {
    await runtime.request('POST', `/containers/${containerId}/start`);
    return true;
  }

  /**
   * Stop container
   */
  async stop(containerId, timeoutSec = 2) {
    try {
      await runtime.request('POST', `/containers/${containerId}/stop?t=${timeoutSec}`);
      return true;
    } catch (e) {
      if (e.statusCode === 304 || (e.message && e.message.includes('not running'))) {
        return true;
      }
      return true;
    }
  }

  /**
   * Restart container and re-probe health
   */
  async restart(containerId, hostPort, healthPath = '/health', timeoutSec = 2) {
    console.log(`[WORKER] Restarting container ${containerId}...`);
    await runtime.request('POST', `/containers/${containerId}/restart?t=${timeoutSec}`);
    if (hostPort) {
      await health.probe({
        port: hostPort,
        path: healthPath,
        maxRetries: 15,
        intervalMs: 1000,
        timeoutMs: 3000
      });
    }
    return true;
  }

  /**
   * Remove container
   */
  async remove(containerId, force = true) {
    try {
      await runtime.request('DELETE', `/containers/${containerId}?force=${force ? 1 : 0}&v=1`);
      return true;
    } catch (e) {
      if (e.statusCode === 404 || (e.message && e.message.includes('No such container'))) {
        return true;
      }
      throw e;
    }
  }

  /**
   * Inspect container
   */
  async inspect(containerId) {
    return runtime.request('GET', `/containers/${containerId}/json`);
  }

  /**
   * List all managed containers
   */
  async listManaged() {
    const filter = JSON.stringify({ label: ['xploitx.managed=true'] });
    const containers = await runtime.request('GET', `/containers/json?all=1&filters=${encodeURIComponent(filter)}`);
    return Array.isArray(containers) ? containers : [];
  }
}

module.exports = new ContainerManager();
