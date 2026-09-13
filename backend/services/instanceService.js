/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Container Instance Service (backend/services/instanceService.js)
 * Implements Sections 19, 20, 21, 22, 25:
 * Real Instance System, Atomic Unique Ports (41000-41999), Subdomain Routing, and Lifecycle Tracking.
 */

const db = require('../config/database');
const instanceManager = require('../instances/instanceManager');

class InstanceService {
  async deployInstance(challengeId, user) {
    return instanceManager.spawnInstance(challengeId, user);
  }

  async terminateInstance(challengeId, user) {
    return instanceManager.terminateInstance(challengeId, user);
  }

  getActiveInstance(challengeId, user) {
    return instanceManager.getActiveInstance(challengeId, user);
  }

  getAllInstances() {
    return instanceManager.getAllInstances();
  }
}

module.exports = new InstanceService();
