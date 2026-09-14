/**
 * XPLOITX // CYBER BATTLEFIELD
 * Programmatic Docker Engine API Manager (src/dockerManager.js)
 * Connects directly over Windows named pipe (//./pipe/docker_engine) or Unix domain socket.
 * Zero CLI or local path dependencies.
 */

const http = require('http');
const AgentSecurity = require('./security');

class DockerManager {
  constructor(options = {}) {
    this.socketPath = options.socketPath || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock');
    this.apiVersion = options.apiVersion || 'v1.45';
    this.networkName = options.networkName || 'xploitx-instances';
  }

  /**
   * Raw programmatic request to Docker Engine REST API
   */
  request(method, endpoint, payload = null) {
    return new Promise((resolve, reject) => {
      const pathWithVersion = `/${this.apiVersion}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const options = {
        socketPath: this.socketPath,
        method,
        path: pathWithVersion,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = rawData ? JSON.parse(rawData) : {};
              resolve(parsed);
            } catch (e) {
              resolve(rawData);
            }
          } else if (res.statusCode === 304) {
            resolve({ notModified: true });
          } else {
            let errorMsg = `Docker API error: HTTP ${res.statusCode}`;
            try {
              const errObj = JSON.parse(rawData);
              if (errObj.message) errorMsg = errObj.message;
            } catch (e) {
              if (rawData) errorMsg += ` - ${rawData}`;
            }
            const err = new Error(errorMsg);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`DOCKER_ENGINE_UNREACHABLE: Failed to connect to Docker socket (${this.socketPath}): ${err.message}`));
      });

      if (payload) {
        req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
      req.end();
    });
  }

  async isAvailable() {
    try {
      await this.request('GET', '/_ping');
      return true;
    } catch (e) {
      return false;
    }
  }

  async getVersion() {
    return this.request('GET', '/version');
  }

  async ensureNetwork() {
    try {
      const networks = await this.request('GET', '/networks');
      const found = Array.isArray(networks) && networks.some(n => n.Name === this.networkName);
      if (!found) {
        await this.request('POST', '/networks/create', {
          Name: this.networkName,
          Driver: 'bridge',
          CheckDuplicate: true
        });
      }
      return true;
    } catch (e) {
      console.warn(`[DOCKER MANAGER] Warning ensuring network ${this.networkName}:`, e.message);
      return false;
    }
  }

  async createContainer({
    image,
    name,
    hostPort,
    containerPort = 80,
    env = [],
    memoryMB = 256,
    cpuQuota = 0.5,
    pidsLimit = 64,
    networkMode = 'LOCAL',
    labels = {}
  }) {
    AgentSecurity.validateImage(image);

    const securityConfig = AgentSecurity.buildContainerSecurityConfig({
      hostPort,
      containerPort,
      networkMode,
      memoryMB,
      cpuQuota,
      pidsLimit
    });

    const body = {
      Image: image,
      Env: env,
      ExposedPorts: {
        [`${containerPort}/tcp`]: {}
      },
      HostConfig: securityConfig,
      Labels: {
        'xploitx.managed': 'true',
        'xploitx.agent': 'true',
        'xploitx.containerPort': String(containerPort),
        'xploitx.hostPort': String(hostPort),
        ...labels
      }
    };

    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const res = await this.request('POST', `/containers/create${query}`, body);
    return {
      containerId: res.Id,
      warnings: res.Warnings
    };
  }

  async startContainer(containerId) {
    return this.request('POST', `/containers/${encodeURIComponent(containerId)}/start`);
  }

  async stopContainer(containerId, timeoutSec = 2) {
    try {
      return await this.request('POST', `/containers/${encodeURIComponent(containerId)}/stop?t=${timeoutSec}`);
    } catch (e) {
      if (e.statusCode === 304) return { alreadyStopped: true };
      throw e;
    }
  }

  async removeContainer(containerId, force = true) {
    return this.request('DELETE', `/containers/${encodeURIComponent(containerId)}?force=${force ? '1' : '0'}&v=1`);
  }

  async inspectContainer(containerId) {
    return this.request('GET', `/containers/${encodeURIComponent(containerId)}/json`);
  }

  async listManagedContainers() {
    const containers = await this.request('GET', '/containers/json?all=1');
    if (!Array.isArray(containers)) return [];
    return containers.filter(c => c.Labels && (c.Labels['xploitx.managed'] === 'true' || c.Labels['xploitx.agent'] === 'true'));
  }
}

module.exports = DockerManager;
