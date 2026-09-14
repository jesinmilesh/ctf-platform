/**
 * XPLOITX // CYBER BATTLEFIELD
 * Docker Runtime Factory (backend/instances/runtime/dockerRuntimeFactory.js)
 * Instantiates and provides the authoritative Docker runtime provider based on environment.
 * 
 * Environments:
 * - Development: DOCKER_RUNTIME=local (Docker Desktop / local daemon)
 * - Production:  DOCKER_RUNTIME=worker (Dedicated Linux Instance Worker microservice)
 */

const LocalDockerRuntime = require('./localDockerRuntime');
const RemoteDockerRuntime = require('./remoteDockerRuntime');

class DockerRuntimeFactory {
  constructor() {
    this._instance = null;
    this._runtimeType = null;
  }

  /**
   * Get the singleton Docker runtime implementation
   * @param {string} [overrideType] Optional override ('local' | 'worker' | 'remote')
   * @returns {import('./dockerRuntime')}
   */
  getRuntime(overrideType = null) {
    const requested = (overrideType || process.env.DOCKER_RUNTIME || 'local').toLowerCase();

    if (this._instance && this._runtimeType === requested) {
      return this._instance;
    }

    if (requested === 'worker' || requested === 'remote') {
      console.log(`[DOCKER FACTORY] Initialized Remote Docker Worker Runtime (Target: ${process.env.INSTANCE_WORKER_URL || 'http://127.0.0.1:5050'})`);
      this._instance = new RemoteDockerRuntime();
      this._runtimeType = requested;
    } else {
      console.log('[DOCKER FACTORY] Initialized Local Docker Engine API Runtime (Native Socket / Named Pipe)');
      this._instance = new LocalDockerRuntime();
      this._runtimeType = 'local';
    }

    return this._instance;
  }

  /**
   * Reset cached instance (used during testing)
   */
  reset() {
    this._instance = null;
    this._runtimeType = null;
  }
}

const factory = new DockerRuntimeFactory();
module.exports = factory;
