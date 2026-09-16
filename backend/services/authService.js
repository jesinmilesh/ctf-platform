const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();
/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication Service (backend/services/authService.js)
 * Implements Section 6 & 11: Real Users, Secure Password Hashing & Authenticated Sessions.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const revokedTokens = new Set();

class AuthService {
  revokeToken(token) {
    if (token) {
      revokedTokens.add(token);
    }
  }

  isTokenRevoked(token) {
    if (!token) return true;
    return revokedTokens.has(token);
  }

  /**
   * Cryptographically hash password using single standard bcryptjs implementation (cost factor 10)
   */
  async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a valid string');
    }
    return await bcrypt.hash(password, 10);
  }

  /**
   * Constant-time safe verification of password using bcryptjs
   */
  async verifyPassword(password, storedHash) {
    if (!storedHash || !password || typeof password !== 'string' || typeof storedHash !== 'string') {
      return false;
    }
    try {
      return await bcrypt.compare(password, storedHash);
    } catch (e) {
      return false;
    }
  }

  async comparePassword(password, storedHash) {
    return this.verifyPassword(password, storedHash);
  }

  /**
   * Sign authentication session token using HMAC-SHA256
   */
  generateToken(userIdOrUser, maybeUsername) {
    let userId = userIdOrUser;
    let username = maybeUsername;
    if (typeof userIdOrUser === 'object' && userIdOrUser !== null) {
      userId = userIdOrUser.id;
      username = userIdOrUser.username;
    }
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(8).toString('hex');
    const payload = `${userId}:${username}:${timestamp}:${nonce}`;
    const secret = process.env.JWT_SECRET || 'c2_command_jwt_super_secret_key_change_in_production';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}:${signature}`;
  }

  /**
   * Strict Administrator Authentication:
   * 1. Exact username lookup (no lowercasing, no trimming)
   * 2. Authoritative query against MongoDB Atlas first, then memory cache
   * 3. Exact password comparison via existing matching verifier (no alteration, no rehash)
   * 4. Account active status check
   * 5. Strict role check (ADMIN required server-side)
   * 6. Participant credentials return 403 CLEARANCE_DENIED (no admin session created)
   */
  async adminLogin(usernameOrEmail, password) {
    const rawUsername = String(usernameOrEmail || '');
    const rawPassword = String(password || '');

    if (!rawUsername || !rawPassword) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    let user = null;

    // Direct MongoDB Atlas query with exact matching (authoritative source of truth)
    if (db.isMongo && db.mongoDb) {
      try {
        const doc = await db.mongoDb.collection('users').findOne({
          $or: [
            { username: rawUsername },
            { email: rawUsername },
            { callsign: rawUsername }
          ]
        });
        if (doc) {
          user = { ...doc };
          if (doc._id) user._id = doc._id.toString();
          if (!user.id && doc._id) user.id = doc._id.toString();
          // Update in-memory array
          const existing = db.getUsers().find(u => u.id === user.id);
          if (!existing) {
            Array.prototype.push.call(db.getUsers(), user);
          } else {
            Object.assign(existing, user);
          }
        }
      } catch (e) {
        console.warn('[AUTH] Direct Atlas admin query warning:', e.message);
      }
    }

    // Check memory store if Atlas was not connected or document not found there
    if (!user) {
      user = db.getUsers().find(u =>
        (u && u.username && u.username === rawUsername) ||
        (u && u.email && u.email === rawUsername) ||
        (u && u.callsign && u.callsign === rawUsername)
      );
    }

    if (!user) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Retrieve stored password hash from the authentic record (supports password_hash, passwordHash, password)
    const storedHash = user.password_hash || user.passwordHash || user.password;
    if (!storedHash) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Verify password against stored hash without any modifications or re-hashing
    const isValid = await this.verifyPassword(rawPassword, storedHash);
    if (!isValid) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Verify account active status
    if (user.is_banned || user.status === 'disabled' || user.status === 'suspended') {
      const err = new Error('ADMIN ACCOUNT IS SUSPENDED OR INACTIVE');
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    // Strict Role Verification: Must explicitly be ADMIN server-side
    const isAdmin = user.role === 'ADMIN';
    if (!isAdmin) {
      const err = new Error('ADMIN ACCESS REQUIRED');
      err.code = 'CLEARANCE_DENIED';
      throw err;
    }

    const token = this.generateToken(user.id, user.username);

    // Register active session
    const sessionObj = {
      id: crypto.randomUUID(),
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    db.getSessions().push(sessionObj);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        callsign: user.callsign
      }
    };
  }

  async login(usernameOrEmail, password) {
    const rawTerm = String(usernameOrEmail || '');
    const rawPw = String(password || '');

    if (!rawTerm || !rawPw) {
      throw new Error('Invalid operative callsign or passphrase.');
    }

    // Exact match
    let user = db.getUsers().find(u =>
      (u && u.username && u.username === rawTerm) ||
      (u && u.email && u.email === rawTerm) ||
      (u && u.callsign && u.callsign === rawTerm)
    );

    // Fallback: MongoDB Atlas query
    if (!user && db.isMongo && db.mongoDb) {
      try {
        const doc = await db.mongoDb.collection('users').findOne({
          $or: [
            { username: rawTerm },
            { email: rawTerm },
            { callsign: rawTerm }
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
      } catch (e) {
        console.warn('[AUTH] Direct Atlas user query warning:', e.message);
      }
    }

    if (!user) {
      throw new Error('Invalid operative callsign or passphrase.');
    }

    if (user.is_banned) {
      throw new Error('OPERATIVE ACCOUNT TERMINATED BY C2 COMMAND.');
    }

    // Cryptographic Password Validation using scrypt
    const isValid = await this.verifyPassword(rawPw, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid operative callsign or passphrase.');
    }

    const token = this.generateToken(user.id, user.username);
    const userTeam = db.getTeams().find(t => t.id === user.team_id);

    // Record session
    const sessionObj = {
      id: crypto.randomUUID(),
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    db.getSessions().push(sessionObj);

    const meUser = await this.getMe(user.id);

    return {
      token,
      user: meUser
    };
  }

  async register({ username, email, password, callsign, affiliation }) {
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Callsign/Username must be at least 3 characters.');
    }

    if (!password || password.length < 8) {
      throw new Error('Passphrase must be at least 8 characters.');
    }

    const exists = db.getUsers().find(u =>
      (u && u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()) ||
      (u && u.email && u.email.toLowerCase() === cleanEmail)
    );
    if (exists) {
      throw new Error('Operative with this username or email already registered in system registry.');
    }

    const passwordHash = await this.hashPassword(password);
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      competition_id: db.getCompetitions()[0]?.id,
      team_id: null,
      username: cleanUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      role: 'PLAYER',
      callsign: (callsign || cleanUsername).toUpperCase(),
      affiliation: affiliation || 'Independent Operative',
      is_banned: false,
      created_at: new Date().toISOString()
    };

    db.getUsers().push(newUser);

    const token = this.generateToken(newUser.id, newUser.username);

    // Record session
    db.getSessions().push({
      id: crypto.randomUUID(),
      user_id: newUser.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });

    return {
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        callsign: newUser.callsign,
        affiliation: newUser.affiliation,
        team_id: null,
        team: null
      }
    };
  }

  async getMe(userId) {
    let user = db.getUsers().find(u => u.id === userId);

    // Authoritative direct Atlas check
    if (db.isMongo && db.mongoDb) {
      try {
        const freshUser = await db.mongoDb.collection('users').findOne({ id: userId });
        if (freshUser) {
          if (user) Object.assign(user, freshUser);
          else user = { ...freshUser };
        }
      } catch (_) {}
    }

    if (!user) return null;

    let teamId = user.team_id;
    let team = teamId ? db.getTeams().find(t => t.id === teamId) : null;
    let memberRecord = null;

    if (db.isMongo && db.mongoDb) {
      try {
        if (teamId && !team) {
          team = await db.mongoDb.collection('teams').findOne({ id: teamId });
          if (team) {
            const exists = db.getTeams().find(t => t.id === team.id);
            if (!exists) db.getTeams().push({ ...team });
          }
        }
        if (teamId) {
          memberRecord = await db.mongoDb.collection('team_members').findOne({ user_id: user.id, team_id: teamId });
        }
      } catch (_) {}
    }

    if (!memberRecord && teamId) {
      memberRecord = db.getTeamMembers().find(m => m.user_id === user.id && m.team_id === teamId);
    }

    const userSolves = db.getSolves().filter(s => s.user_id === user.id);

    // Derive member role from team_members collection
    let teamRole = null;
    if (team) {
      teamRole = memberRecord?.role || (team.captain_id === user.id ? 'CAPTAIN' : 'MEMBER');
    }

    const hasSquad = !!(team && teamId && !team.is_disqualified);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callsign: user.callsign,
      affiliation: user.affiliation,
      team_id: hasSquad ? team.id : null,
      team: hasSquad ? {
        id: team.id,            // XPX-TEAM-000001 (the public display ID)
        teamId: team.id,        // alias for clarity in frontend
        name: team.name,
        slug: team.slug,
        score: team.total_score || 0,
        solvesCount: team.solves_count || 0,
        firstBloods: team.first_bloods || 0,
        memberCount: team.member_count || 1,
        role: teamRole,
        accessCode: teamRole === 'CAPTAIN' ? team.access_code : undefined
      } : null,
      hasSquad,
      has_squad: hasSquad,
      solvesCount: userSolves.length,
      totalPoints: userSolves.reduce((acc, s) => acc + (s.points_awarded || 0), 0)
    };
  }
}

module.exports = new AuthService();
