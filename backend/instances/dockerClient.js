/**
 * XPLOITX // CYBER BATTLEFIELD
 * Docker Client Abstraction Wrapper (backend/instances/dockerClient.js)
 * Wraps the Docker Runtime Factory to provide seamless backward compatibility
 * while strictly eliminating hardcoded developer/Windows paths and CLI dependencies.
 */

const runtimeFactory = require('./runtime/dockerRuntimeFactory');

class DockerClientWrapper {
  get runtime() {
    return runtimeFactory.getRuntime();
  }

  async isAvailable() {
    return this.runtime.isAvailable();
  }

  async ping() {
    return this.runtime.ping();
  }

  async getVersion() {
    return this.runtime.getVersion();
  }

  async ensureNetwork(networkName = 'xploitx-instances') {
    return this.runtime.ensureNetwork(networkName);
  }

  async pullImage(image) {
    return this.runtime.pullImage(image);
  }

  async createContainer(options) {
    return this.runtime.createContainer(options);
  }

  async startContainer(containerId) {
    return this.runtime.startContainer(containerId);
  }

  async stopContainer(containerId, timeoutSec = 2) {
    return this.runtime.stopContainer(containerId, timeoutSec);
  }

  async restartContainer(containerId, timeoutSec = 2) {
    return this.runtime.restartContainer(containerId, timeoutSec);
  }

  async removeContainer(containerId, force = true) {
    return this.runtime.removeContainer(containerId, force);
  }

  async inspectContainer(containerId) {
    return this.runtime.inspectContainer(containerId);
  }

  async listManagedContainers() {
    return this.runtime.listManagedContainers();
  }

  async request(method, endpoint, payload = null) {
    if (typeof this.runtime.request === 'function') {
      return this.runtime.request(method, endpoint, payload);
    }
    throw new Error('DIRECT_REST_REQUEST_UNAVAILABLE: Active runtime does not expose raw socket request method.');
  }
}

const dockerClient = new DockerClientWrapper();
module.exports = dockerClient;
