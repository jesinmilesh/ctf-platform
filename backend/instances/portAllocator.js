/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dynamic Port Allocator with Concurrency Locking (backend/instances/portAllocator.js)
 * Implements Sections 13, 43, 44 of Architectural Blueprint:
 * Range: 41000 - 41999 with atomic reservation locks.
 */

const env = require('../config/environment');
const db = require('../config/database');

class PortAllocator {
  constructor() {
    this.startPort = env.INSTANCE_PORT_START || 41000;
    this.endPort = env.INSTANCE_PORT_END || 41999;
    this.allocationLock = false;
    this.lockWaitQueue = [];
  }

  async acquireLock() {
    if (!this.allocationLock) {
      this.allocationLock = true;
      return;
    }
    return new Promise(resolve => {
      this.lockWaitQueue.push(resolve);
    });
  }

  releaseLock() {
    if (this.lockWaitQueue.length > 0) {
      const next = this.lockWaitQueue.shift();
      next();
    } else {
      this.allocationLock = false;
    }
  }

  /**
   * Atomic Port Reservation (Section 44)
   */
  async allocate(instanceId) {
    await this.acquireLock();
    try {
      const allocatedPort = await db.allocatePort(this.startPort, this.endPort, instanceId);
      return allocatedPort;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Release Port back to the pool
   */
  async release(port) {
    await this.acquireLock();
    try {
      db.releasePort(port);
      return true;
    } finally {
      this.releaseLock();
    }
  }

  getRange() {
    return { start: this.startPort, end: this.endPort };
  }
}

const portAllocator = new PortAllocator();
module.exports = portAllocator;
