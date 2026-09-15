/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Management Service (backend/services/challengeService.js)
 */

const db = require('../config/database');
const scoringService = require('./scoringService');
const realtimeService = require('./realtimeService');
const auditService = require('./auditService');
const {
  resolveDomainPrefix,
  getDomainName,
  isValidChallengeId,
  formatChallengeId,
  generatePublicRouteId,
  allocateNextSequence
} = require('../utils/challengeIdentity');

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
    if (clean.includes('reverse') || clean.includes('rev') || clean === 're' || clean === 'reversing') {
      return categories.find(c => c.slug === 'reverse') || categories.find(c => c.name.toLowerCase().includes('reverse')) || { id: 'cat-rev', name: 'Reverse Engineering', slug: 'reverse' };
    }
    if (clean.includes('malware') || clean.includes('mal')) {
      return categories.find(c => c.slug === 'malware') || categories.find(c => c.name.toLowerCase().includes('malware')) || { id: 'cat-mal', name: 'Malware Analysis', slug: 'malware' };
    }
    if (clean.includes('vapt') || clean.includes('vap') || clean.includes('securecode') || clean.includes('secure code')) {
      return categories.find(c => c.slug === 'vapt') || categories.find(c => c.name.toLowerCase().includes('vapt')) || { id: 'cat-vap', name: 'Secure Code / VAPT', slug: 'vapt' };
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
      const isSolved = solves.some(s => (s.challenge_id === c.id || s.challenge_id === c.challengeId || (c._id && s.challenge_id === String(c._id))) && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId)));
      const hasInst = !!(c.requiresInstance || c.has_instance || c.runtime?.enabled);
      const challengeDisplayId = c.challengeId || c.id;

      return {
        id: challengeDisplayId,
        challengeId: challengeDisplayId,
        publicRouteId: c.publicRouteId,
        competitionId: c.competitionId || c.competition_id || 'XPLOITX-2026',
        domain: c.domain || (category ? category.name : (c.category_name || 'Misc')),
        mission_id: challengeDisplayId,
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

    // 1. Search in-memory cache by publicRouteId, challengeId, id, _id, mission_id, slug, or title
    const c = db.getChallenges().find(item => {
      if (!item) return false;
      const itemId = item.id ? String(item.id).trim() : '';
      const itemChallengeId = item.challengeId ? String(item.challengeId).trim() : '';
      const itemPublicRouteId = item.publicRouteId ? String(item.publicRouteId).trim() : '';
      const itemMongoId = item._id ? String(item._id).trim() : '';
      const itemMissionId = item.mission_id ? String(item.mission_id).trim() : '';
      const itemSlug = item.slug ? String(item.slug).trim() : '';
      const itemTitle = item.title ? String(item.title).trim() : '';

      return itemPublicRouteId === cleanId ||
        itemChallengeId === cleanId ||
        itemId === cleanId ||
        itemMongoId === cleanId ||
        itemMissionId === cleanId ||
        itemSlug === cleanId ||
        itemPublicRouteId.toLowerCase() === cleanIdLower ||
        itemChallengeId.toLowerCase() === cleanIdLower ||
        itemId.toLowerCase() === cleanIdLower ||
        itemMongoId.toLowerCase() === cleanIdLower ||
        itemMissionId.toLowerCase() === cleanIdLower ||
        itemSlug.toLowerCase() === cleanIdLower ||
        itemTitle.toLowerCase() === cleanIdLower;
    });

    if (!c) return null;

    // Check if mission is draft/unpublished and operative is not admin
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
    if ((c.status === 'DRAFT' || (c.status !== 'PUBLISHED' && c.status !== 'LIVE')) && !isAdmin) {
      return null;
    }

    const categories = db.getCategories();
    let category = categories.find(cat => cat.id === c.category_id);
    if (!category && (c.category_name || c.category)) {
      category = this._resolveCategory(c.category_name || c.category, c.category_id);
    }

    const publicId = c.challengeId || c.id;
    const publicRoute = c.publicRouteId || publicId;
    const altIds = [
      c.id ? String(c.id).trim() : null,
      c.challengeId ? String(c.challengeId).trim() : null,
      c.publicRouteId ? String(c.publicRouteId).trim() : null,
      c._id ? String(c._id).trim() : null,
      c.mission_id ? String(c.mission_id).trim() : null,
      c.slug ? String(c.slug).trim() : null,
      publicId
    ].filter(Boolean);

    // Merge registered files from db.getFiles() and challenge.files array
    const registeredFiles = db.getFiles().filter(f => {
      const fCId = f.challenge_id ? String(f.challenge_id).trim() : '';
      const fAltCId = f.challengeId ? String(f.challengeId).trim() : '';
      return altIds.includes(fCId) || altIds.includes(fAltCId);
    });

    const fileMap = new Map();
    for (const f of registeredFiles) {
      fileMap.set(f.id, {
        id: f.id,
        name: f.filename || f.name,
        filename: f.filename || f.name,
        size: f.file_size_bytes || f.size || 0,
        sizeBytes: f.file_size_bytes || f.size || 0,
        mimeType: f.mime_type || f.mimeType || 'application/octet-stream',
        sha256: f.sha256 || null,
        downloadUrl: `/api/v1/challenges/${publicId}/files/${f.id}/download`,
        uploadedAt: f.uploaded_at || f.uploadedAt || new Date().toISOString()
      });
    }

    const embeddedFiles = Array.isArray(c.files) ? c.files : [];
    for (const ef of embeddedFiles) {
      const fId = ef.id || ef.fileId;
      if (fId && !fileMap.has(fId)) {
        fileMap.set(fId, {
          id: fId,
          name: ef.originalName || ef.filename || ef.name,
          filename: ef.filename || ef.originalName || ef.name,
          size: ef.size || ef.file_size_bytes || 0,
          sizeBytes: ef.size || ef.file_size_bytes || 0,
          mimeType: ef.mimeType || ef.mime_type || 'application/octet-stream',
          sha256: ef.sha256 || null,
          downloadUrl: `/api/v1/challenges/${publicId}/files/${fId}/download`,
          uploadedAt: ef.uploadedAt || ef.uploaded_at || new Date().toISOString()
        });
      }
    }

    const files = Array.from(fileMap.values());

    const teamId = user ? (user.team_id || (user.team && user.team.id)) : null;
    const userId = user ? user.id : null;

    // Hints mask/unmask based on team/user hint_reveals
    const hintReveals = db.getHintReveals().filter(r => (teamId && r.team_id === teamId) || (userId && r.user_id === userId));
    const unlockedHintIds = new Set(hintReveals.map(r => r.hint_id));

    const hints = db.getHints().filter(h => altIds.includes(String(h.challenge_id).trim()) && h.enabled).map((h, index) => {
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
      altIds.includes(String(s.challenge_id).trim()) && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId))
    );

    const instance = db.getInstances().find(i =>
      (altIds.includes(String(i.challengeId || '').trim()) || altIds.includes(String(i.challenge_id || '').trim())) &&
      ((teamId && (i.teamId === teamId || i.team_id === teamId)) || (userId && (i.ownerUserId === userId || i.userId === userId || i.user_id === userId))) &&
      i.status === 'RUNNING'
    );

    const requiresInstance = !!(c.requiresInstance || c.has_instance || c.runtime?.enabled);

    return {
      id: publicId,
      challengeId: publicId,
      publicRouteId: c.publicRouteId,
      domain: c.domain || (category ? category.name : (c.category_name || 'Misc')),
      competitionId: c.competitionId || c.competition_id || 'XPLOITX-2026',
      _id: (isAdmin && c._id) ? String(c._id) : undefined,
      mission_id: publicId,
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

    auditService.record({
      action: 'HINT.UNLOCKED',
      category: 'HINT',
      severity: 'INFO',
      actor: user,
      resource: { type: 'HINT', id: hint.id, challengeId: challenge.id },
      result: 'SUCCESS',
      description: `Intelligence hint unlocked for mission "${challenge.title}" (-${hint.cost} XP)`,
      metadata: { challengeId: challenge.id, hintId: hint.id, cost: hint.cost, teamId }
    }).catch(() => {});

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
    let _id = data._id ? String(data._id).trim() : null;
    if (!_id) {
      try {
        const { ObjectId } = require('mongodb');
        _id = new ObjectId().toString();
      } catch (_) {
        _id = crypto.randomBytes(12).toString('hex');
      }
    }
    const slug = (data.title || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // 1. Resolve matching category & domain
    const category = this._resolveCategory(data.category || data.category_name, data.category_id);
    const category_id = category ? category.id : (db.getCategories()[0]?.id || 'cat-01');
    const category_name = category ? category.name : (data.category || data.category_name || 'Misc');

    // 2. Resolve domain prefix and domain name
    const domainPrefix = resolveDomainPrefix(data.domain || data.category || data.category_name || (category ? category.name : 'Misc'));
    const domainName = getDomainName(domainPrefix);

    // 3. Allocate atomic domain-isolated sequence and format Challenge ID
    // Format: <DOMAIN>-<SERIAL>-<CHALLENGE>-<SEQUENCE>, e.g. CRY-000000-00000-C001
    const allChallenges = db.getChallenges();
    const nextSeq = allocateNextSequence(domainPrefix, allChallenges);
    const challengeId = formatChallengeId(domainPrefix, nextSeq);

    // 4. Server-Side Cryptographically Secure / HMAC Opaque Public Route ID
    const existingRouteIds = new Set(allChallenges.map(c => c.publicRouteId).filter(Boolean));
    const publicRouteId = generatePublicRouteId(challengeId, existingRouteIds);

    // 5. Competition ID
    const competitionId = data.competitionId || data.competition_id || db.getCompetitions()[0]?.id || 'XPLOITX-2026';

    const mission_id = challengeId;

    const hasInstance = !!(data.requiresInstance !== undefined ? data.requiresInstance : (data.has_instance || data.runtime?.enabled));
    const dockerImage = data.docker_image || data.runtime?.image || (hasInstance ? 'xploitx/vault:latest' : null);
    const containerPort = parseInt(data.container_port || data.runtime?.containerPort || 80, 10);
    const healthCheckPath = data.health_check_path || data.runtime?.healthCheck?.path || '/';
    const instanceTtlMinutes = parseInt(data.instance_ttl_minutes || data.runtime?.durationMinutes || 30, 10);
    const cpuLimit = parseFloat(data.cpu_limit || data.runtime?.resources?.cpus || 0.5);
    const memoryLimit = data.memory_limit || data.runtime?.resources?.memory || '256m';
    const pidsLimit = parseInt(data.pids_limit || data.runtime?.resources?.pidsLimit || 128, 10);

    const newChallenge = {
      id: challengeId,
      challengeId,
      publicRouteId,
      domain: domainName,
      competitionId,
      competition_id: competitionId,
      _id,
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
      hints: [],
      files: [],
      created_at: new Date().toISOString()
    };

    db.getChallenges().push(newChallenge);

    // Save Flag
    if (data.flag) {
      const flagRec = {
        id: `f-${Date.now()}`,
        challenge_id: newChallenge.id,
        flag_type: data.flag_type || 'STATIC',
        flag_value: data.flag.trim(),
        case_sensitive: data.case_sensitive !== false
      };
      db.getFlags().push(flagRec);
      if (db.isMongo && db.persistDoc) {
        db.persistDoc('flags', flagRec).catch(() => {});
      }
    }

    // Save Hint
    if (data.hint) {
      const hintRec = {
        id: `h-${Date.now()}`,
        challenge_id: newChallenge.id,
        content: data.hint,
        cost: parseInt(data.hint_cost || 50, 10),
        order_index: 1,
        enabled: true
      };
      db.getHints().push(hintRec);
      if (db.isMongo && db.persistDoc) {
        db.persistDoc('challengeHints', hintRec).catch(() => {});
      }
    }

    // Record audit log
    auditService.record({
      action: 'CHALLENGE.CREATED',
      category: 'CHALLENGE',
      severity: 'INFO',
      actor: { type: 'USER', username: 'ADMIN', role: 'ADMIN' },
      resource: { type: 'CHALLENGE', id: newChallenge.id, challengeId: newChallenge.id },
      result: 'SUCCESS',
      description: `Challenge mission "${newChallenge.title}" commissioned (${newChallenge.id})`,
      metadata: { challengeId: newChallenge.id, title: newChallenge.title, category: newChallenge.category_name, points: newChallenge.base_points }
    }).catch(() => {});

    if (db.isMongo && db.persistDoc) {
      db.persistDoc('challenges', newChallenge).catch(() => {});
    }

    // Real-time notification
    realtimeService.broadcastChallengeCreated(newChallenge.id, newChallenge.competition_id)
      .catch(e => console.error('[CHALLENGE SERVICE] Broadcast created error:', e));

    return newChallenge;
  }

  updateChallenge(id, data) {
    const cleanId = String(id).trim();
    const cleanIdLower = cleanId.toLowerCase();
    const c = db.getChallenges().find(item =>
      item.publicRouteId === cleanId ||
      item.challengeId === cleanId ||
      item.id === cleanId ||
      item.slug === cleanId ||
      item.mission_id === cleanId ||
      (item._id && String(item._id) === cleanId) ||
      (item.publicRouteId && item.publicRouteId.toLowerCase() === cleanIdLower) ||
      (item.challengeId && item.challengeId.toLowerCase() === cleanIdLower) ||
      (item.id && item.id.toLowerCase() === cleanIdLower) ||
      (item.slug && item.slug.toLowerCase() === cleanIdLower) ||
      (item.mission_id && item.mission_id.toLowerCase() === cleanIdLower)
    );
    if (!c) throw new Error('Challenge not found');

    // Requirements 11 & 12: Challenge identity and publicRouteId NEVER change
    delete data.id;
    delete data.challengeId;
    delete data.publicRouteId;
    delete data._id;
    delete data.competitionId;
    delete data.competition_id;

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
      const fl = db.getFlags().find(f => f.challenge_id === c.id || (c._id && f.challenge_id === String(c._id)));
      if (fl) {
        fl.flag_value = data.flag.trim();
        fl.challenge_id = c.id;
        if (db.isMongo && db.persistDoc) db.persistDoc('flags', fl).catch(() => {});
      } else {
        const newFl = {
          id: `f-${Date.now()}`,
          challenge_id: c.id,
          flag_type: 'STATIC',
          flag_value: data.flag.trim(),
          case_sensitive: true
        };
        db.getFlags().push(newFl);
        if (db.isMongo && db.persistDoc) db.persistDoc('flags', newFl).catch(() => {});
      }
    }

    if (db.isMongo && db.persistDoc) {
      db.persistDoc('challenges', c).catch(() => {});
    }

    const isPublishedAction = data.status && (data.status.toUpperCase() === 'PUBLISHED' || data.status.toUpperCase() === 'LIVE');
    auditService.record({
      action: isPublishedAction ? 'CHALLENGE.PUBLISHED' : 'CHALLENGE.UPDATED',
      category: 'CHALLENGE',
      severity: isPublishedAction ? 'NOTICE' : 'INFO',
      actor: { type: 'USER', username: 'ADMIN', role: 'ADMIN' },
      resource: { type: 'CHALLENGE', id: c.id, challengeId: c.id },
      result: 'SUCCESS',
      description: isPublishedAction ? `Mission "${c.title}" promoted to LIVE status` : `Mission "${c.title}" updated`,
      metadata: { challengeId: c.id, title: c.title, status: c.status }
    }).catch(() => {});

    // Real-time notification
    realtimeService.broadcastChallengeUpdated(c.id, c.competition_id)
      .catch(e => console.error('[CHALLENGE SERVICE] Broadcast updated error:', e));

    return c;
  }

  deleteChallenge(id) {
    const cleanId = String(id).trim();
    const idx = db.getChallenges().findIndex(c => c.id === cleanId || (c._id && String(c._id) === cleanId) || c.slug === cleanId);
    if (idx === -1) throw new Error('Challenge not found');
    const ch = db.getChallenges()[idx];
    const compId = ch.competition_id;
    const targetId = ch.id;
    db.getChallenges().splice(idx, 1);

    auditService.record({
      action: 'CHALLENGE.DELETED',
      category: 'CHALLENGE',
      severity: 'WARNING',
      actor: { type: 'USER', username: 'ADMIN', role: 'ADMIN' },
      resource: { type: 'CHALLENGE', id: targetId, challengeId: targetId },
      result: 'SUCCESS',
      description: `Mission "${ch.title}" neutralized / deleted (${targetId})`,
      metadata: { challengeId: targetId, title: ch.title }
    }).catch(() => {});

    if (db.isMongo && db.mongoDb) {
      const deleteFilter = ch._id ? { $or: [{ id: targetId }, { _id: ch._id }] } : { id: targetId };
      db.mongoDb.collection('challenges').deleteOne(deleteFilter).catch(() => {});
      db.mongoDb.collection('challenge_flags').deleteMany({ challenge_id: targetId }).catch(() => {});
      db.mongoDb.collection('challenge_hints').deleteMany({ challenge_id: targetId }).catch(() => {});
      db.mongoDb.collection('challenge_files').deleteMany({ challenge_id: targetId }).catch(() => {});
    }

    // Real-time notification
    realtimeService.broadcastChallengeDeleted(targetId, compId)
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
    const flags = db.getFlags().filter(f => f.challenge_id === c.id || (c._id && f.challenge_id === String(c._id)));
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

  getChallengeFiles(challengeId, ...altIds) {
    const fileService = require('./fileService');
    return fileService.getChallengeFiles(challengeId, ...altIds);
  }
}

module.exports = new ChallengeService();
