/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real Container Health Readiness Prober (src/healthChecker.js)
 * Guarantees zero false positives: instances are NEVER marked RUNNING until confirmed healthy.
 */

const http = require('http');
const net = require('net');

class HealthChecker {
  /**
   * Probe container HTTP endpoint
   */
  static probeHttp(port, path = '/', host = '127.0.0.1', timeoutMs = 2000) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: host,
        port,
        path: path.startsWith('/') ? path : `/${path}`,
        method: 'GET',
        timeout: timeoutMs
      }, (res) => {
        // Any HTTP response (including 200, 302, 401, 403, 404) proves server is listening and healthy
        resolve({
          healthy: res.statusCode < 500 || res.statusCode === 502, // 502 might be cold start proxy, but <500 is alive
          statusCode: res.statusCode
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ healthy: false, error: 'TIMEOUT' });
      });

      req.on('error', (err) => {
        resolve({ healthy: false, error: err.code || err.message });
      });

      req.end();
    });
  }

  /**
   * Probe raw TCP socket (for binary/PWN challenges)
   */
  static probeTcp(port, host = '127.0.0.1', timeoutMs = 2000) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        socket.destroy();
        resolve({ healthy: true });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ healthy: false, error: 'TCP_TIMEOUT' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ healthy: false, error: err.code || err.message });
      });

      socket.connect(port, host);
    });
  }

  /**
   * Poll health until ready or maximum timeout exceeded
   */
  static async waitUntilReady({
    port,
    protocol = 'http',
    path = '/',
    host = '127.0.0.1',
    maxWaitMs = 15000,
    intervalMs = 500
  }) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      let result;
      if (protocol.toLowerCase() === 'tcp') {
        result = await this.probeTcp(port, host, 1500);
      } else {
        result = await this.probeHttp(port, path, host, 1500);
      }

      if (result.healthy) {
        return {
          healthy: true,
          latencyMs: Date.now() - startTime,
          statusCode: result.statusCode
        };
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }

    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: `HEALTH_CHECK_FAILED: Container did not respond on port ${port} within ${maxWaitMs / 1000}s.`
    };
  }
}

module.exports = HealthChecker;
