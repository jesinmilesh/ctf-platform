const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();
/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication Middleware (backend/middleware/auth.js)
 * Implements Cryptographic Session Token Verification.
 */

const crypto = require('crypto');
const db = require('../config/database');
const authService = require('../services/authService');

async function authMiddleware(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies['xploitx_token']) {
    token = req.cookies['xploitx_token'];
  }

  if (!token || authService.isTokenRevoked(token)) {
    req.user = null;
    return next();
  }

  try {
    let validUserId = null;

    // Cryptographic Signed Token Format:
    // 5 parts: userId:username:timestamp:nonce:signature (high-entropy non-colliding)
    // 4 parts: userId:username:timestamp:signature (legacy)
    const parts = token.split(':');
    if (parts.length === 5) {
      const [userId, username, timestamp, nonce, signature] = parts;
      const payload = `${userId}:${username}:${timestamp}:${nonce}`;
      const secret = process.env.JWT_SECRET || 'c2_command_jwt_super_secret_key_change_in_production';
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Check token expiration (7 days)
      const tokenTime = parseInt(timestamp, 10);
      const isExpired = isNaN(tokenTime) || (Date.now() - tokenTime) > (7 * 24 * 3600 * 1000);

      // Check session table if session is registered and expired
      const session = db.getSessions().find(s => s.token === token);
      const isSessionExpired = session && new Date(session.expires_at) <= new Date();

      if (!isExpired && !isSessionExpired && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        validUserId = userId;
      }
    } else if (parts.length === 4) {
      const [userId, username, timestamp, signature] = parts;
      const payload = `${userId}:${username}:${timestamp}`;
      const secret = process.env.JWT_SECRET || 'c2_command_jwt_super_secret_key_change_in_production';
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Check token expiration (7 days)
      const tokenTime = parseInt(timestamp, 10);
      const isExpired = isNaN(tokenTime) || (Date.now() - tokenTime) > (7 * 24 * 3600 * 1000);

      // Check session table if session is registered and expired
      const session = db.getSessions().find(s => s.token === token);
      const isSessionExpired = session && new Date(session.expires_at) <= new Date();

      if (!isExpired && !isSessionExpired && crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        validUserId = userId;
      }
    } else if (parts.length === 3) {
      // Compatibility format userId:username:timestamp verified against sessions
      const [userId] = parts;
      const session = db.getSessions().find(s => s.token === token);
      if (session && new Date(session.expires_at) > new Date()) {
        validUserId = userId;
      }
    }

    if (!validUserId) {
      req.user = null;
      return next();
    }

    let user = db.getUsers().find(u => u.id === validUserId || (u._id && String(u._id) === validUserId));

    // Fallback: Query MongoDB Atlas directly if not found in memory
    if (!user && db.isMongo && db.mongoDb) {
      try {
        const doc = await db.mongoDb.collection('users').findOne({
          $or: [
            { id: validUserId },
            ...(validUserId.length === 24 ? [{ _id: new (require('mongodb').ObjectId)(validUserId) }] : [])
          ]
        });
        if (doc) {
          user = { ...doc };
          if (doc._id) user._id = doc._id.toString();
          if (!user.id && doc._id) user.id = doc._id.toString();
          const existing = db.getUsers().find(u => u.id === user.id);
          if (!existing) {
            Array.prototype.push.call(db.getUsers(), user);
          }
        }
      } catch (_) {}
    }

    if (user && !user.is_banned) {
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        callsign: user.callsign,
        team_id: user.team_id
      };
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access denied: Valid operative credentials required.'
    });
  }
  next();
}

/**
 * Squad Required Access Gate Middleware (Section 7, 8, 9, 10, 11, 12, 26, 30, 31)
 * Enforces active, verified squad membership for participants.
 * Admins are exempted.
 */
async function requireSquadMembership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access denied: Valid operative credentials required.'
    });
  }

  // Administrators have level 5 command clearance — never blocked by participant squad gate
  if (req.user.role === 'ADMIN') {
    return next();
  }

  const userId = req.user.id;
  const compId = db.getCompetitions()[0]?.id;
  let teamId = req.user.team_id || null;

  // Verify in-memory user
  const user = db.getUsers().find(u => u.id === userId);
  if (user && user.team_id) {
    teamId = user.team_id;
  }

  // Authoritative MongoDB Atlas verification
  if (db.isMongo && db.mongoDb) {
    try {
      const freshUser = await db.mongoDb.collection('users').findOne({ id: userId });
      if (freshUser) {
        teamId = freshUser.team_id;
        if (user) user.team_id = freshUser.team_id;
      }

      if (teamId) {
        // Confirm squad membership record in team_members collection
        const memberQuery = { user_id: userId, team_id: teamId };
        if (compId) memberQuery.competition_id = compId;
        let memberRecord = await db.mongoDb.collection('team_members').findOne(memberQuery);
        if (!memberRecord) {
          memberRecord = await db.mongoDb.collection('team_members').findOne({ user_id: userId, team_id: teamId });
        }
        if (!memberRecord) {
          teamId = null;
        }
      }
    } catch (e) {
      console.warn('[AUTH] Atlas squad verification warning:', e.message);
    }
  } else {
    // In-memory verification
    if (teamId) {
      const memberRecord = db.getTeamMembers().find(m => m.user_id === userId && m.team_id === teamId);
      if (!memberRecord) {
        teamId = null;
      }
    }
  }

  // Confirm team exists and is not disqualified
  if (teamId) {
    let team = db.getTeams().find(t => t.id === teamId);
    if (!team && db.isMongo && db.mongoDb) {
      try {
        team = await db.mongoDb.collection('teams').findOne({ id: teamId });
      } catch (_) {}
    }
    if (!team || team.is_disqualified) {
      teamId = null;
    }
  }

  if (!teamId) {
    return res.status(403).json({
      success: false,
      code: 'SQUAD_REQUIRED',
      error: 'SQUAD_REQUIRED',
      message: 'Join or create a squad to access this resource.'
    });
  }

  req.user.team_id = teamId;
  next();
}

module.exports = { authMiddleware, requireAuth, requireSquadMembership };
