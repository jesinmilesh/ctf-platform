/**
 * XPLOITX // CYBER BATTLEFIELD
 * Local Docker Runtime (backend/instances/runtime/localDockerRuntime.js)
 * Implements direct programmatic Docker Engine API communication for local development.
 * 
 * ZERO HARDCODED DEVELOPER PATHS:
 * - Automatically connects via Windows named pipe (//./pipe/docker_engine) or Linux socket (/var/run/docker.sock)
 * - Supports DOCKER_HOST for custom local socket/remote endpoints
 * - Does NOT invoke or require the CLI docker.exe executable
 */

const http = require('http');
const DockerRuntime = require('./dockerRuntime');

class LocalDockerRuntime extends DockerRuntime {
  constructor() {
    super('local');
    this.host = process.env.DOCKER_HOST || null;
    this.socketPath = this._resolveSocketPath();
    this.apiVersion = process.env.DOCKER_API_VERSION || 'v1.45';
  }

  _resolveSocketPath() {
    if (this.host && (this.host.startsWith('tcp://') || this.host.startsWith('http://'))) {
      return null;
    }
    if (process.platform === 'win32') {
      return '//./pipe/docker_engine';
    }
    return '/var/run/docker.sock';
  }

  /**
   * Execute programmatic HTTP request against Docker Engine REST API
   */
  request(method, endpoint, payload = null) {
    return new Promise((resolve, reject) => {
      const pathWithVersion = `/${this.apiVersion}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
      const options = {
        method,
        path: pathWithVersion,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (this.socketPath) {
        options.socketPath = this.socketPath;
      } else if (this.host) {
        try {
          const u = new URL(this.host.replace('tcp://', 'http://'));
          options.hostname = u.hostname;
          options.port = u.port || 2375;
        } catch (e) {
          return reject(new Error(`INVALID_DOCKER_HOST: ${this.host}`));
        }
      } else {
        return reject(new Error('DOCKER_CONFIG_ERROR: No valid Docker socket or host configured.'));
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch (err) {
              resolve(data);
            }
          } else if (res.statusCode === 304) {
            resolve({});
          } else {
            let errorMsg = `HTTP ${res.statusCode}`;
            try {
              const parsed = JSON.parse(data);
              errorMsg = parsed.message || errorMsg;
            } catch (e) {
              if (data) errorMsg = data;
            }
            const error = new Error(errorMsg);
            error.statusCode = res.statusCode;
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Docker Engine API request timeout (15000ms)'));
      });

      if (payload) {
        req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
      req.end();
    });
  }

  /**
   * Ping Docker Engine
   */
  async ping() {
    try {
      const res = await this.request('GET', '/_ping');
      return res === 'OK' || res?.status === 'OK' || typeof res === 'object';
    } catch (e) {
      return false;
    }
  }

  /**
   * Get Docker Engine version
   */
  async getVersion() {
    return this.request('GET', '/version');
  }

  /**
   * Ensure isolated network exists
   */
  async ensureNetwork(networkName = 'xploitx-instances') {
    try {
      const networks = await this.request('GET', '/networks');
      const exists = Array.isArray(networks) && networks.some(n => n.Name === networkName);
      if (!exists) {
        await this.request('POST', '/networks/create', {
          Name: networkName,
          Driver: 'bridge',
          CheckDuplicate: true,
          Labels: {
            'xploitx.managed': 'true',
            'managed-by': 'xploitx-ctf'
          }
        });
        console.log(`[LOCAL DOCKER] Created network '${networkName}'`);
      }
      return true;
    } catch (err) {
      // 409 Conflict means network already exists
      if (err.statusCode === 409) return true;
      throw new Error(`FAILED_TO_ENSURE_DOCKER_NETWORK: ${err.message}`);
    }
  }

  /**
   * Pull image from repository if not present locally
   */
  async pullImage(image) {
    if (!image) throw new Error('IMAGE_REQUIRED: Image name is required to pull.');
    try {
      // First check if image exists locally
      await this.request('GET', `/images/${encodeURIComponent(image)}/json`);
      return true;
    } catch (e) {
      if (e.statusCode === 404) {
        console.log(`[LOCAL DOCKER] Pulling image '${image}' from registry...`);
        await this.request('POST', `/images/create?fromImage=${encodeURIComponent(image)}`);
        return true;
      }
      throw e;
    }
  }

  /**
   * Create challenge container
   */
  async createContainer({
    name,
    image,
    hostPort,
    containerPort = 80,
    network = 'xploitx-instances',
    env = {},
    labels = {},
    cpus = 0.5,
    memory = '256m',
    pidsLimit = 128
  }) {
    const portKey = `${containerPort}/tcp`;
    const memoryBytes = this._parseMemoryBytes(memory);
    const nanoCpus = Math.floor(Number(cpus) * 1e9);

    const body = {
      Image: image,
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      Labels: {
        'xploitx.managed': 'true',
        ...labels
      },
      ExposedPorts: {
        [portKey]: {}
      },
      HostConfig: {
        PortBindings: {
          [portKey]: [
            {
              HostIp: '0.0.0.0',
              HostPort: String(hostPort)
            }
          ]
        },
        NetworkMode: network,
        Memory: memoryBytes,
        NanoCpus: nanoCpus,
        PidsLimit: Number(pidsLimit),
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'],
        Privileged: false,
        RestartPolicy: {
          Name: 'no'
        }
      }
    };

    const res = await this.request('POST', `/containers/create?name=${encodeURIComponent(name)}`, body);
    return {
      containerId: res.Id,
      containerName: name
    };
  }

  /**
   * Start container
   */
  async startContainer(containerId) {
    await this.request('POST', `/containers/${containerId}/start`);
    return true;
  }

  /**
   * Stop container
   */
  async stopContainer(containerId, timeoutSec = 2) {
    try {
      await this.request('POST', `/containers/${containerId}/stop?t=${timeoutSec}`);
      return true;
    } catch (e) {
      if (e.statusCode === 304 || (e.message && e.message.includes('not running'))) {
        return true;
      }
      return true;
    }
  }

  /**
   * Restart container
   */
  async restartContainer(containerId, timeoutSec = 2) {
    await this.request('POST', `/containers/${containerId}/restart?t=${timeoutSec}`);
    return true;
  }

  /**
   * Remove container
   */
  async removeContainer(containerId, force = true) {
    try {
      await this.request('DELETE', `/containers/${containerId}?force=${force ? 1 : 0}&v=1`);
      return true;
    } catch (e) {
      if (e.statusCode === 404 || (e.message && e.message.includes('No such container'))) {
        return true;
      }
      throw e;
    }
  }

  /**
   * Inspect container
   */
  async inspectContainer(containerId) {
    return this.request('GET', `/containers/${containerId}/json`);
  }

  /**
   * List all managed containers
   */
  async listManagedContainers() {
    const filter = JSON.stringify({ label: ['xploitx.managed=true'] });
    const containers = await this.request('GET', `/containers/json?all=1&filters=${encodeURIComponent(filter)}`);
    return Array.isArray(containers) ? containers : [];
  }

  _parseMemoryBytes(memStr) {
    if (typeof memStr === 'number') return memStr;
    const s = String(memStr).trim().toLowerCase();
    const match = s.match(/^(\d+(?:\.\d+)?)\s*([kmg])?b?$/);
    if (!match) return 268435456; // 256MB default
    const num = parseFloat(match[1]);
    const unit = match[2];
    if (unit === 'k') return Math.floor(num * 1024);
    if (unit === 'm') return Math.floor(num * 1024 * 1024);
    if (unit === 'g') return Math.floor(num * 1024 * 1024 * 1024);
    return Math.floor(num);
  }
}

module.exports = LocalDockerRuntime;
