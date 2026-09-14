/**
 * XPLOITX // CYBER BATTLEFIELD
 * Users Routes (backend/routes/users.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    username: u.username,
    callsign: u.callsign,
    role: u.role,
    affiliation: u.affiliation
  }));
  res.json({ users });
});

router.get('/:id', (req, res) => {
  const user = db.getUsers().find(u => u.id === req.params.id || u.username === req.params.id);
  if (!user) return res.status(404).json({ error: 'Operative not found' });

  const solves = db.getSolves().filter(s => s.user_id === user.id).map(s => {
    const ch = db.getChallenges().find(c => c.id === s.challenge_id);
    return {
      challengeId: s.challenge_id,
      title: ch ? ch.title : 'Mission',
      category: ch ? (ch.category_name || 'MISC') : 'MISC',
      points: s.points_awarded,
      isFirstBlood: s.is_first_blood,
      solvedAt: s.solved_at
    };
  });

  const team = db.getTeams().find(t => t.id === user.team_id);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      callsign: user.callsign,
      role: user.role,
      affiliation: user.affiliation,
      team: team ? { id: team.id, name: team.name, score: team.total_score } : null,
      solves
    }
  });
});

module.exports = router;
