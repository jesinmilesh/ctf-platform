/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real HTTP Health Checker (backend/instances/healthChecker.js)
 * Implements Sections 13 & 18 of Architectural Specification:
 * - Actively polls challenge container HTTP socket on mapped host port.
 * - Validates HTTP response (200-499) before transitioning instance to RUNNING.
 * - Prevents marking an instance RUNNING if container fails to boot or bind.
 */

const http = require('http');

class HealthChecker {
  /**
   * Poll HTTP endpoint on host port until healthy or timeout
   */
  async check({
    host = '127.0.0.1',
    port,
    path = '/',
    maxRetries = 15,
    intervalMs = 1000,
    timeoutMs = 3000
  }) {
    if (!port) throw new Error('HEALTHCHECK_ERROR: Target port is required');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = `http://${host}:${port}${cleanPath}`;

    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this._singleProbe(host, port, cleanPath, timeoutMs);
        if (res.statusCode >= 200 && res.statusCode < 500) {
          return {
            success: true,
            statusCode: res.statusCode,
            attempts: attempt,
            latencyMs: Date.now() - startTime,
            url
          };
        }
        lastError = new Error(`Unexpected HTTP status ${res.statusCode}`);
      } catch (err) {
        lastError = err;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    throw new Error(`HEALTHCHECK_FAILED: Endpoint ${url} unreachable after ${maxRetries} attempts (${lastError ? lastError.message : 'Timeout'})`);
  }

  _singleProbe(host, port, path, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: host,
        port,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'XploitX-HealthProbe/2.0',
          'Accept': '*/*'
        }
      }, (res) => {
        // Consume data to avoid socket hang
        res.resume();
        resolve({ statusCode: res.statusCode });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Probe request timeout (${timeoutMs}ms)`));
      });
      req.end();
    });
  }
}

const healthChecker = new HealthChecker();
module.exports = healthChecker;
