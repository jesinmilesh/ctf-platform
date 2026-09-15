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

    const user = db.getUsers().find(u => u.id === validUserId);
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
