/**
 * XPLOITX // CYBER BATTLEFIELD
 * Team Controller (backend/controllers/teamController.js)
 *
 * Production-grade squad management:
 * - XPX-TEAM-XXXXXX format IDs (counter-based, stable, server-generated)
 * - Already-member guard (users cannot belong to multiple squads)
 * - MongoDB unique index enforcement with proper 409 response on E11000
 * - Atlas-backed duplicate check (race-safe)
 * - Access codes: XPL-XXXXXX (random, server-generated)
 * - Full MongoDB persistence via persistDoc
 */

const db = require('../config/database');
const auditService = require('../services/auditService');
const crypto = require('crypto');

// ─── ID Generation ───────────────────────────────────────────────────────────

/**
 * Generate the next XPX-TEAM-XXXXXX ID using MongoDB counter collection.
 * Falls back to random hex if Atlas is not available.
 */
async function generateTeamId() {
  if (db.isMongo && db.mongoDb) {
    try {
      const result = await db.mongoDb.collection('counters').findOneAndUpdate(
        { _id: 'team_counter' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const seq = (result?.seq || result?.value?.seq || 1);
      return `XPX-TEAM-${String(seq).padStart(6, '0')}`;
    } catch (e) {
      console.warn('[TEAM] Counter generation failed, using random:', e.message);
    }
  }
  // Fallback: random 6-char hex
  return `XPX-TEAM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Generate a secure, unpredictable join/access code.
 * Format: XPL-XXXXXX (6 random uppercase alphanumeric chars)
 */
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous charset
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return `XPL-${code}`;
}

// ─── Controller: getTeam ─────────────────────────────────────────────────────

exports.getTeam = async (req, res) => {
  const teamId = req.params.id;
  let team = db.getTeams().find(t => t.id === teamId || t.slug === teamId);

  // Atlas fallback if not in memory
  if (!team && db.isMongo && db.mongoDb) {
    try {
      const doc = await db.mongoDb.collection('teams').findOne({
        $or: [{ id: teamId }, { slug: teamId }]
      });
      if (doc) {
        team = { ...doc };
        if (doc._id) team._id = doc._id.toString();
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

  // Build member list from in-memory users (always fresh from Atlas sync)
  const members = db.getUsers().filter(u => u.team_id === team.id).map(u => ({
    id: u.id,
    username: u.username,
    callsign: u.callsign,
    role: u.role,
    affiliation: u.affiliation,
    // Derive member role from team_members
    memberRole: db.getTeamMembers().find(m => m.user_id === u.id && m.team_id === team.id)?.role || 'MEMBER'
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
    req.user.role === 'ADMIN'
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

// ─── Controller: createTeam ──────────────────────────────────────────────────

exports.createTeam = async (req, res) => {
  // req.user guaranteed by requireAuth middleware
  const userId = req.user.id;
  const ip = req.ip || '127.0.0.1';

  // ── Guard: user already belongs to a squad ──────────────────────────────
  if (req.user.team_id) {
    return res.status(409).json({
      error: 'ALREADY_MEMBER',
      message: 'You are already a member of a squad. You cannot create another.'
    });
  }

  // Also double-check against Atlas in case in-memory is stale
  if (db.isMongo && db.mongoDb) {
    try {
      const freshUser = await db.mongoDb.collection('users').findOne({ id: userId });
      if (freshUser && freshUser.team_id) {
        return res.status(409).json({
          error: 'ALREADY_MEMBER',
          message: 'You are already a member of a squad. You cannot create another.'
        });
      }
    } catch (e) {
      console.warn('[TEAM] Atlas user membership check failed:', e.message);
    }
  }

  // ── Validate name ───────────────────────────────────────────────────────
  const { name } = req.body;
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Squad designation must be at least 3 characters.' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Squad designation must be 50 characters or fewer.' });
  }

  const cleanName = name.trim();
  const normalizedName = cleanName.toLowerCase();
  const slug = normalizedName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const competition_id = db.getCompetitions()[0]?.id;

  // ── Duplicate check: in-memory ──────────────────────────────────────────
  const existingInMem = db.getTeams().find(t =>
    t.name.toLowerCase() === normalizedName &&
    t.competition_id === competition_id
  );
  if (existingInMem) {
    return res.status(409).json({
      error: 'TEAM_ALREADY_EXISTS',
      message: 'RECORD ALREADY EXISTS — A squad with this designation already exists.'
    });
  }

  // ── Duplicate check: Atlas (race-safe, catches concurrent inserts) ──────
  if (db.isMongo && db.mongoDb) {
    try {
      const existingAtlas = await db.mongoDb.collection('teams').findOne({
        competition_id,
        normalizedName
      });
      if (existingAtlas) {
        return res.status(409).json({
          error: 'TEAM_ALREADY_EXISTS',
          message: 'RECORD ALREADY EXISTS — A squad with this designation already exists.'
        });
      }
    } catch (e) {
      console.warn('[TEAM] Atlas duplicate check failed:', e.message);
    }
  }

  // ── Generate server-side IDs ────────────────────────────────────────────
  const teamId = await generateTeamId();         // XPX-TEAM-000001
  const accessCode = generateAccessCode();        // XPL-XXXXXX

  const team = {
    id: teamId,
    competition_id,
    name: cleanName,
    normalizedName,                               // stored for case-insensitive unique index
    slug,
    access_code: accessCode,
    captain_id: userId,                           // from authenticated session — never from body
    total_score: 0,
    solves_count: 0,
    first_bloods: 0,
    member_count: 1,
    is_disqualified: false,
    last_score_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  // ── Persist team to Atlas (catches E11000 duplicate key) ─────────────────
  if (db.isMongo && db.mongoDb) {
    try {
      const toInsert = { ...team };
      await db.mongoDb.collection('teams').insertOne(toInsert);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({
          error: 'TEAM_ALREADY_EXISTS',
          message: 'RECORD ALREADY EXISTS — A squad with this designation already exists.'
        });
      }
      console.error('[TEAM] Atlas insertOne(team) error:', e.message);
      return res.status(500).json({ error: 'DB_ERROR', message: 'Squad creation failed. Please try again.' });
    }
  }

  // ── Push to memory cache ─────────────────────────────────────────────────
  db.getTeams().push(team);

  // ── Update user membership ───────────────────────────────────────────────
  const user = db.getUsers().find(u => u.id === userId);
  if (user) user.team_id = teamId;

  // ── Create team member record ────────────────────────────────────────────
  const memberRecord = {
    id: crypto.randomUUID(),
    team_id: teamId,
    user_id: userId,
    competition_id,
    role: 'CAPTAIN',
    joined_at: new Date().toISOString()
  };
  db.getTeamMembers().push(memberRecord);

  // ── Persist user update & member record to Atlas ─────────────────────────
  if (db.isMongo && db.mongoDb) {
    try {
      await db.mongoDb.collection('users').updateOne(
        { id: userId },
        { $set: { team_id: teamId } }
      );
    } catch (e) {
      console.warn('[TEAM] Atlas user team_id update failed:', e.message);
    }

    // Use upsert for member record (idempotent)
    try {
      const { id: _skip, ...memberToSave } = memberRecord;
      await db.mongoDb.collection('team_members').updateOne(
        { user_id: userId, team_id: teamId },
        { $set: { ...memberRecord } },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[TEAM] Atlas member record upsert failed:', e.message);
    }
  }

  auditService.record({
    action: 'TEAM.CREATED',
    category: 'TEAM',
    severity: 'INFO',
    actor: req.user,
    resource: { type: 'TEAM', id: teamId },
    result: 'SUCCESS',
    description: `Tactical squad "${cleanName}" commissioned by operative ${req.user.username}`,
    request: { requestId: req.id, method: req.method, route: req.originalUrl },
    network: { ip, userAgent: req.headers?.['user-agent'] },
    metadata: { teamId, name: cleanName, competitionId: competition_id }
  }).catch(() => {});

  return res.status(201).json({
    success: true,
    team: {
      id: teamId,
      name: cleanName,
      slug,
      accessCode: accessCode,
      role: 'CAPTAIN',
      memberCount: 1
    }
  });
};

// ─── Controller: joinTeam ────────────────────────────────────────────────────

exports.joinTeam = async (req, res) => {
  const userId = req.user.id;
  const ip = req.ip || '127.0.0.1';

  // ── Guard: user already belongs to a squad ──────────────────────────────
  if (req.user.team_id) {
    return res.status(409).json({
      error: 'ALREADY_MEMBER',
      message: 'You are already a member of a squad.'
    });
  }

  // Double-check Atlas in case memory is stale
  if (db.isMongo && db.mongoDb) {
    try {
      const freshUser = await db.mongoDb.collection('users').findOne({ id: userId });
      if (freshUser && freshUser.team_id) {
        return res.status(409).json({
          error: 'ALREADY_MEMBER',
          message: 'You are already a member of a squad.'
        });
      }
    } catch (e) {
      console.warn('[TEAM] Atlas user membership check failed:', e.message);
    }
  }

  // ── Validate access code ─────────────────────────────────────────────────
  const { accessCode } = req.body;
  if (!accessCode || typeof accessCode !== 'string') {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Squad access code required.' });
  }

  const normalizedCode = accessCode.trim().toUpperCase();

  // ── Find team by access code ─────────────────────────────────────────────
  let team = db.getTeams().find(t => t.access_code.toUpperCase() === normalizedCode);

  // Atlas fallback if not in memory
  if (!team && db.isMongo && db.mongoDb) {
    try {
      const doc = await db.mongoDb.collection('teams').findOne({ access_code: normalizedCode });
      if (doc) {
        team = { ...doc };
        if (doc._id) team._id = doc._id.toString();
        const exists = db.getTeams().find(t => t.id === team.id);
        if (!exists) db.getTeams().push(team);
      }
    } catch (e) {
      console.warn('[TEAM] Atlas access code lookup failed:', e.message);
    }
  }

  if (!team) {
    return res.status(404).json({ error: 'INVALID_CODE', message: 'Invalid squad access code. Please check and try again.' });
  }

  // ── Enforce team capacity ────────────────────────────────────────────────
  const comp = db.getCompetitions()[0];
  const maxTeamSize = comp?.max_team_size || 4;

  // Count members from Atlas for accuracy
  let currentMemberCount = db.getUsers().filter(u => u.team_id === team.id).length;
  if (db.isMongo && db.mongoDb) {
    try {
      currentMemberCount = await db.mongoDb.collection('users').countDocuments({ team_id: team.id });
    } catch (e) {
      console.warn('[TEAM] Atlas member count failed, using memory:', e.message);
    }
  }

  if (currentMemberCount >= maxTeamSize) {
    return res.status(400).json({
      error: 'TEAM_FULL',
      message: `Squad "${team.name}" has reached the maximum capacity of ${maxTeamSize} operatives.`
    });
  }

  // ── Update user membership in Atlas (atomic) ─────────────────────────────
  if (db.isMongo && db.mongoDb) {
    try {
      const updateResult = await db.mongoDb.collection('users').updateOne(
        { id: userId, team_id: null },   // only update if team_id is still null
        { $set: { team_id: team.id } }
      );
      if (updateResult.matchedCount === 0) {
        // User already has a team (concurrent join race — reject)
        return res.status(409).json({
          error: 'ALREADY_MEMBER',
          message: 'You are already a member of a squad.'
        });
      }
    } catch (e) {
      console.error('[TEAM] Atlas user join update failed:', e.message);
      return res.status(500).json({ error: 'DB_ERROR', message: 'Join failed. Please try again.' });
    }
  }

  // Update in-memory
  const user = db.getUsers().find(u => u.id === userId);
  if (user) user.team_id = team.id;

  // ── Create member record ──────────────────────────────────────────────────
  const competition_id = team.competition_id || db.getCompetitions()[0]?.id;
  const memberRecord = {
    id: crypto.randomUUID(),
    team_id: team.id,
    user_id: userId,
    competition_id,
    role: 'MEMBER',
    joined_at: new Date().toISOString()
  };
  db.getTeamMembers().push(memberRecord);

  // Upsert member record (idempotent)
  if (db.isMongo && db.mongoDb) {
    try {
      await db.mongoDb.collection('team_members').updateOne(
        { user_id: userId, team_id: team.id },
        { $set: { ...memberRecord } },
        { upsert: true }
      );
    } catch (e) {
      // E11000 on team_members = duplicate join attempt (concurrent) — safe to ignore
      if (e.code !== 11000) {
        console.warn('[TEAM] Atlas member record upsert failed:', e.message);
      }
    }

    // Increment member_count on team document
    try {
      await db.mongoDb.collection('teams').updateOne(
        { id: team.id },
        { $inc: { member_count: 1 } }
      );
    } catch (e) {
      console.warn('[TEAM] Atlas team member_count increment failed:', e.message);
    }
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
    network: { ip, userAgent: req.headers?.['user-agent'] },
    metadata: { teamId: team.id, name: team.name, competitionId: competition_id }
  }).catch(() => {});

  return res.json({
    success: true,
    message: `Squad joined: ${team.name}`,
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      role: 'MEMBER',
      memberCount: currentMemberCount + 1
    }
  });
};
