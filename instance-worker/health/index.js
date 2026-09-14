/**
 * XPLOITX // Dedicated Instance Worker - Active Health Checker (instance-worker/health/index.js)
 * Probes the container's mapped port to confirm genuine application responsiveness.
 */

const http = require('http');

class HealthChecker {
  async probe({
    host = '127.0.0.1',
    port,
    path = '/health',
    maxRetries = 15,
    intervalMs = 1000,
    timeoutMs = 3000
  }) {
    if (!port) throw new Error('TARGET_PORT_REQUIRED');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = `http://${host}:${port}${cleanPath}`;

    let lastErr = null;
    const start = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await this._singleProbe(host, port, cleanPath, timeoutMs);
        if (res.statusCode >= 200 && res.statusCode < 500) {
          return {
            healthy: true,
            statusCode: res.statusCode,
            attempts: attempt,
            durationMs: Date.now() - start
          };
        }
        lastErr = new Error(`Unexpected HTTP status ${res.statusCode}`);
      } catch (err) {
        lastErr = err;
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    throw new Error(`HEALTHCHECK_FAILED: Container on ${url} failed health probe (${lastErr ? lastErr.message : 'Timeout'})`);
  }

  _singleProbe(host, port, path, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: host,
        port,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'XploitX-Worker-Probe/2.0',
          'Accept': '*/*'
        }
      }, (res) => {
        res.resume();
        resolve({ statusCode: res.statusCode });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Probe timeout after ${timeoutMs}ms`));
      });
      req.end();
    });
  }
}

module.exports = new HealthChecker();
