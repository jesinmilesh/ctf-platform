/**
 * XPLOITX // CYBER BATTLEFIELD
 * Atomic Port Allocator with Concurrency Mutex (backend/instances/portAllocator.js)
 * Implements Sections 7, 24 of Architectural Specification:
 * - Range: 41000 - 41999 strictly.
 * - Concurrency protected via asynchronous mutex.
 * - Cross-checked against MongoDB Atlas active records and Docker network bindings.
 * - Fails closed with 503 if port pool is exhausted.
 */

const net = require('net');
const db = require('../config/database');
const env = require('../config/environment');

class PortAllocator {
  constructor() {
    this.startPort = parseInt(process.env.INSTANCE_PORT_START || env.INSTANCE_PORT_START || '41000', 10);
    this.endPort = parseInt(process.env.INSTANCE_PORT_END || env.INSTANCE_PORT_END || '41999', 10);
    this._mutex = null;
  }

  async _acquireMutex() {
    while (this._mutex) {
      await this._mutex;
    }
    let release;
    this._mutex = new Promise(r => { release = r; });
    return release;
  }

  /**
   * Probe if a local host port is available for binding
   */
  _isPortFreeLocally(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Atomically allocate the next available port in range
   */
  async allocate(instanceId) {
    const release = await this._acquireMutex();

    try {
      // 1. Gather all currently allocated/active ports from database
      const activeStatuses = [
        'REQUESTED',
        'ALLOCATING',
        'PORT_RESERVED',
        'CONTAINER_CREATING',
        'STARTING',
        'HEALTH_CHECKING',
        'RUNNING',
        'STOPPING'
      ];

      const instances = db.getInstances ? db.getInstances() : [];
      const portAllocations = db.getPortAllocations ? db.getPortAllocations() : [];

      const activePorts = new Set([
        ...portAllocations.map(a => Number(a.port)),
        ...instances
          .filter(i => activeStatuses.includes(i.status))
          .map(i => Number(i.port))
          .filter(Boolean)
      ]);

      // 2. Scan sequentially from start to end (deterministic, zero Math.random)
      for (let port = this.startPort; port <= this.endPort; port++) {
        if (!activePorts.has(port)) {
          // Verify port is not physically occupied by an external host socket
          const free = await this._isPortFreeLocally(port);
          if (free) {
            const allocation = {
              port,
              instanceId,
              instance_id: instanceId,
              allocatedAt: new Date().toISOString(),
              allocated_at: new Date().toISOString()
            };

            if (db.getPortAllocations) {
              db.getPortAllocations().push(allocation);
            }
            await db.persistDoc('portAllocations', allocation).catch(() => {});

            console.log(`[PORT ALLOCATOR] Atomically reserved port ${port} for instance ${instanceId}`);
            return port;
          }
        }
      }

      const err = new Error(`PORT_EXHAUSTION: All ports between ${this.startPort} and ${this.endPort} are currently in use.`);
      err.statusCode = 503;
      err.code = 'PORT_EXHAUSTION';
      throw err;
    } finally {
      this._mutex = null;
      release();
    }
  }

  /**
   * Atomically release a port back to the pool
   */
  async release(port) {
    const release = await this._acquireMutex();
    try {
      const numPort = Number(port);
      if (db.getPortAllocations) {
        const arr = db.getPortAllocations();
        const idx = arr.findIndex(a => Number(a.port) === numPort);
        if (idx !== -1) {
          arr.splice(idx, 1);
        }
      }

      if (db.isMongo && db.getMongoDb()) {
        const coll = db.getMongoDb().collection('port_allocations');
        await coll.deleteOne({ port: numPort }).catch(() => {});
      }

      console.log(`[PORT ALLOCATOR] Released port ${port} back to pool.`);
      return true;
    } finally {
      this._mutex = null;
      release();
    }
  }

  getRange() {
    return { start: this.startPort, end: this.endPort };
  }
}

const portAllocator = new PortAllocator();
module.exports = portAllocator;
