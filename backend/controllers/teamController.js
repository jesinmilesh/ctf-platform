/**
 * XPLOITX // CYBER BATTLEFIELD
 * Team Controller (backend/controllers/teamController.js)
 */

const db = require('../config/database');

exports.getTeam = (req, res) => {
  const teamId = req.params.id;
  const team = db.getTeams().find(t => t.id === teamId || t.slug === teamId);
  if (!team) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tactical squad not found' });
  }

  const members = db.getUsers().filter(u => u.team_id === team.id).map(u => ({
    id: u.id,
    username: u.username,
    callsign: u.callsign,
    role: u.role,
    affiliation: u.affiliation
  }));

  const solves = db.getSolves().filter(s => s.team_id === team.id).map(s => {
    const ch = db.getChallenges().find(c => c.id === s.challenge_id);
    return {
      challengeId: s.challenge_id,
      title: ch ? ch.title : 'Mission',
      points: s.points_awarded,
      isFirstBlood: s.is_first_blood,
      solvedAt: s.solved_at
    };
  });

  res.json({
    team: {
      ...team,
      members,
      solves
    }
  });
};

exports.createTeam = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  const { name } = req.body;
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Squad designation must be at least 3 characters' });
  }

  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const existing = db.getTeams().find(t => t.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'EXISTS', message: 'A squad with this designation already exists' });
  }

  const accessCode = `${cleanName.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const team = {
    id: `t-${Date.now()}`,
    competition_id: db.getCompetitions()[0]?.id,
    name: cleanName,
    slug,
    access_code: accessCode,
    captain_id: req.user.id,
    total_score: 0,
    solves_count: 0,
    first_bloods: 0,
    is_disqualified: false,
    last_score_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  db.getTeams().push(team);

  // Update current user
  const user = db.getUsers().find(u => u.id === req.user.id);
  if (user) {
    user.team_id = team.id;
  }

  res.status(201).json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      accessCode: team.access_code
    }
  });
};

exports.joinTeam = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  const { accessCode } = req.body;
  if (!accessCode) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Squad invite/access code required' });
  }

  const team = db.getTeams().find(t => t.access_code.toUpperCase() === accessCode.trim().toUpperCase());
  if (!team) {
    return res.status(404).json({ error: 'INVALID_CODE', message: 'Invalid squad security access code' });
  }

  const user = db.getUsers().find(u => u.id === req.user.id);
  if (user) {
    user.team_id = team.id;
  }

  res.json({
    success: true,
    message: `Squad joined: ${team.name}`,
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug
    }
  });
};
