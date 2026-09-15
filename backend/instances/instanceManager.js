/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real Instance Manager Orchestrator (backend/instances/instanceManager.js)
 * Implements Sections 1, 9, 10, 11, 12, 17, 18, 20, 24, 31, 33 of Architectural Specification:
 * - Real Docker Engine container lifecycle (zero mocks, zero simulation).
 * - Concurrency protection: duplicate click returns active sandbox.
 * - Real 10-state lifecycle machine.
 * - Atomic port allocation (41000-41999).
 * - Real HTTP health check before RUNNING.
 * - Idempotent termination and automatic cleanup rollback.
 */

const crypto = require('crypto');
const db = require('../config/database');
const env = require('../config/environment');
const portAllocator = require('./portAllocator');
const dockerManager = require('./dockerManager');
const dockerClient = require('./dockerClient');
const instanceRouter = require('./instanceRouter');
const realtimeService = require('../services/realtimeService');
const auditService = require('../services/auditService');
const Events = require('../realtime/events');

// Lazy-load agentManager to avoid circular dependencies at startup
function getAgentManager() {
  try { return require('../agents/agentManager'); } catch { return null; }
}

class InstanceManager {
  /**
   * Spawn a real Challenge Container Instance (Section 10)
   */
  async spawnInstance(challengeId, user) {
    if (!user) throw new Error('AUTH_REQUIRED: Authentication required.');

    const cleanId = String(challengeId).trim();
    const challenges = db.getChallenges ? db.getChallenges() : [];
    const challenge = challenges.find(c =>
      c.id === cleanId ||
      c.slug === cleanId ||
      c.mission_id === cleanId ||
      (c._id && String(c._id) === cleanId) ||
      (c.title && c.title.toLowerCase() === cleanId.toLowerCase())
    );
    if (!challenge) throw new Error('NOT_FOUND: Challenge not found.');

    const hasInstance = challenge.runtime?.enabled || challenge.has_instance;
    if (!hasInstance) {
      throw new Error('BAD_REQUEST: Mission target is static; no container daemon required.');
    }

    const teamId = user.team_id || user.teamId || null;
    const userId = user.id;

    // Check active or in-progress instance for this team/user (Section 33: Duplicate Protection)
    const allInstances = db.getInstances ? db.getInstances() : [];
    const altIds = [challenge.id, challenge._id ? String(challenge._id) : null, challenge.mission_id, cleanId].filter(Boolean);
    let existing = allInstances.find(i =>
      (altIds.includes(i.challengeId) || altIds.includes(i.challenge_id)) &&
      ((teamId && (i.teamId === teamId || i.team_id === teamId)) || (i.ownerUserId === userId || i.userId === userId || i.user_id === userId)) &&
      ['RUNNING', 'HEALTH_CHECKING', 'STARTING', 'ALLOCATING', 'REQUESTED'].includes(i.status)
    );

    if (existing) {
      // If already RUNNING, verify Docker container is genuinely running
      if (existing.status === 'RUNNING' && existing.containerId) {
        const inspect = await dockerManager.inspectContainer(existing.containerId).catch(() => null);
        if (inspect && inspect.State && inspect.State.Running) {
          const endpoints = instanceRouter.resolveEndpoints(existing.instanceId || existing.id, existing.port, challenge.protocol);
          return {
            success: true,
            instanceId: existing.instanceId || existing.id,
            status: existing.status,
            url: endpoints.url,
            port: existing.port,
            protocol: endpoints.protocol,
            ...endpoints,
            expiresAt: existing.expiresAt || existing.expires_at,
            timeRemainingSeconds: Math.max(0, Math.floor((new Date(existing.expiresAt || existing.expires_at) - Date.now()) / 1000)),
            message: 'Active sandbox already operational'
          };
        } else {
          // Dead container; neutralize old record and allow fresh creation
          console.warn(`[INSTANCE MANAGER] Existing instance ${existing.instanceId} found dead in Docker; neutralizing...`);
          existing.status = 'DESTROYED';
          if (existing.port) await portAllocator.release(existing.port).catch(() => {});
        }
      } else {
        // Transitional state: return current state
        const endpoints = instanceRouter.resolveEndpoints(existing.instanceId || existing.id, existing.port || 0, challenge.protocol);
        return {
          success: true,
          instanceId: existing.instanceId || existing.id,
          status: existing.status,
          url: existing.port ? endpoints.url : null,
          port: existing.port || null,
          protocol: endpoints.protocol,
          expiresAt: existing.expiresAt || existing.expires_at,
          message: 'Sandbox target is currently initializing'
        };
      }
    }

    // 1. Generate unique deterministic Instance ID
    const randomHex = crypto.randomBytes(3).toString('hex');
    const instanceId = `instance-${randomHex}`;

    // 2. Lifecycle: REQUESTED
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_REQUESTED || 'instance.requested', {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'REQUESTED'
    });

