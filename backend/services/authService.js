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
const db = require('../config/database');

class AuthService {
  /**
   * Cryptographically hash password with random salt using scrypt
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derivedKey}`;
  }

  /**
   * Timing-safe verification of password against stored hash
   */
  verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    // Support salt:derivedKey format
    if (storedHash.includes(':')) {
      const [salt, key] = storedHash.split(':');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const keyBuffer = Buffer.from(key, 'hex');
      if (keyBuffer.length !== derivedKey.length) return false;
      return crypto.timingSafeEqual(keyBuffer, derivedKey);
    }
    // Fallback for plain setup strings
    return password === storedHash;
  }

  /**
   * Sign authentication session token using HMAC-SHA256
   */
  generateToken(userId, username) {
    const timestamp = Date.now();
    const payload = `${userId}:${username}:${timestamp}`;
    const secret = process.env.JWT_SECRET || 'c2_command_jwt_super_secret_key_change_in_production';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}:${signature}`;
  }

  login(usernameOrEmail, password) {
    const term = (usernameOrEmail || '').trim().toLowerCase();
    const user = db.getUsers().find(u =>
      (u && u.username && u.username.toLowerCase() === term) ||
      (u && u.email && u.email.toLowerCase() === term)
    );

    if (!user) {
      throw new Error('Invalid operative callsign or passphrase.');
    }

    if (user.is_banned) {
      throw new Error('OPERATIVE ACCOUNT TERMINATED BY C2 COMMAND.');
    }

    // Cryptographic Password Validation
    if (!this.verifyPassword(password, user.password_hash)) {
      throw new Error('Invalid operative callsign or passphrase.');
    }

    const token = this.generateToken(user.id, user.username);
    const userTeam = db.getTeams().find(t => t.id === user.team_id);

    // Record session
    db.getSessions().push({
      id: crypto.randomUUID(),
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });

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

  register({ username, email, password, callsign, affiliation }) {
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Callsign/Username must be at least 3 characters.');
    }

    if (!password || password.length < 6) {
      throw new Error('Passphrase must be at least 6 characters.');
    }

    const exists = db.getUsers().find(u =>
      (u && u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()) ||
      (u && u.email && u.email.toLowerCase() === cleanEmail)
    );
    if (exists) {
      throw new Error('Operative with this username or email already registered in system registry.');
    }

    const passwordHash = this.hashPassword(password);
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

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      callsign: user.callsign,
      affiliation: user.affiliation,
      team_id: user.team_id,
      team: team ? {
        id: team.id,
        name: team.name,
        slug: team.slug,
        score: team.total_score,
        solvesCount: team.solves_count,
        firstBloods: team.first_bloods,
        accessCode: team.access_code
      } : null,
      solvesCount: userSolves.length,
      totalPoints: userSolves.reduce((acc, s) => acc + s.points_awarded, 0)
    };
  }
}

module.exports = new AuthService();
