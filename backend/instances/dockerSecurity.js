/**
 * XPLOITX // CYBER BATTLEFIELD
 * Docker Security Policy & Validation (backend/instances/dockerSecurity.js)
 * Implements Sections 14 & 15 of Architectural Specification:
 * - Sanitizes and validates challenge container runtime configurations.
 * - Blocks privileged containers, host mounts, socket mounts, and dangerous options.
 * - Enforces resource boundaries (CPU, memory, PIDs).
 */

class DockerSecurity {
  constructor() {
    this.defaultCpuLimit = parseFloat(process.env.CONTAINER_CPU_LIMIT || '0.5');
    this.defaultMemoryLimit = process.env.CONTAINER_MEM_LIMIT || '256m';
    this.defaultPidsLimit = parseInt(process.env.CONTAINER_PIDS_LIMIT || '128', 10);
  }

  /**
   * Validate container image string against path traversal and injection
   */
  validateImage(image) {
    if (!image || typeof image !== 'string') return false;
    const trimmed = image.trim();
    if (trimmed.length > 256) return false;
    // Allow standard repository/image:tag format
    const safeRegex = /^[a-zA-Z0-9_./:-]+$/;
    if (!safeRegex.test(trimmed)) return false;
    if (trimmed.includes('..') || trimmed.includes(';') || trimmed.includes('&&') || trimmed.includes('|')) {
      return false;
    }
    return true;
  }

  /**
   * Validate and sanitize runtime configuration
   */
  sanitizeRuntimeConfig(runtime = {}, challenge = {}) {
    const rawImage = runtime.image || challenge.docker_image || `xploitx/${challenge.slug || 'target'}:latest`;
    if (!this.validateImage(rawImage)) {
      throw new Error(`SECURITY_VIOLATION: Invalid or unauthorized container image format '${rawImage}'.`);
    }

    const containerPort = parseInt(runtime.containerPort || challenge.container_port || 80, 10);
    if (isNaN(containerPort) || containerPort < 1 || containerPort > 65535) {
      throw new Error('SECURITY_VIOLATION: Invalid container port. Must be between 1 and 65535.');
    }

    const cpus = Math.min(Math.max(parseFloat(runtime.resources?.cpus || challenge.cpu_limit || this.defaultCpuLimit), 0.1), 2.0);
    const memory = runtime.resources?.memory || challenge.memory_limit || this.defaultMemoryLimit;
    const pidsLimit = Math.min(Math.max(parseInt(runtime.resources?.pidsLimit || this.defaultPidsLimit, 10), 32), 512);

    const healthPath = (runtime.healthCheck?.path || challenge.health_check_path || '/').trim();
    if (!healthPath.startsWith('/')) {
      throw new Error('SECURITY_VIOLATION: Health check path must start with /.');
    }

    return {
      image: rawImage,
      containerPort,
      protocol: (runtime.protocol || challenge.protocol || 'http').toLowerCase(),
      cpus,
      memory,
      pidsLimit,
      healthPath,
      durationMinutes: parseInt(runtime.durationMinutes || challenge.instance_ttl_minutes || 30, 10)
    };
  }
}

const dockerSecurity = new DockerSecurity();
module.exports = dockerSecurity;