    auditService.record({
      action: 'INSTANCE.REQUESTED',
      category: 'INSTANCE',
      severity: 'INFO',
      actor: user,
      resource: { type: 'INSTANCE', id: instanceId, challengeId: challenge.id },
      result: 'SUCCESS',
      description: `Container sandbox requested for mission "${challenge.title}" (${instanceId})`,
      metadata: { instanceId, challengeId: challenge.id, teamId }
    }).catch(() => {});

    // 3. Lifecycle: ALLOCATING & PORT_RESERVED
    await realtimeService.broadcastInstanceEvent('instance.allocating', {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'ALLOCATING'
    });

    let allocatedPort;
    try {
      allocatedPort = await portAllocator.allocate(instanceId);
    } catch (err) {
      await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED || 'instance.failed', {
        instanceId,
        challengeId: challenge.id,
        teamId,
        status: 'FAILED',
        error: err.message
      });
      auditService.record({
        action: 'INSTANCE.START_FAILED',
        category: 'INSTANCE',
        severity: 'HIGH',
        actor: { type: 'SYSTEM', role: 'SYSTEM' },
        resource: { type: 'INSTANCE', id: instanceId, challengeId: challenge.id },
        result: 'FAILURE',
        description: `Port allocation failed for sandbox: ${err.message}`,
        metadata: { instanceId, challengeId: challenge.id, reason: 'PORT_ALLOCATION_FAILED' }
      }).catch(() => {});
      throw err;
    }

    auditService.record({
      action: 'INSTANCE.PORT_ALLOCATED',
      category: 'INSTANCE',
      severity: 'INFO',
      actor: { type: 'SYSTEM', role: 'SYSTEM' },
      resource: { type: 'INSTANCE', id: instanceId, challengeId: challenge.id },
      result: 'SUCCESS',
      description: `Atomic host port ${allocatedPort} allocated for instance ${instanceId}`,
      metadata: { instanceId, challengeId: challenge.id, port: allocatedPort }
    }).catch(() => {});

    await realtimeService.broadcastInstanceEvent('instance.port_reserved', {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'PORT_RESERVED',
      port: allocatedPort
    });

    // 4. Lifecycle: STARTING
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_STARTING || 'instance.starting', {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'STARTING',
      port: allocatedPort
    });

    // 5. Lifecycle: HEALTH_CHECKING & Real Docker Spawn
    await realtimeService.broadcastInstanceEvent('instance.health_checking', {
      instanceId,
      challengeId: challenge.id,
      teamId,
      status: 'HEALTH_CHECKING'
    });

    let containerInfo;
    let routedViaAgent = false;
    let assignedAgentId = null;

    // ── Routing decision: Local Docker vs. Remote Agent ───────────────────
    const localDockerAvailable = await dockerClient.isAvailable().catch(() => false);

    if (localDockerAvailable) {
      // Direct local Docker Engine path
      try {
        containerInfo = await dockerManager.spawnContainer({
          instanceId,
          challenge,
          hostPort: allocatedPort,
          teamId,
          userId
        });
      } catch (err) {
        // Failure rollback
        console.error(`[SPAWN ROLLBACK] Rolling back instance ${instanceId}:`, err.message);
        await portAllocator.release(allocatedPort).catch(() => {});
        const failedRecord = {
          id: instanceId, instanceId,
          challengeId: challenge.id, competitionId: challenge.competition_id || null,
          teamId, ownerUserId: userId, port: allocatedPort,
          status: 'FAILED', failureReason: err.message,
          createdAt: new Date().toISOString(), expiresAt: new Date().toISOString()
        };
        if (db.getInstances) db.getInstances().push(failedRecord);
        await db.persistDoc('instances', failedRecord).catch(() => {});
        await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED || 'instance.failed', {
          instanceId, challengeId: challenge.id, teamId, status: 'FAILED', error: err.message
        });
        throw err;
      }
    } else {
      // ── Remote Docker Agent path ─────────────────────────────────────────
      const agentManager = getAgentManager();
      assignedAgentId = agentManager ? agentManager.getBestAgent() : null;

      if (!assignedAgentId) {
        await portAllocator.release(allocatedPort).catch(() => {});
        const offlineErr = Object.assign(
          new Error('AGENT_OFFLINE: No Docker Agent is currently connected. Please start the XploitX Docker Agent on the host machine.'),
          { code: 'AGENT_OFFLINE', statusCode: 503 }
        );
        await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED || 'instance.failed', {
          instanceId, challengeId: challenge.id, teamId, status: 'FAILED',
          error: offlineErr.message, code: 'AGENT_OFFLINE'
        });
        throw offlineErr;
      }

      routedViaAgent = true;
      console.log(`[INSTANCE MANAGER] Routing instance ${instanceId} to agent ${assignedAgentId}`);

      try {
        // Send START_INSTANCE command to agent; agent responds with container info
        const agentResponse = await agentManager.sendCommand(assignedAgentId, 'START_INSTANCE', {
          instanceId,
          image: challenge.runtime?.image || challenge.docker_image,
          containerPort: challenge.runtime?.port || challenge.container_port || 80,
          hostPort: allocatedPort,
          protocol: challenge.protocol || 'http',
          ttlMinutes: challenge.runtime?.durationMinutes || challenge.instance_ttl_minutes || 30,
          resourceLimits: {
            memoryMb: challenge.runtime?.memoryMb || 256,
            cpuPercent: challenge.runtime?.cpuPercent || 50,
            pids: challenge.runtime?.pids || 64
          },
          labels: { challengeId: challenge.id, teamId: teamId || '', instanceId }
        }, 60_000);

        containerInfo = {
          containerId: agentResponse.containerId || instanceId,
          containerName: agentResponse.containerName || `xploitx-${instanceId}`,
          host: agentResponse.host || '127.0.0.1',
          port: agentResponse.port || allocatedPort,
          protocol: agentResponse.protocol || challenge.protocol || 'http',
          url: agentResponse.url || null,
          connectionCommand: agentResponse.connectionCommand || null
        };
      } catch (err) {
        await portAllocator.release(allocatedPort).catch(() => {});
        const failedRecord = {
          id: instanceId, instanceId,
          challengeId: challenge.id, competitionId: challenge.competition_id || null,
          teamId, ownerUserId: userId, port: allocatedPort,
          status: 'FAILED', failureReason: err.message,
          createdAt: new Date().toISOString(), expiresAt: new Date().toISOString()
        };
        if (db.getInstances) db.getInstances().push(failedRecord);
        await db.persistDoc('instances', failedRecord).catch(() => {});
        await realtimeService.broadcastInstanceEvent(Events.INSTANCE_FAILED || 'instance.failed', {
          instanceId, challengeId: challenge.id, teamId, status: 'FAILED', error: err.message
        });
        throw err;
      }
    }

    // 6. Record RUNNING Instance in MongoDB Atlas (Section 8)
    const ttlMinutes = challenge.runtime?.durationMinutes || challenge.instance_ttl_minutes || env.INSTANCE_DEFAULT_TTL_MINUTES || 30;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const endpoints = instanceRouter.resolveEndpoints(instanceId, allocatedPort, containerInfo.protocol);
    const canonicalChallengeId = challenge.id;
    const challengeObjectId = challenge._id ? String(challenge._id) : null;

    const instanceRecord = {
      instanceId,
      challengeId: canonicalChallengeId,
      challengeObjectId,
      competitionId: challenge.competition_id || null,
      teamId,
      ownerUserId: userId,
      containerId: containerInfo.containerId,
      containerName: containerInfo.containerName,
      host: endpoints.host,
      port: allocatedPort,
      protocol: containerInfo.protocol || 'http',
      status: 'RUNNING',
      image: containerInfo.image,
      containerPort: containerInfo.containerPort,
      url: endpoints.url,
      subdomain: endpoints.subdomain,
      connection_url: endpoints.url,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      expiresAt,
      lastHealthCheckAt: new Date().toISOString(),
      healthCheckStatus: 'HEALTHY',
      destroyedAt: null,

      // Compatibility aliases
      id: instanceId,
      challenge_id: canonicalChallengeId,
      team_id: teamId,
      user_id: userId,
      container_id: containerInfo.containerId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      lastHealthCheck: new Date().toISOString(),

      // Agent routing metadata
      metadata: {
        agentId: assignedAgentId || null,
        routedViaAgent,
        connectionCommand: containerInfo.connectionCommand || null
      }
    };

    if (db.getInstances) db.getInstances().push(instanceRecord);
    await db.persistDoc('instances', instanceRecord).catch(() => {});

    // 7. Broadcast RUNNING event
    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_STARTED || 'instance.running', {
      instanceId,
      challengeId: canonicalChallengeId,
      teamId,
      status: 'RUNNING',
      host: endpoints.host,
      port: allocatedPort,
      url: endpoints.url,
      protocol: containerInfo.protocol || 'http',
      expiresAt
    });

    auditService.record({
      action: 'INSTANCE.STARTED',
      category: 'INSTANCE',
      severity: 'INFO',
      actor: user,
      resource: { type: 'INSTANCE', id: instanceId, challengeId: canonicalChallengeId },
      result: 'SUCCESS',
      description: `Container sandbox is active and operational on port ${allocatedPort}`,
      metadata: { instanceId, challengeId: canonicalChallengeId, port: allocatedPort, status: 'RUNNING' }
    }).catch(() => {});

    return {
      success: true,
      instance: {
        id: instanceId,
        instanceId,
        challengeId: canonicalChallengeId,
        teamId,
        status: 'RUNNING',
        url: endpoints.url,
        port: allocatedPort,
        protocol: containerInfo.protocol || 'http',
        expiresAt,
        timeRemainingSeconds: ttlMinutes * 60
      },
      // Flat fields for backward compatibility
      instanceId,
      challengeId: canonicalChallengeId,
      teamId,
      status: 'RUNNING',
      url: endpoints.url,
      port: allocatedPort,
      protocol: containerInfo.protocol || 'http',
      ...endpoints,
      expiresAt,
      timeRemainingSeconds: ttlMinutes * 60,
      message: 'Containerized target successfully spawned'
    };
  }

  /**
   * Restart Instance (Section 18)
   * Preserves host port without reallocating, restarts the container, re-probes health,
   * resets TTL/expiry, and returns RUNNING state.
   */
  async restartInstance(challengeId, user) {
    if (!user) throw new Error('AUTH_REQUIRED: Authentication required to restart instance.');

    const teamId = user.team_id || user.teamId || null;
    const userId = user.id;

    const cleanId = String(challengeId).trim();
    const allChallenges = db.getChallenges ? db.getChallenges() : [];
    const challenge = allChallenges.find(c =>
      c.id === cleanId ||
      c.slug === cleanId ||
      c.mission_id === cleanId ||
      (c._id && String(c._id) === cleanId) ||
      (c.title && c.title.toLowerCase() === cleanId.toLowerCase())
    );
    const altIds = challenge ? [challenge.id, challenge._id ? String(challenge._id) : null, challenge.mission_id, cleanId].filter(Boolean) : [cleanId];

    // Find active instance for this challenge + team/user
    const allInstances = db.getInstances ? db.getInstances() : [];
    const activeInstance = allInstances.find(i =>
      (altIds.includes(i.challengeId) || altIds.includes(i.challenge_id)) &&
      (teamId ? (i.teamId === teamId || i.team_id === teamId) : (i.ownerUserId === userId || i.userId === userId || i.user_id === userId)) &&
      ['RUNNING', 'HEALTH_CHECKING', 'STARTING'].includes(i.status)
    );

    if (!activeInstance) {
      return this.spawnInstance(challengeId, user);
    }

    const healthPath = challenge?.runtime?.healthCheck?.path || challenge?.health_check_path || '/health';
    const ttlMinutes = challenge?.runtime?.durationMinutes || challenge?.instance_ttl_minutes || env.INSTANCE_DEFAULT_TTL_MINUTES || 30;

    // Restart container in Docker Engine
    if (activeInstance.containerId) {
      await dockerManager.restartContainer(activeInstance.containerId, activeInstance.port, healthPath);
    }

    // Reset expiry and refresh timestamps
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    activeInstance.status = 'RUNNING';
    activeInstance.expiresAt = expiresAt;
    activeInstance.expires_at = expiresAt;
    activeInstance.lastHealthCheckAt = new Date().toISOString();
    activeInstance.lastHealthCheck = activeInstance.lastHealthCheckAt;
    activeInstance.healthCheckStatus = 'HEALTHY';

    await db.persistDoc('instances', activeInstance).catch(() => {});

    await realtimeService.broadcastInstanceEvent('instance.restarted', {
      instanceId: activeInstance.instanceId || activeInstance.id,
      challengeId,
      teamId,
      status: 'RUNNING',
      port: activeInstance.port,
      url: activeInstance.url,
      expiresAt
    });

    const instId = activeInstance.instanceId || activeInstance.id;
    return {
      success: true,
      instance: {
        id: instId,
        instanceId: instId,
        status: 'RUNNING',
        url: activeInstance.url,
        port: activeInstance.port,
        protocol: activeInstance.protocol || 'http',
        expiresAt,
        timeRemainingSeconds: ttlMinutes * 60
      },
      instanceId: instId,
      id: instId,
      status: 'RUNNING',
      url: activeInstance.url,
      port: activeInstance.port,
      protocol: activeInstance.protocol || 'http',
      expiresAt,
      timeRemainingSeconds: ttlMinutes * 60,
      message: 'Instance restarted successfully'
    };
  }

  /**
   * Terminate Instance (Section 11)
   */
  async terminateInstance(targetId, user) {
    if (!user) throw new Error('AUTH_REQUIRED: Authentication required.');

    const teamId = user.team_id || user.teamId || null;
    const userId = user.id;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    const cleanTargetId = String(targetId).trim();
    const allChallenges = db.getChallenges ? db.getChallenges() : [];
    const matchedChallenge = allChallenges.find(c =>
      c.id === cleanTargetId ||
      c.slug === cleanTargetId ||
      c.mission_id === cleanTargetId ||
      (c._id && String(c._id) === cleanTargetId)
    );
    const targetIds = matchedChallenge
      ? [cleanTargetId, matchedChallenge.id, matchedChallenge._id ? String(matchedChallenge._id) : null, matchedChallenge.mission_id].filter(Boolean)
      : [cleanTargetId];

    const allInstances = db.getInstances ? db.getInstances() : [];
    const directMatch = allInstances.find(i => i.instanceId === cleanTargetId || i.id === cleanTargetId);
    if (directMatch && !isAdmin) {
      const isOwner = (teamId && (directMatch.teamId === teamId || directMatch.team_id === teamId)) ||
                      (userId && (directMatch.ownerUserId === userId || directMatch.userId === userId || directMatch.user_id === userId));
      if (!isOwner) {
        const err = new Error('FORBIDDEN: You do not have clearance to terminate another team or operative\'s instance.');
        err.statusCode = 403;
        throw err;
      }
    }

    const instance = allInstances.find(i =>
      (targetIds.includes(i.instanceId) || targetIds.includes(i.id) || targetIds.includes(i.challengeId) || targetIds.includes(i.challenge_id)) &&
      (isAdmin || (teamId && (i.teamId === teamId || i.team_id === teamId)) || (i.ownerUserId === userId || i.userId === userId || i.user_id === userId)) &&
      ['RUNNING', 'HEALTH_CHECKING', 'STARTING', 'ALLOCATING', 'PORT_RESERVED', 'REQUESTED', 'FAILED'].includes(i.status)
    );

    if (!instance) {
      throw new Error('NOT_FOUND: No active instance found for this mission under your authorization.');
    }

    const instId = instance.instanceId || instance.id;
    const challengeId = instance.challengeId || instance.challenge_id;

    // 1. Mark STOPPING
    instance.status = 'STOPPING';
    await db.persistDoc('instances', instance).catch(() => {});

    await realtimeService.broadcastInstanceEvent('instance.stopping', {
      instanceId: instId,
      challengeId,
      teamId: instance.teamId || instance.team_id,
      status: 'STOPPING'
    });

    // 2. Stop & remove Docker container
    const cId = instance.containerId || instance.container_id;
    if (cId) {
      await dockerManager.destroyContainer(cId);
    }

    // 3. Release port
    if (instance.port) {
      await portAllocator.release(instance.port);
    }

    // 4. Mark STOPPED
    instance.status = 'STOPPED';
    instance.destroyedAt = new Date().toISOString();
    instance.stoppedAt = new Date().toISOString();
    await db.persistDoc('instances', instance).catch(() => {});

    await realtimeService.broadcastInstanceEvent(Events.INSTANCE_DESTROYED || 'instance.stopped', {
      instanceId: instId,
      challengeId,
      teamId: instance.teamId || instance.team_id,
      status: 'STOPPED'
    });

    auditService.record({
      action: 'INSTANCE.STOPPED',
      category: 'INSTANCE',
      severity: 'INFO',
      actor: user,
      resource: { type: 'INSTANCE', id: instId, challengeId },
      result: 'SUCCESS',
      description: `Container sandbox neutralized and port ${instance.port} released`,
      metadata: { instanceId: instId, challengeId, port: instance.port }
    }).catch(() => {});

    return {
      success: true,
      message: 'Sandbox container neutralized and port released.'
    };
  }

  /**
   * Get Authoritative Status (Section 12)
   */
  async getAuthoritativeStatus(instanceIdOrChallengeId, user) {
    const teamId = user ? (user.team_id || user.teamId) : null;
    const userId = user ? user.id : null;
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

    const allInstances = db.getInstances ? db.getInstances() : [];
    const directMatch = allInstances.find(i => i.instanceId === instanceIdOrChallengeId || i.id === instanceIdOrChallengeId);
    if (directMatch && !isAdmin) {
      const isOwner = (teamId && (directMatch.teamId === teamId || directMatch.team_id === teamId)) ||
                      (userId && (directMatch.ownerUserId === userId || directMatch.userId === userId || directMatch.user_id === userId));
      if (!isOwner) {
        const err = new Error('FORBIDDEN: You do not have clearance to inspect another team or operative\'s instance.');
        err.statusCode = 403;
        throw err;
      }
    }

    const inst = allInstances.find(i =>
      (i.instanceId === instanceIdOrChallengeId || i.id === instanceIdOrChallengeId || i.challengeId === instanceIdOrChallengeId || i.challenge_id === instanceIdOrChallengeId) &&
      (isAdmin || (teamId && (i.teamId === teamId || i.team_id === teamId)) || (userId && (i.ownerUserId === userId || i.userId === userId || i.user_id === userId)))
    );

    if (!inst) return null;

    // If marked RUNNING, reconcile with live Docker Engine
    if (inst.status === 'RUNNING' && inst.containerId) {
      const inspect = await dockerManager.inspectContainer(inst.containerId).catch(() => null);
      if (!inspect || !inspect.State || !inspect.State.Running) {
        console.warn(`[STATUS RECONCILE] Instance ${inst.instanceId} found dead in Docker. Reconciling to DESTROYED.`);
        inst.status = 'DESTROYED';
        inst.destroyedAt = new Date().toISOString();
        if (inst.port) await portAllocator.release(inst.port).catch(() => {});
        await db.persistDoc('instances', inst).catch(() => {});
      }
    }

    const endpoints = instanceRouter.resolveEndpoints(inst.instanceId || inst.id, inst.port, inst.protocol);
    const expiresAtMs = new Date(inst.expiresAt || inst.expires_at).getTime();

    return {
      id: inst.instanceId || inst.id,
      instanceId: inst.instanceId || inst.id,
      challengeId: inst.challengeId || inst.challenge_id,
      status: inst.status,
      port: inst.port,
      protocol: inst.protocol || 'http',
      url: endpoints.url,
      ...endpoints,
      expiresAt: inst.expiresAt || inst.expires_at,
      timeRemainingSeconds: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
    };
  }

  getActiveInstance(challengeId, user) {
    const teamId = user ? (user.team_id || user.teamId) : null;
    const userId = user ? user.id : null;

    const allInstances = db.getInstances ? db.getInstances() : [];
    const inst = allInstances.find(i =>
      (i.challengeId === challengeId || i.challenge_id === challengeId) &&
      ((teamId && (i.teamId === teamId || i.team_id === teamId)) || (userId && (i.ownerUserId === userId || i.userId === userId || i.user_id === userId))) &&
      i.status === 'RUNNING'
    );

    if (!inst) return null;

    const endpoints = instanceRouter.resolveEndpoints(inst.instanceId || inst.id, inst.port, inst.protocol);
    return {
      id: inst.instanceId || inst.id,
      instanceId: inst.instanceId || inst.id,
      status: inst.status,
      ...endpoints,
      expiresAt: inst.expiresAt || inst.expires_at,
      timeRemainingSeconds: Math.max(0, Math.floor((new Date(inst.expiresAt || inst.expires_at) - Date.now()) / 1000))
    };
  }

  getAllInstances() {
    const challenges = db.getChallenges ? db.getChallenges() : [];
    const teams = db.getTeams ? db.getTeams() : [];
    const allInstances = db.getInstances ? db.getInstances() : [];

    return allInstances.map(i => {
      const ch = challenges.find(c => c.id === (i.challengeId || i.challenge_id));
      const tm = teams.find(t => t.id === (i.teamId || i.team_id));
      const endpoints = instanceRouter.resolveEndpoints(i.instanceId || i.id, i.port, i.protocol);

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
