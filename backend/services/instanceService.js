/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Container Instance Service (backend/services/instanceService.js)
 */

const db = require('../config/database');

class InstanceService {
  deployInstance(challengeId, user) {
    const challenge = db.getChallenges().find(c => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found');
    if (!challenge.has_instance) throw new Error('Mission does not require a dynamic container target');

    const teamId = user.team_id || null;
    const userId = user.id;

    // Check if an instance already exists for this team/user
    let instance = db.getInstances().find(i =>
      i.challenge_id === challenge.id &&
      ((teamId && i.team_id === teamId) || i.user_id === userId) &&
      i.status === 'RUNNING'
    );

    if (instance) {
      return {
        instanceId: instance.id,
        host: instance.host,
        port: instance.port,
        expiresAt: instance.expires_at,
        message: 'Active sandbox already running'
      };
    }

    // Allocate random port between 30000 and 45000
    const allocatedPort = Math.floor(30000 + Math.random() * 15000);
    const ttlMinutes = challenge.instance_ttl_minutes || 30;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    instance = {
      id: `inst-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      challenge_id: challenge.id,
      team_id: teamId,
      user_id: userId,
      container_id: `docker-${Math.random().toString(36).substr(2, 10)}`,
      host: 'challenge.xploitxctf.me',
      port: allocatedPort,
      status: 'RUNNING',
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    db.getInstances().push(instance);

    return {
      instanceId: instance.id,
      host: instance.host,
      port: instance.port,
      expiresAt: instance.expires_at,
      message: 'Containerized target successfully spawned'
    };
  }

  terminateInstance(challengeId, user) {
    const teamId = user.team_id || null;
    const instance = db.getInstances().find(i =>
      i.challenge_id === challengeId &&
      ((teamId && i.team_id === teamId) || i.user_id === user.id) &&
      i.status === 'RUNNING'
    );

    if (instance) {
      instance.status = 'TERMINATED';
    }

    return { success: true, message: 'Container destroyed' };
  }

  getAllInstances() {
    return db.getInstances().map(inst => {
      const challenge = db.getChallenges().find(c => c.id === inst.challenge_id);
      const team = db.getTeams().find(t => t.id === inst.team_id);
      return {
        ...inst,
        challengeTitle: challenge ? challenge.title : 'Unknown Mission',
        teamName: team ? team.name : 'Solo Operative'
      };
    });
  }
}

module.exports = new InstanceService();
