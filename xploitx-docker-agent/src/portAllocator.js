/**
 * XPLOITX // CYBER BATTLEFIELD
 * Atomic Mutex-Protected Port Allocator (src/portAllocator.js)
 * Guarantees strictly unique port allocations in range 41000–41999 with zero race collisions.
 */

const net = require('net');

class PortAllocator {
  constructor(start = 41000, end = 41999) {
    this.startPort = start;
    this.endPort = end;
    this.allocatedPorts = new Map(); // port -> { instanceId, allocatedAt }
    this.mutex = false;
    this.mutexQueue = [];
  }

  async _acquireLock() {
    if (!this.mutex) {
      this.mutex = true;
      return;
    }
    return new Promise(resolve => this.mutexQueue.push(resolve));
  }

  _releaseLock() {
    if (this.mutexQueue.length > 0) {
      const next = this.mutexQueue.shift();
      next();
    } else {
      this.mutex = false;
    }
  }

  /**
   * Check if a TCP port is genuinely free on the host OS
   */
  _isPortFree(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
        server.close(() => resolve(true));
      });
    });
  }

  /**
   * Allocate next available unique port in range
   */
  async allocate(instanceId) {
    await this._acquireLock();
    try {
      // Check if instance already has an allocated port
      for (const [p, meta] of this.allocatedPorts.entries()) {
        if (meta.instanceId === instanceId) {
          return p;
        }
      }

      for (let port = this.startPort; port <= this.endPort; port++) {
        if (!this.allocatedPorts.has(port)) {
          const isFree = await this._isPortFree(port);
          if (isFree) {
            this.allocatedPorts.set(port, {
              instanceId,
              allocatedAt: new Date().toISOString()
            });
            return port;
          }
        }
      }

      throw new Error(`PORT_EXHAUSTION: All ports in range ${this.startPort}-${this.endPort} are currently occupied.`);
    } finally {
      this._releaseLock();
    }
  }

  /**
   * Release allocated port back to pool
   */
  async release(port) {
    await this._acquireLock();
    try {
      const numPort = Number(port);
      if (this.allocatedPorts.has(numPort)) {
        this.allocatedPorts.delete(numPort);
        return true;
      }
      return false;
    } finally {
      this._releaseLock();
    }
  }

  getAllocations() {
    const list = [];
    for (const [port, meta] of this.allocatedPorts.entries()) {
      list.push({ port, ...meta });
    }
    return list;
  }
}

// Export singleton instance for production use, and the class for testing
const defaultInstance = new PortAllocator();
module.exports = defaultInstance;
module.exports.PortAllocator = PortAllocator;
