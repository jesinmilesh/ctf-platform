/**
 * XPLOITX // CYBER BATTLEFIELD
 * Auth Controller (backend/controllers/authController.js)
 */

const db = require('../config/database');
const authService = require('../services/authService');
const auditService = require('../services/auditService');
const auditLogger = require('../services/auditLogger');

exports.adminLogin = async (req, res, next) => {
  const username = req.body.username || req.body.identifier || req.body.email;
  const password = req.body.password;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'INVALID ADMIN CREDENTIALS'
      });
    }

    const result = await authService.adminLogin(username, password);

    auditService.record({
      action: 'AUTH.ADMIN_LOGIN_SUCCESS',
      category: 'AUTH',
      severity: 'INFO',
      actor: result.user,
      resource: { type: 'PORTAL', id: 'ADMIN_C2' },
      result: 'SUCCESS',
      description: `Administrator ${result.user.username} authenticated successfully`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { role: result.user.role }
    }).catch(() => {});

    // Set cookie for browser navigation protection
    res.cookie('xploitx_token', result.token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 3600 * 1000
    });

    return res.json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (err) {
    const isClearanceDenied = err.code === 'CLEARANCE_DENIED' || err.message === 'ADMIN ACCESS REQUIRED';
    const isInactive = err.code === 'ACCOUNT_INACTIVE';

    auditService.record({
      action: isClearanceDenied ? 'AUTH.ADMIN_ACCESS_DENIED' : 'AUTH.ADMIN_LOGIN_FAILURE',
      category: 'AUTH',
      severity: isClearanceDenied ? 'WARNING' : 'HIGH',
      actor: { type: 'USER', username: String(username || 'unknown').slice(0, 64) },
      resource: { type: 'PORTAL', id: 'ADMIN_C2' },
      result: 'FAILURE',
      description: isClearanceDenied
        ? `Participant ${username} denied access to C2 admin portal: ADMIN ACCESS REQUIRED`
        : `Admin authentication failed for identifier: ${String(username || 'unknown').slice(0, 64)}`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { reason: err.message, code: err.code }
    }).catch(() => {});

    if (isClearanceDenied) {
      return res.status(403).json({
        success: false,
        error: 'CLEARANCE_DENIED',
        message: 'ADMIN ACCESS REQUIRED'
      });
    }

    if (isInactive) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_INACTIVE',
        message: 'ADMIN ACCOUNT IS SUSPENDED OR INACTIVE'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'INVALID ADMIN CREDENTIALS'
    });
  }
};

exports.login = async (req, res, next) => {
  const username = req.body.username || req.body.identifier || req.body.email;
  const password = req.body.password;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Callsign and password required.' });
    }
    const result = await authService.login(username, password);

    const isAdmin = result.user.role === 'ADMIN';
    const adminOnly = req.body.adminOnly === true || req.headers['x-admin-portal'] === 'true' || (req.originalUrl && (req.originalUrl.includes('/admin-login') || req.originalUrl.includes('/admin/auth/login')));

    if (adminOnly && !isAdmin) {
      if (typeof authService.revokeToken === 'function') {
        authService.revokeToken(result.token);
      }

      return res.status(403).json({
        success: false,
        error: 'CLEARANCE_DENIED',
        message: 'ADMIN ACCESS REQUIRED'
      });
    }

    auditService.record({
      action: 'AUTH.LOGIN_SUCCESS',
      category: 'AUTH',
      severity: 'INFO',
      actor: result.user,
      resource: { type: 'USER', id: result.user.id },
      result: 'SUCCESS',
      description: `Operative ${result.user.username} authenticated successfully`,
      request: { requestId: req.id, method: req.method, route: req.originalUrl },
      network: { ip, userAgent: req.headers ? req.headers['user-agent'] : null },
      metadata: { role: result.user.role, teamId: result.user.team_id || null }
    }).catch(() => {});

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
    const profile = await authService.getMe(req.user.id);
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
    : (req.cookies?.['xploitx_token'] || null);

  if (token) {
    authService.revokeToken(token);
    const sessions = db.getSessions ? db.getSessions() : [];
    const idx = sessions.findIndex(s => s.token === token);
    if (idx !== -1) {
      sessions.splice(idx, 1);
    }
  }

  res.clearCookie('xploitx_token', { path: '/' });

  if (req.user) {
    const isAdmin = req.user.role === 'ADMIN';
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

  res.json({ success: true, message: 'Operative signed off' });
};
