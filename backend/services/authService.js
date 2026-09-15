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
const argon2 = require('argon2');
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
   * Cryptographically hash password using Argon2id
   */
  async hashPassword(password) {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });
  }

  /**
   * Constant-time safe verification of password against stored Argon2id or legacy hash
   */
  async verifyPassword(password, storedHash) {
    if (!storedHash || !password) return false;
    if (storedHash.startsWith('$argon2')) {
      try {
        return await argon2.verify(storedHash, password);
      } catch (e) {
        return false;
      }
    }
    // Backward compatibility for legacy salt:derivedKey format with seamless migration
    if (storedHash.includes(':')) {
      try {
        const [salt, key] = storedHash.split(':');
        const derivedKey = crypto.scryptSync(password, salt, 64);
        const keyBuffer = Buffer.from(key, 'hex');
        if (keyBuffer.length !== derivedKey.length) return false;
        return crypto.timingSafeEqual(keyBuffer, derivedKey);
      } catch (e) {
        return false;
      }
    }
    return false;
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
   * 2. Exact password comparison via Argon2id (no alteration)
   * 3. Account active status check
   * 4. Strict role check (ADMIN or SUPER_ADMIN required)
   * 5. Participant credentials return 403 CLEARANCE_DENIED (no session created)
   */
  async adminLogin(usernameOrEmail, password) {
    const rawUsername = String(usernameOrEmail || '');
    const rawPassword = String(password || '');

    if (!rawUsername || !rawPassword) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Exact username match (case-sensitive)
    let user = db.getUsers().find(u =>
      (u && u.username && u.username === rawUsername) ||
      (u && u.email && u.email === rawUsername) ||
      (u && u.callsign && u.callsign === rawUsername)
    );

    // Fallback: Query MongoDB Atlas directly with exact matching
    if (!user && db.isMongo && db.mongoDb) {
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
          const existing = db.getUsers().find(u => u.id === user.id);
          if (!existing) {
            Array.prototype.push.call(db.getUsers(), user);
          }
        }
      } catch (e) {
        console.warn('[AUTH] Direct Atlas admin query warning:', e.message);
      }
    }

    if (!user) {
      const err = new Error('INVALID ADMIN CREDENTIALS');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Strict Argon2id password verification using exact user-entered password
    const isValid = await this.verifyPassword(rawPassword, user.password_hash);
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

    // Strict Role Verification: Must explicitly be ADMIN or SUPER_ADMIN
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
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

    // Cryptographic Password Validation using Argon2id
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

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        callsign: user.callsign,
        affiliation: user.affiliation,
        team_id: user.team_id,
        team: userTeam ? { id: userTeam.id, name: userTeam.name, score: userTeam.total_score } : null
      }
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

  getMe(userId) {
    const user = db.getUsers().find(u => u.id === userId);
    if (!user) return null;

    const team = db.getTeams().find(t => t.id === user.team_id);
    const userSolves = db.getSolves().filter(s => s.user_id === user.id);

    // Derive member role from team_members collection
    let teamRole = null;
    if (team) {
      const memberRecord = db.getTeamMembers().find(m => m.user_id === user.id && m.team_id === team.id);
      teamRole = memberRecord?.role || (team.captain_id === user.id ? 'CAPTAIN' : 'MEMBER');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callsign: user.callsign,
      affiliation: user.affiliation,
      team_id: user.team_id,
      team: team ? {
        id: team.id,            // XPX-TEAM-000001 (the public display ID)
        teamId: team.id,        // alias for clarity in frontend
        name: team.name,
        slug: team.slug,
        score: team.total_score,
        solvesCount: team.solves_count,
        firstBloods: team.first_bloods,
        memberCount: team.member_count,
        role: teamRole,
        accessCode: teamRole === 'CAPTAIN' ? team.access_code : undefined
      } : null,
      solvesCount: userSolves.length,
      totalPoints: userSolves.reduce((acc, s) => acc + s.points_awarded, 0)
    };
  }
}

module.exports = new AuthService();
