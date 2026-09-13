/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Security Policy Enforcement (instance-server/security.js)
 * Implements Section 36 of Master Production Specification:
 * - Resource constraints (CPU, memory, PIDs)
 * - Network isolation & separation from host services
 * - Process isolation (drop capabilities, no-new-privileges, unprivileged UID)
 * - Read-only filesystem layers where appropriate
 */

class InstanceSecurity {
  constructor(config = {}) {
    this.cpuLimit = config.cpuLimit || parseFloat(process.env.CONTAINER_CPU_LIMIT || '0.5');
    this.memoryLimit = config.memoryLimit || process.env.CONTAINER_MEM_LIMIT || '256m';
    this.pidsLimit = config.pidsLimit || parseInt(process.env.CONTAINER_PIDS_LIMIT || '100', 10);
    this.dropCapabilities = [
      'ALL',           // Drop all capabilities by default
      'CAP_NET_RAW',
      'CAP_SYS_ADMIN',
      'CAP_SYS_PTRACE',
      'CAP_DAC_OVERRIDE'
    ];
    this.allowedCapabilities = ['CHOWN', 'SETUID', 'SETGID']; // minimal required for unprivileged app
  }

  /**
   * Build hardened Docker container run options
   */
  getHardenedContainerOptions({ name, image, hostPort, containerPort = 80 }) {
    return {
      name,
      image,
      HostConfig: {
        PortBindings: {
          [`${containerPort}/tcp`]: [{ HostPort: `${hostPort}` }]
        },
        Memory: this.parseMemoryBytes(this.memoryLimit),
        NanoCpus: Math.floor(this.cpuLimit * 1e9),
        PidsLimit: this.pidsLimit,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        CapAdd: ['CHOWN', 'SETUID', 'SETGID', 'KILL'],
        RestartPolicy: { Name: 'no' },
        // Disallow mounting host filesystem or docker socket
        Binds: [],
        NetworkMode: 'bridge'
      },
      Labels: {
        'managed-by': 'xploitx-instance-orchestrator',
        'host-port': `${hostPort}`,
        'created-at': new Date().toISOString()
      }
    };
  }

  /**
   * Parse memory string (e.g. 256m, 512m, 1g) to bytes
   */
  parseMemoryBytes(memStr) {
    if (typeof memStr === 'number') return memStr;
    const str = String(memStr).trim().toLowerCase();
    const unit = str.slice(-1);
    const val = parseFloat(str.slice(0, -1));
    if (unit === 'g') return Math.floor(val * 1024 * 1024 * 1024);
    if (unit === 'm') return Math.floor(val * 1024 * 1024);
    if (unit === 'k') return Math.floor(val * 1024);
    return Math.floor(parseFloat(str));
  }

  /**
   * Validate that an image is permissible
   */
  validateImage(image) {
    if (!image || typeof image !== 'string') return false;
    const safeRegex = /^[a-z0-9_./:-]+$/i;
    return safeRegex.test(image) && !image.includes('..') && !image.includes(';');
  }
}

module.exports = new InstanceSecurity();
