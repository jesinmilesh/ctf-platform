/**
 * XPLOITX // CYBER BATTLEFIELD
 * Remote Docker Runtime (backend/instances/runtime/remoteDockerRuntime.js)
 * Implements Docker operations by communicating with the dedicated standalone
 * Instance Worker microservice hosted on the production Linux Docker host.
 * 
 * Machine-to-Machine Security:
 * - Communicates with internal worker URL (INSTANCE_WORKER_URL)
 * - Authenticates requests via service secret (x-instance-worker-auth: Bearer <secret>)
 * - The main XploitX backend requires zero direct Docker socket access in production
 */

const http = require('http');
const https = require('https');
const DockerRuntime = require('./dockerRuntime');

class RemoteDockerRuntime extends DockerRuntime {
  constructor() {
    super('remote');
    this.workerUrl = (process.env.INSTANCE_WORKER_URL || 'http://127.0.0.1:5050').replace(/\/+$/, '');
    this.authSecret = process.env.INSTANCE_WORKER_AUTH_SECRET || '';
    this.timeoutMs = parseInt(process.env.INSTANCE_WORKER_TIMEOUT_MS || '20000', 10);
  }

  /**
   * Internal authenticated HTTP request to Instance Worker
   */
  async _request(method, endpoint, payload = null) {
    const targetUrl = new URL(`${this.workerUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`);
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const body = payload ? JSON.stringify(payload) : null;
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'XploitX-Backend-Runtime/2.0',
          'x-instance-worker-auth': `Bearer ${this.authSecret}`
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (e) {
            parsed = { raw: data };
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(parsed.message || parsed.error || `WORKER_ERROR_HTTP_${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.details = parsed;
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`INSTANCE_WORKER_UNREACHABLE: Failed to reach worker at ${this.workerUrl} (${err.message})`));
      });

      req.setTimeout(this.timeoutMs, () => {
        req.destroy();
        reject(new Error(`INSTANCE_WORKER_TIMEOUT: Request to worker timed out after ${this.timeoutMs}ms`));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * Ping worker and underlying Docker Engine
   */
  async ping() {
    try {
      const res = await this._request('GET', '/internal/docker/status');
      return res.dockerOperational === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get Docker Engine version from worker
   */
  async getVersion() {
    const res = await this._request('GET', '/internal/docker/status');
    return res.version || {};
  }

  /**
   * Ensure isolated network exists
   */
  async ensureNetwork(networkName = 'xploitx-instances') {
    const res = await this._request('POST', '/internal/networks/ensure', { network: networkName });
    return res.success === true;
  }

  /**
   * Pull image via worker
   */
  async pullImage(image) {
    const res = await this._request('POST', '/internal/images/pull', { image });
    return res.success === true;
  }

  /**
   * Create challenge container through worker
   */
  async createContainer(options) {
    const res = await this._request('POST', '/internal/instances', options);
    return {
      containerId: res.containerId,
      containerName: res.containerName
    };
  }

  /**
   * Start container
   */
  async startContainer(containerId) {
    const res = await this._request('POST', `/internal/instances/${encodeURIComponent(containerId)}/start`);
    return res.success === true;
  }

  /**
   * Stop container
   */
  async stopContainer(containerId, timeoutSec = 2) {
    const res = await this._request('POST', `/internal/instances/${encodeURIComponent(containerId)}/stop`, { timeoutSec });
    return res.success === true;
  }

  /**
   * Restart container and re-probe health
   */
  async restartContainer(containerId, timeoutSec = 2) {
    const res = await this._request('POST', `/internal/instances/${encodeURIComponent(containerId)}/restart`, { timeoutSec });
    return res.success === true;
  }

  /**
   * Remove container
   */
  async removeContainer(containerId, force = true) {
    const res = await this._request('DELETE', `/internal/instances/${encodeURIComponent(containerId)}`, { force });
    return res.success === true;
  }

  /**
   * Inspect container
   */
  async inspectContainer(containerId) {
    return this._request('GET', `/internal/instances/${encodeURIComponent(containerId)}`);
  }

  /**
   * List all managed containers
   */
  async listManagedContainers() {
    const res = await this._request('GET', '/internal/instances');
    return Array.isArray(res.containers) ? res.containers : [];
  }
}

module.exports = RemoteDockerRuntime;
