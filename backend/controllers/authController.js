/**
 * XPLOITX // CYBER BATTLEFIELD
 * Auth Controller (backend/controllers/authController.js)
 */

const db = require('../config/database');
const authService = require('../services/authService');
const auditService = require('../services/auditService');
const auditLogger = require('../services/auditLogger');

exports.adminLogin = async (req, res, next) => {
  req.body.adminOnly = true;
  return exports.login(req, res, next);
};

exports.login = async (req, res, next) => {
  const username = req.body.username || req.body.identifier || req.body.email;
  const password = req.body.password;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Callsign and password required.' });
    }
    const result = await authService.login(username, password);

    const isAdmin = result.user.role === 'ADMIN' || result.user.role === 'SUPER_ADMIN';
    const adminOnly = req.body.adminOnly === true || req.headers['x-admin-portal'] === 'true' || (req.originalUrl && req.originalUrl.includes('/admin-login'));

    if (adminOnly && !isAdmin) {
      auditService.record({
        action: 'AUTH.ADMIN_ACCESS_DENIED',
        category: 'AUTH',
        severity: 'WARNING',
        actor: result.user,
        resource: { type: 'USER', id: result.user.id },
        result: 'DENIED',
        description: `Participant operative ${result.user.username} rejected from C2 Command Center portal`,
        request: { requestId: req.id, method: req.method, route: req.originalUrl },
        network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
        metadata: { role: result.user.role }
      }).catch(() => {});

      if (typeof authService.revokeToken === 'function') {
        authService.revokeToken(result.token);
      }
      res.clearCookie('xploitx_token');

      return res.status(403).json({
        error: 'CLEARANCE_DENIED',
        message: 'Clearance denied. Administrative privileges required to access the C2 Operations Center.'
      });
    }

    auditService.record({
      action: isAdmin ? 'AUTH.ADMIN_LOGIN' : 'AUTH.LOGIN_SUCCESS',
      category: 'AUTH',
      severity: 'INFO',
      actor: result.user,
      resource: { type: 'USER', id: result.user.id },
      result: 'SUCCESS',
      description: `${isAdmin ? 'Administrator' : 'Operative'} ${result.user.username} authenticated successfully`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { role: result.user.role, teamId: result.user.team_id || null }
    }).catch(() => {});

    // Set secure cookie as requested in blueprint
    res.cookie('xploitx_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    res.json(result);
  } catch (err) {
    auditService.record({
      action: 'AUTH.LOGIN_FAILED',
      category: 'AUTH',
      severity: 'WARNING',
      actor: { type: 'USER', username: String(username || 'unknown').slice(0, 64) },
      resource: { type: 'USER', id: String(username || 'unknown').slice(0, 64) },
      result: 'FAILURE',
      description: `Authentication failed for identifier: ${String(username || 'unknown').slice(0, 64)}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { reason: err.message }
    }).catch(() => {});

    res.status(401).json({ error: 'AUTH_FAILED', message: err.message });
  }
};

exports.register = async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
  try {
    const result = await authService.register(req.body);

    auditService.record({
      action: 'AUTH.USER_REGISTERED',
      category: 'AUTH',
      severity: 'INFO',
      actor: result.user,
      resource: { type: 'USER', id: result.user.id },
      result: 'SUCCESS',
      description: `New operative registered: ${result.user.username}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { role: result.user.role, affiliation: result.user.affiliation }
    }).catch(() => {});

    res.cookie('xploitx_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
};

exports.getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED', message: 'No active session' });
    }
    const profile = authService.getMe(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User record not found' });
    }
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  const ip = req.headers ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1') : '127.0.0.1';
  const token = req.headers?.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : req.cookies?.['xploitx_token'];

  if (token) {
    authService.revokeToken(token);
    const sessions = db.getSessions ? db.getSessions() : [];
    const idx = sessions.findIndex(s => s.token === token);
    if (idx !== -1) {
      sessions.splice(idx, 1);
    }
  }

  if (req.user) {
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';
    auditService.record({
      action: isAdmin ? 'AUTH.ADMIN_LOGOUT' : 'AUTH.LOGOUT',
      category: 'AUTH',
      severity: 'INFO',
      actor: req.user,
      resource: { type: 'USER', id: req.user.id },
      result: 'SUCCESS',
      description: `${isAdmin ? 'Administrator' : 'Operative'} ${req.user.username} logged out`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null }
    }).catch(() => {});
  }

  res.clearCookie('xploitx_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.json({ success: true, message: 'Operative signed off' });
};
