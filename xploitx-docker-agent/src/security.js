/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Security & Container Policy Enforcer (src/security.js)
 *
 * Validates Docker image names and builds hardened container security configs.
 * This module is the security boundary between operator commands and Docker Engine.
 */

const os = require('os');

// Maximum image name length (including registry, repo, and tag)
const MAX_IMAGE_LENGTH = 256;

// Pattern allows:
//   - Simple: nginx, alpine, ubuntu:20.04
//   - Docker Hub namespaced: xploitx/pwn-challenge:1.0
//   - Registry: registry.example.com/ctf/web:stable
//   - Port in registry: registry.example.com:5000/image:tag
const SAFE_IMAGE_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*)(:[0-9]+)?(\/[a-zA-Z0-9._\/-]+)?(:[a-zA-Z0-9._-]+)?$/;

// Characters that indicate shell injection or path traversal
const DANGEROUS_PATTERN = /[;&|`$(){}'"\\<>\s]/;

class AgentSecurity {
  /**
   * Validates that an image string is safe to pass to Docker.
   * Throws SECURITY_VIOLATION if the image is suspicious.
   */
  static validateImage(image) {
    if (!image || typeof image !== 'string') {
      throw new Error('SECURITY_VIOLATION: Challenge container image name is required.');
    }

    const trimmed = image.trim();

    // Length check
    if (trimmed.length === 0) {
      throw new Error('SECURITY_VIOLATION: Image name cannot be empty.');
    }
    if (trimmed.length > MAX_IMAGE_LENGTH) {
      throw new Error(`SECURITY_VIOLATION: Image name exceeds maximum length (${MAX_IMAGE_LENGTH} chars).`);
    }

    // Dangerous character injection check (shell metacharacters)
    if (DANGEROUS_PATTERN.test(trimmed)) {
      throw new Error(`SECURITY_VIOLATION: Image name contains dangerous characters: "${trimmed}"`);
    }

    // Path traversal check
    if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
      throw new Error(`SECURITY_VIOLATION: Path traversal detected in image name: "${trimmed}"`);
    }

    // Structural validation
    if (!SAFE_IMAGE_PATTERN.test(trimmed)) {
      throw new Error(`SECURITY_VIOLATION: Disallowed container image identifier: "${trimmed}"`);
    }

    return trimmed;
  }

  /**
   * Builds a hardened Docker HostConfig for a challenge container.
   * Enforces memory limits, CPU quotas, PID limits, and security options.
   */
  static buildContainerConfig({
    image,
    hostPort,
    containerPort = 80,
    instanceId,
    labels = {},
    resourceLimits = {}
  }) {
    const memoryMb  = resourceLimits.memoryMb  || 256;
    const cpuPercent = resourceLimits.cpuPercent || 50;
    const pids      = resourceLimits.pids       || 64;

    return {
      Image: image,
      ExposedPorts: {
        [`${containerPort}/tcp`]: {}
      },
      Labels: {
        'xploitx.managed': 'true',
        'xploitx.instanceId': instanceId || '',
        ...labels
      },
      HostConfig: {
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostIp: '0.0.0.0', HostPort: String(hostPort) }]
        },
        Memory: memoryMb * 1024 * 1024,
        NanoCpus: Math.floor((cpuPercent / 100) * 1e9),
        PidsLimit: pids,
        SecurityOpt: ['no-new-privileges'],
        AutoRemove: false,
        RestartPolicy: { Name: 'no' },
        NetworkMode: 'xploitx-instances'
      }
    };
  }

  /**
   * @deprecated Use buildContainerConfig
   */
  static buildContainerSecurityConfig(opts) {
    return AgentSecurity.buildContainerConfig(opts)?.HostConfig || {};
  }

  static getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }
}

module.exports = AgentSecurity;
