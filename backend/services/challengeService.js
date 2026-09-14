/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Management Service (backend/services/challengeService.js)
 */

const db = require('../config/database');
const scoringService = require('./scoringService');
const realtimeService = require('./realtimeService');

class ChallengeService {
  _resolveCategory(identifier, explicitId) {
    const categories = db.getCategories();
    if (explicitId) {
      const found = categories.find(cat => cat.id === explicitId);
      if (found) return found;
    }
    if (!identifier) return categories[0] || null;

    const raw = String(identifier).trim();
    // Direct exact match
    let found = categories.find(cat => cat.id === raw || cat.name === raw || cat.slug === raw);
    if (found) return found;

    // Normalized alphanumeric match
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    found = categories.find(cat => {
      const nClean = (cat.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sClean = (cat.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const iClean = (cat.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return nClean === clean || sClean === clean || iClean === clean;
    });
    if (found) return found;

    // Fuzzy keyword matching for the 8 sectors
    if (clean.includes('forensic') || clean === 'df' || clean === 'dfir') {
      return categories.find(c => c.slug === 'forensic') || categories.find(c => c.name.toLowerCase().includes('forensic'));
    }
    if (clean.includes('steg')) {
      return categories.find(c => c.slug === 'stegano') || categories.find(c => c.name.toLowerCase().includes('stegan'));
    }
    if (clean.includes('crypt') || clean === 'cipher') {
      return categories.find(c => c.slug === 'crypto') || categories.find(c => c.name.toLowerCase().includes('crypto'));
    }
    if (clean.includes('network') || clean === 'net' || clean === 'pcap') {
      return categories.find(c => c.slug === 'network') || categories.find(c => c.name.toLowerCase().includes('network'));
    }
    if (clean.includes('pwn') || clean.includes('binary') || clean === 'binex') {
      return categories.find(c => c.slug === 'pwn') || categories.find(c => c.name.toLowerCase().includes('pwn'));
    }
    if (clean.includes('web') || clean.includes('http') || clean === 'websec') {
      return categories.find(c => c.slug === 'web') || categories.find(c => c.name.toLowerCase().includes('web'));
    }
    if (clean.includes('osint') || clean.includes('intel') || clean === 'recon') {
      return categories.find(c => c.slug === 'osint') || categories.find(c => c.name.toLowerCase().includes('osint'));
    }
    if (clean.includes('misc') || clean.includes('trivia')) {
      return categories.find(c => c.slug === 'misc') || categories.find(c => c.name.toLowerCase().includes('misc'));
    }

    // Partial substring fallback
    found = categories.find(cat => {
      const nClean = (cat.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return nClean.includes(clean) || clean.includes(nClean);
    });
    return found || categories.find(c => c.slug === 'misc') || categories[0] || null;
  }

  getAllPublicChallenges(user) {
    const challenges = db.getChallenges().filter(c => c.status === 'PUBLISHED' || c.status === 'LIVE');
    const categories = db.getCategories();
    const solves = db.getSolves();
    const teamId = user ? user.team_id : null;
    const userId = user ? user.id : null;

    return challenges.map(c => {
      let category = categories.find(cat => cat.id === c.category_id);
      if (!category && (c.category_name || c.category)) {
        category = this._resolveCategory(c.category_name || c.category, c.category_id);
      }
      const isSolved = solves.some(s => s.challenge_id === c.id && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId)));
      const hasInst = !!(c.requiresInstance || c.has_instance || c.runtime?.enabled);

      const canonicalId = c.id || (c._id ? String(c._id) : c.slug);
      return {
        id: canonicalId,
        _id: c._id ? String(c._id) : canonicalId,
        mission_id: c.mission_id,
        slug: c.slug,
        title: c.title,
        category: category ? category.name : (c.category_name || c.category || 'Misc'),
        category_slug: category ? category.slug : 'misc',
        category_color: category ? category.color_accent : '#00ff9c',
        difficulty: c.difficulty,
        points: c.current_points || c.base_points,
        solve_count: c.solve_count || 0,
        has_instance: hasInst,
        requiresInstance: hasInst,
        is_solved: isSolved
      };
    });
  }

  getChallengeDetails(challengeId, user) {
    if (!challengeId) return null;
    const cleanId = String(challengeId).trim();
    const cleanIdLower = cleanId.toLowerCase();

    // 1. Search in-memory cache first (by id, _id, mission_id, slug, or title - case-insensitive)
    const c = db.getChallenges().find(item => {
      if (!item) return false;
      const itemId = item.id ? String(item.id).trim() : '';
      const itemMongoId = item._id ? String(item._id).trim() : '';
      const itemMissionId = item.mission_id ? String(item.mission_id).trim() : '';
      const itemSlug = item.slug ? String(item.slug).trim() : '';
      const itemTitle = item.title ? String(item.title).trim() : '';

      return itemId === cleanId ||
        itemMongoId === cleanId ||
        itemMissionId === cleanId ||
        itemSlug === cleanId ||
        itemId.toLowerCase() === cleanIdLower ||
        itemMongoId.toLowerCase() === cleanIdLower ||
        itemMissionId.toLowerCase() === cleanIdLower ||
        itemSlug.toLowerCase() === cleanIdLower ||
        itemTitle.toLowerCase() === cleanIdLower;
    });

    if (!c) return null;

    // Check if mission is draft and operative is not admin (in production)
    if (c.status === 'DRAFT' && (!user || user.role !== 'ADMIN') && process.env.NODE_ENV === 'production') {
      return null;
    }

    const categories = db.getCategories();
    let category = categories.find(cat => cat.id === c.category_id);
    if (!category && (c.category_name || c.category)) {
      category = this._resolveCategory(c.category_name || c.category, c.category_id);
    }

    const altIds = [c.id, c._id ? String(c._id) : null, c.mission_id].filter(Boolean);
    const files = db.getFiles().filter(f =>
      altIds.includes(f.challenge_id) || altIds.includes(f.challengeId)
    ).map(f => ({
      id: f.id,
      name: f.filename,
      filename: f.filename,
      size: f.file_size_bytes || f.size,
      sizeBytes: f.file_size_bytes || f.size,
      mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
      sha256: f.sha256,
      downloadUrl: `/api/v1/challenges/${c.id || c._id}/files/${f.id}/download`,
      uploadedAt: f.uploaded_at || f.uploadedAt
    }));

    const teamId = user ? (user.team_id || (user.team && user.team.id)) : null;
    const userId = user ? user.id : null;

    // Hints mask/unmask based on team/user hint_reveals
    const hintReveals = db.getHintReveals().filter(r => (teamId && r.team_id === teamId) || (userId && r.user_id === userId));
    const unlockedHintIds = new Set(hintReveals.map(r => r.hint_id));

    const hints = db.getHints().filter(h => altIds.includes(h.challenge_id) && h.enabled).map((h, index) => {
      const isUnlocked = unlockedHintIds.has(h.id) || h.cost === 0;
      return {
        id: h.id,
        index: index + 1,
        cost: h.cost,
        content: isUnlocked ? h.content : null,
        isUnlocked
      };
    });

    const isSolved = db.getSolves().some(s =>
      altIds.includes(s.challenge_id) && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId))
    );

    const instance = db.getInstances().find(i =>
      (altIds.includes(i.challengeId) || altIds.includes(i.challenge_id)) &&
      ((teamId && (i.teamId === teamId || i.team_id === teamId)) || (userId && (i.ownerUserId === userId || i.userId === userId || i.user_id === userId))) &&
      i.status === 'RUNNING'
    );

    const requiresInstance = !!(c.requiresInstance || c.has_instance || c.runtime?.enabled);

    return {
      id: c.id,
      mission_id: c.mission_id,
      slug: c.slug,
      title: c.title,
      category: category ? category.name : (c.category_name || c.category || 'Misc'),
      category_color: category ? category.color_accent : '#00ff9c',
      difficulty: c.difficulty,
      points: c.current_points || c.base_points,
      solve_count: c.solve_count || 0,
      description: c.description,
      has_instance: requiresInstance,
      requiresInstance: requiresInstance,
      runtime: requiresInstance ? {
        enabled: true,
        protocol: c.runtime?.protocol || c.protocol || 'http',
        containerPort: c.runtime?.containerPort || c.container_port || 80,
        durationMinutes: c.runtime?.durationMinutes || c.instance_ttl_minutes || 30,
        healthCheck: c.runtime?.healthCheck || { type: 'http', path: c.health_check_path || '/' }
      } : { enabled: false },
      instance: instance ? {
        instanceId: instance.instanceId || instance.id,
        host: instance.host,
        port: instance.port,
        protocol: instance.protocol || 'http',
        status: instance.status,
        url: instance.url || `http://${instance.subdomain || instance.host || '127.0.0.1'}:${instance.port}`,
        subdomain: instance.subdomain,
        expiresAt: instance.expiresAt || instance.expires_at,
        expires_at: instance.expiresAt || instance.expires_at,
        timeRemainingSeconds: Math.max(0, Math.floor((new Date(instance.expiresAt || instance.expires_at) - Date.now()) / 1000))
      } : null,
      files,
      hints,
      is_solved: isSolved
    };
  }

