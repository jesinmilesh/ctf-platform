/**
 * XPLOITX // CYBER BATTLEFIELD
 * Universal Docker Runtime Interface (backend/instances/runtime/dockerRuntime.js)
 * Defines the contract for all Docker execution providers (local daemon, remote worker, etc.)
 */

class DockerRuntime {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Test connectivity to Docker Engine / Worker
   * @returns {Promise<boolean>}
   */
  async ping() {
    throw new Error('DockerRuntime.ping() must be implemented by subclass');
  }

  /**
   * Alias for ping
   */
  async isAvailable() {
    return this.ping();
  }

  /**
   * Get version information
   * @returns {Promise<object>}
   */
  async getVersion() {
    throw new Error('DockerRuntime.getVersion() must be implemented by subclass');
  }

  /**
   * Ensure dedicated isolated network exists
   * @param {string} networkName
   * @returns {Promise<boolean>}
   */
  async ensureNetwork(networkName = 'xploitx-instances') {
    throw new Error('DockerRuntime.ensureNetwork() must be implemented by subclass');
  }

  /**
   * Pull challenge image if needed
   * @param {string} image
   * @returns {Promise<boolean>}
   */
  async pullImage(image) {
    throw new Error('DockerRuntime.pullImage() must be implemented by subclass');
  }

  /**
   * Create challenge container
   * @param {object} options
   * @returns {Promise<{containerId: string, containerName: string}>}
   */
  async createContainer(options) {
    throw new Error('DockerRuntime.createContainer() must be implemented by subclass');
  }

  /**
   * Start container
   * @param {string} containerId
   * @returns {Promise<boolean>}
   */
  async startContainer(containerId) {
    throw new Error('DockerRuntime.startContainer() must be implemented by subclass');
  }

  /**
   * Stop container
   * @param {string} containerId
   * @param {number} timeoutSec
   * @returns {Promise<boolean>}
   */
  async stopContainer(containerId, timeoutSec = 2) {
    throw new Error('DockerRuntime.stopContainer() must be implemented by subclass');
  }

  /**
   * Restart container
   * @param {string} containerId
   * @param {number} timeoutSec
   * @returns {Promise<boolean>}
   */
  async restartContainer(containerId, timeoutSec = 2) {
    throw new Error('DockerRuntime.restartContainer() must be implemented by subclass');
  }

  /**
   * Remove container
   * @param {string} containerId
   * @param {boolean} force
   * @returns {Promise<boolean>}
   */
  async removeContainer(containerId, force = true) {
    throw new Error('DockerRuntime.removeContainer() must be implemented by subclass');
  }

  /**
   * Inspect container details
   * @param {string} containerId
   * @returns {Promise<object>}
   */
  async inspectContainer(containerId) {
    throw new Error('DockerRuntime.inspectContainer() must be implemented by subclass');
  }

  /**
   * List all containers managed by XploitX (label: xploitx.managed=true)
   * @returns {Promise<Array<object>>}
   */
  async listManagedContainers() {
    throw new Error('DockerRuntime.listManagedContainers() must be implemented by subclass');
  }
}

module.exports = DockerRuntime;
