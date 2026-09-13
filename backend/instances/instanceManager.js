/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Manager Orchestrator (backend/instances/instanceManager.js)
 * Implements Sections 12, 13, 14, 16, 17, 18, 25, 26, 27, 47 of Architectural Blueprint:
 * Complete instance state machine, port allocator, docker manager, health check, and live events.
 */

const db = require('../config/database');
const env = require('../config/environment');
const portAllocator = require('./portAllocator');
const dockerManager = require('./dockerManager');
const instanceRouter = require('./instanceRouter');
const realtimeService = require('../services/realtimeService');
const Events = require('../realtime/events');

class InstanceManager {
  /**
   * Run Instance Workflow (Section 17 & 47)
   */
  async spawnInstance(challengeId, user) {
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (!challenge.has_instance) throw new Error('Mission target is static; no container daemon required.');

    const teamId = user.team_id || null;
    const userId = user.id;

    // Check if team already has an active running instance for this challenge
    let existing = db.getInstances().find(i =>
      i.challenge_id === challenge.id &&
      ((teamId && i.team_id === teamId) || i.user_id === userId) &&
      i.status === 'RUNNING'
    );

    if (existing) {
      const endpoints = instanceRouter.resolveEndpoints(existing.id, existing.port);
      return {
        instanceId: existing.id,
        status: existing.status,
        ...endpoints,
        expiresAt: existing.expires_at,
        timeRemainingSeconds: Math.max(0, Math.floor((new Date(existing.expires_at) - Date.now()) / 1000)),
        message: 'Active sandbox already operational'
      };
    }

    const crypto = require('crypto');
    const instanceId = `inst-${crypto.randomUUID()}`;

    // 1. Emit REQUESTED
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_REQUESTED, {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'REQUESTED'
    });

    // 2. Allocate Port (Section 13 & 44)
    let allocatedPort;
    try {
      allocatedPort = await portAllocator.allocate(instanceId);
    } catch (err) {
      await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED, {
        instanceId,
        challengeId: challenge.id,
        teamId,
        error: err.message
      });
      throw err;
    }

    // 3. Emit STARTING
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_STARTING, {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'STARTING',
      port: allocatedPort
    });

    // 4. Start Container with Health Check (Section 18 & 46)
    let containerInfo;
    try {
      containerInfo = await dockerManager.spawnContainer({
        instanceId,
        challenge,
        hostPort: allocatedPort
      });
    } catch (err) {
      await portAllocator.release(allocatedPort);
      await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED, {
        instanceId,
        challengeId: challenge.id,
        teamId,
        error: err.message
      });
      throw err;
    }

    // 5. Store Instance in Database (Authoritative Source of Truth)
    const ttlMinutes = challenge.instance_ttl_minutes || env.INSTANCE_DEFAULT_TTL_MINUTES || 30;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const endpoints = instanceRouter.resolveEndpoints(instanceId, allocatedPort);

    const instanceRecord = {
      id: instanceId,
      challenge_id: challenge.id,
      team_id: teamId,
      user_id: userId,
      container_id: containerInfo.containerId,
      host: endpoints.host,
      port: allocatedPort,
      subdomain: endpoints.subdomain,
      status: 'RUNNING',
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    db.getInstances().push(instanceRecord);

    // 6. Broadcast INSTANCE_STARTED
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_STARTED, {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'RUNNING',
      host: endpoints.host,
      port: allocatedPort,
      expiresAt
    });

    return {
      instanceId,
      status: 'RUNNING',
      ...endpoints,
      expiresAt,
      timeRemainingSeconds: ttlMinutes * 60,
      message: 'Containerized target successfully spawned'
    };
  }

  /**
   * Terminate Instance
   */
  async terminateInstance(challengeId, user) {
    const teamId = user.team_id || null;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    const instance = db.getInstances().find(i =>
      (i.challenge_id === challengeId || i.id === challengeId) &&
      (isAdmin || (teamId && i.team_id === teamId) || i.user_id === user.id) &&
      i.status === 'RUNNING'
    );

    if (!instance) {
      throw new Error('No active running instance found for this mission');
    }

    instance.status = 'STOPPED';

    if (instance.container_id) {
      await dockerManager.destroyContainer(instance.container_id);
    }
    if (instance.port) {
      await portAllocator.release(instance.port);
    }

    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_STOPPED, {
      instanceId: instance.id,
      challengeId: instance.challenge_id,
      teamId: instance.team_id,
      status: 'STOPPED'
    });

    return { success: true, message: 'Sandbox container neutralized' };
  }

  getActiveInstance(challengeId, user) {
    const teamId = user ? user.team_id : null;
    const userId = user ? user.id : null;

    const inst = db.getInstances().find(i =>
      i.challenge_id === challengeId &&
      ((teamId && i.team_id === teamId) || (userId && i.user_id === userId)) &&
      i.status === 'RUNNING'
    );

    if (!inst) return null;

    const endpoints = instanceRouter.resolveEndpoints(inst.id, inst.port);
    return {
      instanceId: inst.id,
      status: inst.status,
      ...endpoints,
      expiresAt: inst.expires_at,
      timeRemainingSeconds: Math.max(0, Math.floor((new Date(inst.expires_at) - Date.now()) / 1000))
    };
  }

  getAllInstances() {
    const challenges = db.getChallenges();
    const teams = db.getTeams();

    return db.getInstances().map(i => {
      const ch = challenges.find(c => c.id === i.challenge_id);
      const tm = teams.find(t => t.id === i.team_id);
      const endpoints = instanceRouter.resolveEndpoints(i.id, i.port);

      return {
        ...i,
        ...endpoints,
        challengeTitle: ch ? ch.title : 'Mission Target',
        teamName: tm ? tm.name : 'Solo Operative'
      };
    });
  }
}

const instanceManager = new InstanceManager();
module.exports = instanceManager;
