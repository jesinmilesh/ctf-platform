/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Active Health Checker (instance-server/healthChecker.js)
 * Implements Section 33 of Master Production Specification:
 * - Supports HTTP, TCP, and custom health check probes
 * - Validates container responsiveness before state transitions to RUNNING
 * - Startup timeout enforcement (default 15s)
 * - Automatic failure reporting on timeout
 */

const http = require('http');
const net = require('net');

class HealthChecker {
  constructor() {
    this.defaultTimeoutMs = parseInt(process.env.INSTANCE_STARTUP_TIMEOUT_MS || '15000', 10);
  }

  /**
   * Run health check probe (HTTP, TCP, or CUSTOM)
   */
  async check({ host = '127.0.0.1', port, protocol = 'TCP', path = '/', timeoutMs = this.defaultTimeoutMs }) {
    const startTime = Date.now();
    const normalizedProto = (protocol || 'TCP').toUpperCase();

    while (Date.now() - startTime < timeoutMs) {
      let isHealthy = false;
      try {
        if (normalizedProto === 'HTTP') {
          isHealthy = await this.probeHttp(host, port, path, 1000);
        } else {
          // Default TCP socket check
          isHealthy = await this.probeTcp(host, port, 1000);
        }
      } catch (e) {
        isHealthy = false;
      }

      if (isHealthy) {
        return {
          healthy: true,
          durationMs: Date.now() - startTime
        };
      }

      // Backoff delay between probe attempts
      await new Promise(r => setTimeout(r, 400));
    }

    return {
      healthy: false,
      error: `Health check probe timed out after ${timeoutMs}ms for ${normalizedProto} on ${host}:${port}`
    };
  }

  /**
   * Probe TCP port connection
   */
  probeTcp(host, port, timeoutMs = 1000) {
    return new Promise(resolve => {
      const socket = new net.Socket();
      let resolved = false;

      socket.setTimeout(timeoutMs);

      socket.connect(port, host, () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });

      socket.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });
    });
  }

  /**
   * Probe HTTP endpoint
   */
  probeHttp(host, port, path = '/', timeoutMs = 1000) {
    return new Promise(resolve => {
      let resolved = false;
      const req = http.get({
        host,
        port,
        path,
        timeout: timeoutMs
      }, (res) => {
        if (!resolved) {
          resolved = true;
          // Any response status code (< 500) indicates operational server
          resolve(res.statusCode < 500);
        }
      });

      req.on('error', () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });

      req.on('timeout', () => {
        if (!resolved) {
          resolved = true;
          req.destroy();
          resolve(false);
        }
      });
    });
  }
}

module.exports = new HealthChecker();
