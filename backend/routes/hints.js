/**
 * XPLOITX // CYBER BATTLEFIELD
 * Hints Routes (backend/routes/hints.js)
 */

const express = require('express');
const router = express.Router();
const challengeService = require('../services/challengeService');
const db = require('../config/database');

router.get('/', (req, res) => {
  const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  const teamId = req.user ? (req.user.team_id || (req.user.team && req.user.team.id)) : null;
  const userId = req.user ? req.user.id : null;

  const publishedChallenges = new Set(
    db.getChallenges()
      .filter(c => c.status === 'PUBLISHED' || c.status === 'LIVE' || isAdmin)
      .map(c => c.id)
  );

  const reveals = db.getHintReveals ? db.getHintReveals() : [];
  const unlockedHintIds = new Set(
    reveals
      .filter(r => (teamId && r.team_id === teamId) || (userId && r.user_id === userId))
      .map(r => r.hint_id)
  );

  const hints = db.getHints()
    .filter(h => publishedChallenges.has(h.challenge_id))
    .map(h => {
      const isUnlocked = isAdmin || unlockedHintIds.has(h.id) || h.cost === 0;
      return {
        id: h.id,
        challenge_id: h.challenge_id,
        cost: h.cost,
        content: isUnlocked ? h.content : null,
        isUnlocked
      };
    });

  res.json({ hints });
});

router.post('/:hintId/reveal', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  try {
    const hint = challengeService.unlockHint(req.body.challengeId, req.params.hintId, req.user);
    res.json({ success: true, hint });
  } catch (err) {
    res.status(400).json({ error: 'HINT_ERROR', message: err.message });
  }
});

module.exports = router;
