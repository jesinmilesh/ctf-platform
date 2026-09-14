/**
 * XPLOITX // Dedicated Instance Worker - Native Docker Engine API Client (instance-worker/docker/runtime.js)
 * Connects directly to the host's Docker socket without relying on external CLI tools.
 */

const http = require('http');
const config = require('../config');

class WorkerDockerRuntime {
  constructor() {
    this.socketPath = config.docker.socketPath;
    this.host = config.docker.host;
    this.apiVersion = config.docker.apiVersion;
  }

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

      if (this.socketPath && (!this.host || !this.host.startsWith('tcp://'))) {
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
        options.socketPath = process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
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
        reject(new Error('Host Docker Engine API request timeout (15000ms)'));
      });

      if (payload) {
        req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
      }
      req.end();
    });
  }

  async ping() {
    try {
      const res = await this.request('GET', '/_ping');
      return res === 'OK' || res?.status === 'OK' || typeof res === 'object';
    } catch (e) {
      return false;
    }
  }

  async getVersion() {
    return this.request('GET', '/version');
  }
}

module.exports = new WorkerDockerRuntime();
