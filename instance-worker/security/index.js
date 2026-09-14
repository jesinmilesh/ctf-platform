/**
 * XPLOITX // Dedicated Instance Worker - Security Policy Enforcement (instance-worker/security/index.js)
 * Implements Phase 17 & Phase 18 of Master Specification:
 * - Drops all Linux capabilities (--cap-drop=ALL)
 * - Sets no-new-privileges:true
 * - Prohibits privileged mode
 * - Prohibits host filesystem mounts
 * - Prohibits Docker socket mounts
 * - Enforces CPU, memory, and PID limits
 */

const config = require('../config');

const VALID_IMAGE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_.-]+|@sha256:[a-f0-9]{64})?$/;

class SecurityEngine {
  validateImage(image) {
    if (!image || typeof image !== 'string') {
      throw new Error('SECURITY_VIOLATION: Invalid or missing Docker image name.');
    }
    if (!VALID_IMAGE_PATTERN.test(image.trim())) {
      throw new Error(`SECURITY_VIOLATION: Image reference '${image}' violates strict naming policy.`);
    }
    return image.trim();
  }

  buildHostConfig({
    hostPort,
    containerPort = 80,
    network = config.docker.network,
    cpus = config.limits.defaultCpus,
    memory = config.limits.defaultMemory,
    pidsLimit = config.limits.defaultPids
  }) {
    const portKey = `${containerPort}/tcp`;
    const memoryBytes = this._parseMemory(memory);
    const nanoCpus = Math.floor(Number(cpus) * 1e9);

    return {
      PortBindings: {
        [portKey]: [
          {
            HostIp: '0.0.0.0',
            HostPort: String(hostPort)
          }
        ]
      },
      NetworkMode: network,
      Memory: memoryBytes,
      NanoCpus: nanoCpus,
      PidsLimit: Number(pidsLimit),
      SecurityOpt: ['no-new-privileges:true'],
      CapDrop: ['ALL'],
      Privileged: false,
      Binds: [], // Zero host filesystem mounts allowed
      RestartPolicy: {
        Name: 'no'
      }
    };
  }

  _parseMemory(mem) {
    if (typeof mem === 'number') return mem;
    const s = String(mem).trim().toLowerCase();
    const match = s.match(/^(\d+(?:\.\d+)?)\s*([kmg])?b?$/);
    if (!match) return 268435456;
    const num = parseFloat(match[1]);
    const unit = match[2];
    if (unit === 'k') return Math.floor(num * 1024);
    if (unit === 'm') return Math.floor(num * 1024 * 1024);
    if (unit === 'g') return Math.floor(num * 1024 * 1024 * 1024);
    return Math.floor(num);
  }
}

module.exports = new SecurityEngine();