  unlockHint(challengeId, hintId, user) {
    if (!user) throw new Error('Authentication required to unlock mission intelligence hints');
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) throw new Error('Challenge not found');

    const hint = db.getHints().find(h => h.id === hintId && h.challenge_id === challenge.id && h.enabled);
    if (!hint) throw new Error('Tactical hint not found or disabled');

    const teamId = user.team_id || (user.team && user.team.id);
    const userId = user.id;

    // Check if already revealed for this team or operative
    const alreadyRevealed = db.getHintReveals().some(r =>
      r.hint_id === hint.id && ((teamId && r.team_id === teamId) || r.user_id === userId)
    );

    if (alreadyRevealed) {
      return {
        id: hint.id,
        content: hint.content,
        cost: hint.cost,
        alreadyUnlocked: true
      };
    }

    // Deduct points from team score if cost > 0
    let team = null;
    if (teamId) {
      team = db.getTeams().find(t => t.id === teamId);
      if (team && hint.cost > 0) {
        team.total_score = Math.max(0, (team.total_score || 0) - hint.cost);
      }
    }

    // Persist score event
    if (hint.cost > 0) {
      const crypto = require('crypto');
      db.getScoreEvents().push({
        id: crypto.randomUUID(),
        team_id: teamId,
        delta: -hint.cost,
        resulting_score: team ? team.total_score : 0,
        reason: 'HINT_UNLOCK',
        challenge_id: challenge.id,
        created_at: new Date().toISOString()
      });
    }

