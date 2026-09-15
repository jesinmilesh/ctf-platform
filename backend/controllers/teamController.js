/**
 * XPLOITX // CYBER BATTLEFIELD
 * Team Controller (backend/controllers/teamController.js)
 */

const db = require('../config/database');
const auditService = require('../services/auditService');

exports.getTeam = async (req, res) => {
  const teamId = req.params.id;
  let team = db.getTeams().find(t => t.id === teamId || t.slug === teamId);

  // Fallback: query MongoDB Atlas if not found in memory
  if (!team && db.isMongo && db.mongoDb) {
    try {
      const doc = await db.mongoDb.collection('teams').findOne({
        $or: [{ id: teamId }, { slug: teamId }]
      });
      if (doc) {
        team = { ...doc };
        if (doc._id) team._id = doc._id.toString();
        // Merge into memory cache
        const existing = db.getTeams().find(t => t.id === team.id);
        if (!existing) db.getTeams().push(team);
      }
    } catch (e) {
      console.warn('[TEAM] Atlas getTeam fallback error:', e.message);
    }
  }

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

  const isMemberOrAdmin = req.user && (
    req.user.team_id === team.id ||
    req.user.role === 'ADMIN' ||
    req.user.role === 'SUPER_ADMIN'
  );

  const safeTeam = { ...team };
  if (!isMemberOrAdmin) {
    delete safeTeam.access_code;
    delete safeTeam.accessCode;
  }

  res.json({
    team: {
      ...safeTeam,
      members,
      solves
    }
  });
};

exports.createTeam = async (req, res) => {
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

  const crypto = require('crypto');
  const accessCode = `${cleanName.slice(0, 4).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const team = {
    id: `t-${crypto.randomBytes(4).toString('hex')}`,
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

  // Record team member
  const memberRecord = {
    id: crypto.randomUUID(),
    team_id: team.id,
    user_id: req.user.id,
    role: 'CAPTAIN',
    joined_at: new Date().toISOString()
  };
  db.getTeamMembers().push(memberRecord);

  // Persist to MongoDB Atlas
  if (db.isMongo && db.persistDoc) {
    await db.persistDoc('teams', team).catch(e => console.warn('[TEAM] persistDoc(team) error:', e.message));
    if (user) await db.persistDoc('users', user).catch(e => console.warn('[TEAM] persistDoc(user) error:', e.message));
    await db.persistDoc('teamMembers', memberRecord).catch(e => console.warn('[TEAM] persistDoc(member) error:', e.message));
  }

  auditService.record({
    action: 'TEAM.CREATED',
    category: 'TEAM',
    severity: 'INFO',
    actor: req.user,
    resource: { type: 'TEAM', id: team.id },
    result: 'SUCCESS',
    description: `Tactical squad "${team.name}" commissioned by operative ${req.user.username}`,
    request: { requestId: req.id, method: req.method, route: req.originalUrl },
    network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
    metadata: { teamId: team.id, name: team.name }
  }).catch(() => {});

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

exports.joinTeam = async (req, res) => {
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

  // Enforce server-side team size limits
  const comp = db.getCompetitions()[0];
  const maxTeamSize = comp?.max_team_size || 4;
  const currentMembers = db.getUsers().filter(u => u.team_id === team.id);
  if (currentMembers.length >= maxTeamSize) {
    return res.status(400).json({
      error: 'TEAM_FULL',
      message: `Squad has reached the maximum permitted capacity of ${maxTeamSize} operatives.`
    });
  }

  const user = db.getUsers().find(u => u.id === req.user.id);
  if (user) {
    user.team_id = team.id;
  }

  // Record team member
  const crypto = require('crypto');
  const memberRecord = {
    id: crypto.randomUUID(),
    team_id: team.id,
    user_id: req.user.id,
    role: 'MEMBER',
    joined_at: new Date().toISOString()
  };
  db.getTeamMembers().push(memberRecord);

  // Persist to MongoDB Atlas
  if (db.isMongo && db.persistDoc) {
    if (user) await db.persistDoc('users', user).catch(e => console.warn('[TEAM] persistDoc(user) error:', e.message));
    await db.persistDoc('teamMembers', memberRecord).catch(e => console.warn('[TEAM] persistDoc(member) error:', e.message));
  }

  auditService.record({
    action: 'TEAM.JOINED',
    category: 'TEAM',
    severity: 'INFO',
    actor: req.user,
    resource: { type: 'TEAM', id: team.id },
    result: 'SUCCESS',
    description: `Operative ${req.user.username} joined squad "${team.name}"`,
    request: { requestId: req.id, method: req.method, route: req.originalUrl },
    network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
    metadata: { teamId: team.id, name: team.name }
  }).catch(() => {});

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
