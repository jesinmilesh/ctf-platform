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

    const hints = db.getHints().filter(h => h.challenge_id === c.id && h.enabled).map((h, index) => ({
      id: h.id,
      index: index + 1,
      cost: h.cost,
      // Hint text is masked until unlocked
      content: h.unlocked || h.cost === 0 ? h.content : null,
      isUnlocked: !!h.unlocked || h.cost === 0
    }));

    const teamId = user ? user.team_id : null;
    const isSolved = db.getSolves().some(s => s.challenge_id === c.id && ((teamId && s.team_id === teamId) || (user && s.user_id === user.id)));

    // Active instance check
    const instance = db.getInstances().find(i => i.challenge_id === c.id && (i.team_id === teamId || (user && i.user_id === user.id)) && i.status === 'RUNNING');

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
    const hint = db.getHints().find(h => h.id === hintId && h.challenge_id === challengeId);
    if (!hint) throw new Error('Hint not found');

    hint.unlocked = true;
    return {
      id: hint.id,
      content: hint.content,
      cost: hint.cost
    };
  }

  createChallenge(data) {
    const id = `ch-${Date.now()}`;
    const slug = (data.title || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const mission_id = data.mission_id || `OP-${data.category ? data.category.slice(0,3).toUpperCase() : 'SEC'}-${Math.floor(10 + Math.random() * 90)}`;

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
    if (data.status) c.status = data.status;

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
}

module.exports = new ChallengeService();