    // Record hint reveal
    const crypto = require('crypto');
    db.getHintReveals().push({
      id: crypto.randomUUID(),
      hint_id: hint.id,
      challenge_id: challenge.id,
      team_id: teamId,
      user_id: userId,
      points_deducted: hint.cost,
      revealed_at: new Date().toISOString()
    });

    // Broadcast score change if points deducted
    if (hint.cost > 0 && teamId) {
      realtimeService.broadcastScoreboardUpdated({
        teamId,
        teamName: team ? team.name : user.username,
        pointsAwarded: -hint.cost,
        challengeTitle: challenge.title
      }).catch(e => console.error('[CHALLENGE SERVICE] Hint broadcast error:', e));
    }

    return {
      id: hint.id,
      content: hint.content,
      cost: hint.cost
    };
  }

  createChallenge(data) {
    const crypto = require('crypto');
    const id = data.id || `ch-${crypto.randomBytes(4).toString('hex')}`;
    const slug = (data.title || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Resolve matching category entity from db
    const category = this._resolveCategory(data.category || data.category_name, data.category_id);
    const category_id = category ? category.id : (db.getCategories()[0]?.id || 'cat-01');
    const category_name = category ? category.name : (data.category || data.category_name || 'Misc');

    // Generate unique non-colliding mission_id
    let mission_id = (data.mission_id || '').trim();
    if (!mission_id) {
      const catPrefix = (category ? category.name.replace(/[^A-Za-z]/g, '').slice(0, 4) : 'SEC').toUpperCase();
      const randHex = crypto.randomBytes(2).toString('hex').toUpperCase();
      mission_id = `OP-${catPrefix}-${randHex}`;
    }

    const hasInstance = !!(data.requiresInstance !== undefined ? data.requiresInstance : (data.has_instance || data.runtime?.enabled));
    const dockerImage = data.docker_image || data.runtime?.image || (hasInstance ? 'xploitx/vault:latest' : null);
    const containerPort = parseInt(data.container_port || data.runtime?.containerPort || 80, 10);
    const healthCheckPath = data.health_check_path || data.runtime?.healthCheck?.path || '/';
    const instanceTtlMinutes = parseInt(data.instance_ttl_minutes || data.runtime?.durationMinutes || 30, 10);
    const cpuLimit = parseFloat(data.cpu_limit || data.runtime?.resources?.cpus || 0.5);
    const memoryLimit = data.memory_limit || data.runtime?.resources?.memory || '256m';
    const pidsLimit = parseInt(data.pids_limit || data.runtime?.resources?.pidsLimit || 128, 10);

    const newChallenge = {
      id,
      competition_id: db.getCompetitions()[0]?.id || 'c0000000-0000-0000-0000-000000000001',
      category_id,
      category_name,
      mission_id,
      slug,
      title: data.title,
      description: data.description || '',
      difficulty: (data.difficulty || 'MEDIUM').toUpperCase(),
      base_points: parseInt(data.points || data.base_points || 500, 10),
      minimum_points: parseInt(data.minimum_points || 100, 10),
      decay_threshold: parseInt(data.decay_threshold || 30, 10),
      current_points: parseInt(data.points || data.current_points || data.base_points || 500, 10),
      solve_count: 0,
      status: (data.status || 'PUBLISHED').toUpperCase(),
      has_instance: hasInstance,
      requiresInstance: hasInstance,
      docker_image: dockerImage,
      container_port: containerPort,
      health_check_path: healthCheckPath,
      instance_ttl_minutes: instanceTtlMinutes,
      cpu_limit: cpuLimit,
      memory_limit: memoryLimit,
      runtime: hasInstance ? {
        enabled: true,
        image: dockerImage,
        containerPort,
        protocol: data.runtime?.protocol || data.protocol || 'http',
        healthCheck: { type: 'http', path: healthCheckPath },
        resources: { cpus: cpuLimit, memory: memoryLimit, pidsLimit },
        durationMinutes: instanceTtlMinutes
      } : { enabled: false },
      instance_host: data.instance_host || null,
      instance_port: data.instance_port || null,
      created_at: new Date().toISOString()
    };

    db.getChallenges().push(newChallenge);

    // Save Flag
    if (data.flag) {
      db.getFlags().push({
        id: `f-${Date.now()}`,
        challenge_id: id,
        flag_type: data.flag_type || 'STATIC',
        flag_value: data.flag.trim(),
        case_sensitive: data.case_sensitive !== false
      });
    }

    // Save Hint
    if (data.hint) {
      db.getHints().push({
        id: `h-${Date.now()}`,
        challenge_id: id,
        content: data.hint,
        cost: parseInt(data.hint_cost || 50, 10),
        order_index: 1,
        enabled: true
      });
    }

    // Record audit log
    db.getAuditLogs().push({
      id: `aud-${Date.now()}`,
      action: 'CHALLENGE_CREATED',
      target: newChallenge.title,
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString()
    });

    // Real-time notification
    realtimeService.broadcastChallengeCreated(newChallenge.id, newChallenge.competition_id)
      .catch(e => console.error('[CHALLENGE SERVICE] Broadcast created error:', e));

    return newChallenge;
  }

  updateChallenge(id, data) {
    const cleanId = String(id).trim();
    const cleanIdLower = cleanId.toLowerCase();
    const c = db.getChallenges().find(item =>
      item.id === cleanId ||
      item.slug === cleanId ||
      item.mission_id === cleanId ||
      (item.id && item.id.toLowerCase() === cleanIdLower) ||
      (item.slug && item.slug.toLowerCase() === cleanIdLower) ||
      (item.mission_id && item.mission_id.toLowerCase() === cleanIdLower)
    );
    if (!c) throw new Error('Challenge not found');

    if (data.title) {
      c.title = data.title;
      c.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    if (data.description) c.description = data.description;
    if (data.difficulty) c.difficulty = data.difficulty.toUpperCase();
    if (data.category || data.category_name || data.category_id) {
      const catVal = data.category || data.category_name;
      const matched = this._resolveCategory(catVal, data.category_id);
      if (matched) {
        c.category_id = matched.id;
        c.category_name = matched.name;
      } else if (catVal) {
        c.category_name = catVal;
      }
    }
    if (data.points) c.current_points = parseInt(data.points, 10);
    if (data.minimum_points) c.minimum_points = parseInt(data.minimum_points, 10);
    if (data.decay_threshold) c.decay_threshold = parseInt(data.decay_threshold, 10);
    
    if (data.requiresInstance !== undefined) {
      c.requiresInstance = !!data.requiresInstance;
      c.has_instance = !!data.requiresInstance;
    }
    if (data.has_instance !== undefined) {
      c.has_instance = !!data.has_instance;
      c.requiresInstance = !!data.has_instance;
    }
    if (data.docker_image !== undefined) c.docker_image = data.docker_image;
    if (data.container_port !== undefined) c.container_port = parseInt(data.container_port, 10);
    if (data.health_check_path !== undefined) c.health_check_path = data.health_check_path;
    if (data.instance_ttl_minutes !== undefined) c.instance_ttl_minutes = parseInt(data.instance_ttl_minutes, 10);
    if (data.cpu_limit !== undefined) c.cpu_limit = parseFloat(data.cpu_limit);
    if (data.memory_limit !== undefined) c.memory_limit = data.memory_limit;
    if (data.runtime) {
      c.runtime = data.runtime;
      if (data.runtime.enabled !== undefined) {
        c.has_instance = !!data.runtime.enabled;
        c.requiresInstance = !!data.runtime.enabled;
      }
      if (data.runtime.image) c.docker_image = data.runtime.image;
      if (data.runtime.containerPort) c.container_port = data.runtime.containerPort;
    }

    if (data.status) {
      const targetStatus = data.status.toUpperCase();
      if (targetStatus === 'PUBLISHED' || targetStatus === 'LIVE') {
        const check = this.validateChallengeForPublish(c);
        if (!check.valid) {
          throw new Error(`PRE_PUBLISH_VALIDATION_FAILED: ${check.errors.join('; ')}`);
        }
      }
      c.status = targetStatus;
    }

    if (data.flag) {
      const fl = db.getFlags().find(f => f.challenge_id === c.id);
      if (fl) {
        fl.flag_value = data.flag.trim();
      } else {
        db.getFlags().push({
          id: `f-${Date.now()}`,
          challenge_id: c.id,
          flag_type: 'STATIC',
          flag_value: data.flag.trim(),
          case_sensitive: true
        });
      }
    }

    // Real-time notification
    realtimeService.broadcastChallengeUpdated(c.id, c.competition_id)
      .catch(e => console.error('[CHALLENGE SERVICE] Broadcast updated error:', e));

    return c;
  }

  deleteChallenge(id) {
    const idx = db.getChallenges().findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Challenge not found');
    const compId = db.getChallenges()[idx].competition_id;
    db.getChallenges().splice(idx, 1);

    // Real-time notification
    realtimeService.broadcastChallengeDeleted(id, compId)
      .catch(e => console.error('[CHALLENGE SERVICE] Broadcast deleted error:', e));

    return true;
  }

  /**
   * Challenge Pre-Publishing Validation (Section 12)
   */
  validateChallengeForPublish(c) {
    const errors = [];
    if (!c.title || !c.title.trim()) errors.push('Mission title is required');
    if (!c.slug || !c.slug.trim()) errors.push('URL slug identifier is required');
    if (!c.category_id && !c.category_name) errors.push('Category specification is required');
    if (!c.description || !c.description.trim()) errors.push('Operational briefing/description is required');
    if (!['EASY', 'MEDIUM', 'HARD', 'INSANE'].includes((c.difficulty || '').toUpperCase())) {
      errors.push('Valid difficulty level (EASY, MEDIUM, HARD, INSANE) is required');
    }
    const points = c.base_points || c.current_points || c.points;
    if (!points || points <= 0) errors.push('Base point reward must be greater than 0');
    if (c.minimum_points && c.minimum_points > points) {
      errors.push('Floor points cannot exceed base points');
    }

    // Check flag presence
    const flags = db.getFlags().filter(f => f.challenge_id === c.id);
    if (flags.length === 0) {
      errors.push('At least one valid flag configuration is required before publishing');
    }

    // Check instance configuration if applicable
    if (c.has_instance) {
      if (!c.docker_image || !c.docker_image.trim()) {
        errors.push('Docker container image is required for sandbox-enabled missions');
      }
      if (!c.container_port || c.container_port <= 0 || c.container_port > 65535) {
        errors.push('Valid container port (1-65535) is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ChallengeService();
