/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Atomic Port Allocator (instance-server/portAllocator.js)
 * Implements Section 29 & 30 of Master Production Specification:
 * - Unique host port per active instance
 * - Strict range: 41000 to 41999 (configurable)
 * - Atomic concurrency-safe locking to prevent race conditions during simultaneous requests
 * - Instant reservation before container creation starts
 */

class PortAllocator {
  constructor() {
    this.minPort = parseInt(process.env.INSTANCE_PORT_MIN || '41000', 10);
    this.maxPort = parseInt(process.env.INSTANCE_PORT_MAX || '41999', 10);
    // Port status registry: Map of port -> { instanceId, status: 'RESERVED' | 'ALLOCATED', reservedAt, allocatedAt }
    this.allocatedPorts = new Map();
    this.mutexLocked = false;
    this.queue = [];
  }

  /**
   * Acquire mutex lock
   */
  async acquireLock() {
    if (!this.mutexLocked) {
      this.mutexLocked = true;
      return;
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release mutex lock
   */
  releaseLock() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.mutexLocked = false;
    }
  }

  /**
   * Atomically reserve an available port for an instance before container creation begins.
   * If container startup fails, caller must call release(port).
   */
  async reserve(instanceId) {
    await this.acquireLock();
    try {
      for (let port = this.minPort; port <= this.maxPort; port++) {
        if (!this.allocatedPorts.has(port)) {
          this.allocatedPorts.set(port, {
            instanceId,
            status: 'RESERVED',
            reservedAt: Date.now()
          });
          return port;
        }
      }
      throw new Error(`PORT_EXHAUSTION: All ports in range ${this.minPort}-${this.maxPort} are currently reserved or allocated.`);
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Confirm the port allocation once Docker creation and health check succeed.
   */
  async confirmAllocation(port, instanceId) {
    await this.acquireLock();
    try {
      const entry = this.allocatedPorts.get(port);
      if (entry && entry.instanceId === instanceId) {
        entry.status = 'ALLOCATED';
        entry.allocatedAt = Date.now();
        return true;
      }
      return false;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Release a port back to the available pool.
   */
  async release(port) {
    await this.acquireLock();
    try {
      if (this.allocatedPorts.has(port)) {
        this.allocatedPorts.delete(port);
        return true;
      }
      return false;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Query status of an allocated port
   */
  getPortInfo(port) {
    return this.allocatedPorts.get(port) || null;
  }

  /**
   * Get all active port allocations
   */
  getAllocations() {
    const list = [];
    for (const [port, data] of this.allocatedPorts.entries()) {
      list.push({ port, ...data });
    }
    return list;
  }

  /**
   * Reset / Clear all allocations (used in reconciliation or tests)
   */
  async reset() {
    await this.acquireLock();
    try {
      this.allocatedPorts.clear();
    } finally {
      this.releaseLock();
    }
  }
}

module.exports = new PortAllocator();
