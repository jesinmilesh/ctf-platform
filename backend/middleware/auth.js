/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication Middleware (backend/middleware/auth.js)
 */

const db = require('../config/database');

function authMiddleware(req, res, next) {
  let token = null;

  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Cookie fallback
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const [k, v] = c.trim().split('=');
      acc[k] = v;
      return acc;
    }, {});
    token = cookies['xploitx_token'];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  // Simple token decoding (supports mock token or payload format `uid:username`)
  try {
    let userId = token;
    if (token.includes(':')) {
      userId = token.split(':')[0];
    }

    const user = db.getUsers().find(u => u.id === userId || u.username === userId || u.callsign === userId);
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

module.exports = { authMiddleware, requireAuth };
