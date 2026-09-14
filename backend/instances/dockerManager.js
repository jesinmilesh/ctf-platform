/**
 * XPLOITX // CYBER BATTLEFIELD
 * Provider-Independent Docker Container Manager (backend/instances/dockerManager.js)
 * Implements Phases 3, 4, 5, 17, 18 of Master Specification:
 * - Operates across local and remote runtimes via DockerRuntimeFactory
 * - Resource isolation (CPU, memory, PIDs) and security boundaries
 * - Real HTTP health checks before transitioning to RUNNING
 * - Automatic rollback on startup or health check failure
 */

const runtimeFactory = require('./runtime/dockerRuntimeFactory');
const dockerSecurity = require('./dockerSecurity');
const healthChecker = require('./healthChecker');

class DockerManager {
  constructor() {
    this.networkName = process.env.DOCKER_NETWORK || 'xploitx-instances';
  }

  get runtime() {
    return runtimeFactory.getRuntime();
  }

  /**
   * Check if Docker daemon / Instance Worker is operational
   */
  async isAvailable() {
    return this.runtime.isAvailable();
  }

  /**
   * Spawn a real challenge container
   */
  async spawnContainer({ instanceId, challenge, hostPort, teamId = null, userId = null }) {
    // 1. Verify Docker availability
    const available = await this.runtime.isAvailable();
    if (!available) {
      throw new Error('DOCKER_UNAVAILABLE: Docker runtime is not reachable. In development, ensure Docker Desktop is running; in production, verify the Instance Worker service.');
    }

    // 2. Ensure isolated Docker network exists
    await this.runtime.ensureNetwork(this.networkName);

    // 3. Sanitize and validate challenge configuration
    const config = dockerSecurity.sanitizeRuntimeConfig(challenge.runtime, challenge);
    const containerName = `xploitx-instance-${instanceId}`;

    // Clean up any stale container with the exact same name
    try {
      await this.runtime.removeContainer(containerName, true);
    } catch (e) {}

    console.log(`[DOCKER MANAGER] Spawning challenge container '${containerName}' [${this.runtime.name}] using image '${config.image}' on host port ${hostPort}...`);

    let containerInfo = null;

    try {
      // 4. Create container through runtime abstraction
      containerInfo = await this.runtime.createContainer({
        name: containerName,
        image: config.image,
        hostPort,
        containerPort: config.containerPort,
        protocol: config.protocol,
        healthCheckPath: config.healthPath,
        network: this.networkName,
        cpus: config.cpus,
        memory: config.memory,
        pidsLimit: config.pidsLimit,
        labels: {
          'xploitx.instanceId': instanceId,
          'xploitx.challengeId': challenge.id || challenge.slug || 'unknown',
          'xploitx.teamId': teamId || '',
          'xploitx.userId': userId || '',
          'xploitx.hostPort': String(hostPort)
        },
        env: {
          CHALLENGE_ID: challenge.id || '',
          TEAM_ID: teamId || '',
          PORT: String(config.containerPort)
        }
      });

      // 5. If local runtime, explicitly start container and execute local health check
      if (this.runtime.name === 'local') {
        console.log(`[DOCKER MANAGER] Starting container ${containerInfo.containerId}...`);
        await this.runtime.startContainer(containerInfo.containerId);

        console.log(`[DOCKER MANAGER] Probing container health on port ${hostPort} (path: ${config.healthPath})...`);
        const probeResult = await healthChecker.check({
          port: hostPort,
          path: config.healthPath,
          maxRetries: 15,
          intervalMs: 1000,
          timeoutMs: 3000
        });

        console.log(`[DOCKER MANAGER] Container passed health probe in ${probeResult.latencyMs}ms (HTTP ${probeResult.statusCode})`);
      }

      return {
        containerId: containerInfo.containerId,
        containerName,
        image: config.image,
        hostPort,
        containerPort: config.containerPort,
        protocol: config.protocol,
        status: 'RUNNING',
        healthCheckStatus: 'HEALTHY',
        startedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error(`[DOCKER_SPAWN_ERROR] Failed to launch ${containerName}:`, err.message);

      // Rollback: neutralize failed container
      if (containerInfo && containerInfo.containerId) {
        try {
          await this.runtime.stopContainer(containerInfo.containerId, 1);
          await this.runtime.removeContainer(containerInfo.containerId, true);
        } catch (cleanupErr) {}
      } else {
        try {
          await this.runtime.removeContainer(containerName, true);
        } catch (cleanupErr) {}
      }

      throw err;
    }
  }

  /**
   * Stop and remove a challenge container
   */
  async destroyContainer(containerId) {
    if (!containerId) return true;
    try {
      console.log(`[DOCKER MANAGER] Stopping and removing container ${containerId}...`);
      await this.runtime.stopContainer(containerId, 2);
      await this.runtime.removeContainer(containerId, true);
      return true;
    } catch (err) {
      console.warn(`[DOCKER MANAGER] Container removal notice for ${containerId}:`, err.message);
      return true;
    }
  }

  /**
   * Restart an existing challenge container and re-probe health
   */
  async restartContainer(containerId, hostPort, healthPath = '/health') {
    if (!containerId) throw new Error('CONTAINER_ID_REQUIRED');
    console.log(`[DOCKER MANAGER] Restarting container ${containerId}...`);
    await this.runtime.restartContainer(containerId, 2);

    if (this.runtime.name === 'local') {
      const probeResult = await healthChecker.check({
        port: hostPort,
        path: healthPath,
        maxRetries: 15,
        intervalMs: 1000,
        timeoutMs: 3000
      });
      return probeResult;
    }
    return { healthy: true };
  }

  /**
   * Inspect container status from Docker Engine / Worker
   */
  async inspectContainer(containerId) {
    if (!containerId) return null;
    return this.runtime.inspectContainer(containerId);
  }

  /**
   * List all XploitX-managed containers
   */
  async listManagedContainers() {
    return this.runtime.listManagedContainers();
  }
}

const dockerManager = new DockerManager();
module.exports = dockerManager;
