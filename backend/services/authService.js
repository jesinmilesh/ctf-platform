/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication Service (backend/services/authService.js)
 */

const db = require('../config/database');

class AuthService {
  login(usernameOrEmail, password) {
    const term = (usernameOrEmail || '').trim().toLowerCase();
    const user = db.getUsers().find(u =>
      (u.username.toLowerCase() === term || u.email.toLowerCase() === term)
    );

    if (!user) {
      throw new Error('Operative callsign or email not recognized.');
    }

    if (user.is_banned) {
      throw new Error('OPERATIVE ACCOUNT TERMINATED BY C2 COMMAND.');
    }

    // Password validation
    if (user.password_hash !== password) {
      throw new Error('Access denied: Invalid biometric/cryptographic passphrase.');
    }

    const token = `${user.id}:${user.username}:${Date.now()}`;
    const userTeam = db.getTeams().find(t => t.id === user.team_id);

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

    const exists = db.getUsers().find(u =>
      u.username.toLowerCase() === cleanUsername.toLowerCase() || u.email.toLowerCase() === cleanEmail
    );
    if (exists) {
      throw new Error('Operative with this username or email already registered in system registry.');
    }

    const newUser = {
      id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      competition_id: db.getCompetitions()[0]?.id,
      team_id: null,
      username: cleanUsername,
      email: cleanEmail,
      password_hash: password,
      role: 'PLAYER',
      callsign: (callsign || cleanUsername).toUpperCase(),
      affiliation: affiliation || 'Independent',
      is_banned: false,
      created_at: new Date().toISOString()
    };

    db.getUsers().push(newUser);

    const token = `${newUser.id}:${newUser.username}:${Date.now()}`;
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
