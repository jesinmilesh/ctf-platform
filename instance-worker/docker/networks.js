/**
 * XPLOITX // Dedicated Instance Worker - Network Management (instance-worker/docker/networks.js)
 */

const runtime = require('./runtime');
const config = require('../config');

class NetworkManager {
  async ensureNetwork(networkName = config.docker.network) {
    try {
      const networks = await runtime.request('GET', '/networks');
      const exists = Array.isArray(networks) && networks.some(n => n.Name === networkName);
      if (!exists) {
        await runtime.request('POST', '/networks/create', {
          Name: networkName,
          Driver: 'bridge',
          CheckDuplicate: true,
          Labels: {
            'xploitx.managed': 'true',
            'managed-by': 'xploitx-instance-worker'
          }
        });
        console.log(`[WORKER] Created isolated Docker network '${networkName}'`);
      }
      return true;
    } catch (err) {
      if (err.statusCode === 409) return true;
      throw new Error(`WORKER_NETWORK_ERROR: ${err.message}`);
    }
  }
}

module.exports = new NetworkManager();
