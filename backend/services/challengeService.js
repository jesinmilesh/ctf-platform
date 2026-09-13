/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Management Service (backend/services/challengeService.js)
 */

const db = require('../config/database');
const scoringService = require('./scoringService');
const realtimeService = require('./realtimeService');

class ChallengeService {
  getAllPublicChallenges(user) {
    const challenges = db.getChallenges().filter(c => c.status === 'PUBLISHED' || c.status === 'LIVE');
    const categories = db.getCategories();
    const solves = db.getSolves();
    const teamId = user ? user.team_id : null;
    const userId = user ? user.id : null;

    return challenges.map(c => {
      const category = categories.find(cat => cat.id === c.category_id);
      const isSolved = solves.some(s => s.challenge_id === c.id && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId)));

      return {
        id: c.id,
        mission_id: c.mission_id,
        slug: c.slug,
        title: c.title,
        category: category ? category.name : (c.category_name || 'MISC'),
        category_slug: category ? category.slug : 'misc',
        category_color: category ? category.color_accent : '#00ff9c',
        difficulty: c.difficulty,
        points: c.current_points || c.base_points,
        solve_count: c.solve_count || 0,
        has_instance: !!c.has_instance,
        is_solved: isSolved
      };
    });
  }

  getChallengeDetails(challengeId, user) {
    const c = db.getChallenges().find(item => item.id === challengeId || item.slug === challengeId || item.mission_id === challengeId);
    if (!c) return null;

    const category = db.getCategories().find(cat => cat.id === c.category_id);
    const files = db.getFiles().filter(f => f.challenge_id === c.id).map(f => ({
      id: f.id,
      filename: f.filename,
      sizeBytes: f.file_size_bytes,
      sha256: f.sha256
    }));

    const teamId = user ? (user.team_id || (user.team && user.team.id)) : null;
    const userId = user ? user.id : null;

    // Hints mask/unmask based on team/user hint_reveals
    const hintReveals = db.getHintReveals().filter(r => (teamId && r.team_id === teamId) || (userId && r.user_id === userId));
    const unlockedHintIds = new Set(hintReveals.map(r => r.hint_id));

    const hints = db.getHints().filter(h => h.challenge_id === c.id && h.enabled).map((h, index) => {
      const isUnlocked = unlockedHintIds.has(h.id) || h.cost === 0;
      return {
        id: h.id,
        index: index + 1,
        cost: h.cost,
        content: isUnlocked ? h.content : null,
        isUnlocked
      };
    });

    const isSolved = db.getSolves().some(s => s.challenge_id === c.id && ((teamId && s.team_id === teamId) || (userId && s.user_id === userId)));

    // Active instance check
    const instance = db.getInstances().find(i => i.challenge_id === c.id && (i.team_id === teamId || (userId && i.user_id === userId)) && i.status === 'RUNNING');

    return {
      id: c.id,
      mission_id: c.mission_id,
      slug: c.slug,
      title: c.title,
      category: category ? category.name : (c.category_name || 'MISC'),
      category_color: category ? category.color_accent : '#00ff9c',
      difficulty: c.difficulty,
      points: c.current_points || c.base_points,
      solve_count: c.solve_count || 0,
      description: c.description,
      has_instance: !!c.has_instance,
      instance: instance ? {
        host: instance.host,
        port: instance.port,
        expires_at: instance.expires_at,
        timeRemainingSeconds: Math.max(0, Math.floor((new Date(instance.expires_at) - Date.now()) / 1000))
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
    const count = db.getChallenges().length + 1;
    const mission_id = data.mission_id || `OP-${data.category ? data.category.slice(0,3).toUpperCase() : 'SEC'}-${String(count).padStart(2, '0')}`;

    const newChallenge = {
      id,
      competition_id: db.getCompetitions()[0]?.id,
      category_id: data.category_id || db.getCategories()[0]?.id,
      category_name: data.category || 'MISC',
      mission_id,
      slug,
      title: data.title,
      description: data.description || '',
      difficulty: data.difficulty || 'MEDIUM',
      base_points: parseInt(data.points || 500, 10),
      minimum_points: parseInt(data.minimum_points || 100, 10),
      decay_threshold: parseInt(data.decay_threshold || 30, 10),
      current_points: parseInt(data.points || 500, 10),
      solve_count: 0,
      status: data.status || 'PUBLISHED',
      has_instance: !!data.has_instance,
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
    const c = db.getChallenges().find(item => item.id === id);
    if (!c) throw new Error('Challenge not found');

    if (data.title) c.title = data.title;
    if (data.description) c.description = data.description;
    if (data.difficulty) c.difficulty = data.difficulty;
    if (data.category) c.category_name = data.category;
    if (data.points) c.current_points = parseInt(data.points, 10);
    if (data.status) {
      if (data.status === 'PUBLISHED' || data.status === 'LIVE') {
        const check = this.validateChallengeForPublish(c);
        if (!check.valid) {
          throw new Error(`PRE_PUBLISH_VALIDATION_FAILED: ${check.errors.join('; ')}`);
        }
      }
      c.status = data.status;
    }

    if (data.flag) {
      const fl = db.getFlags().find(f => f.challenge_id === id);
      if (fl) {
        fl.flag_value = data.flag;
      } else {
        db.getFlags().push({
          id: `f-${Date.now()}`,
          challenge_id: id,
          flag_type: 'STATIC',
          flag_value: data.flag,
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
