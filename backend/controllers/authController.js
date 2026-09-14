/**
 * XPLOITX // CYBER BATTLEFIELD
 * Auth Controller (backend/controllers/authController.js)
 */

const authService = require('../services/authService');

exports.login = async (req, res, next) => {
  try {
    const username = req.body.username || req.body.identifier;
    const password = req.body.password;
    if (!username || !password) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Callsign and password required.' });
    }
    const result = await authService.login(username, password);

    // Set secure cookie as requested in blueprint
    res.cookie('xploitx_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000
    });

    res.json(result);
  } catch (err) {
    res.status(401).json({ error: 'AUTH_FAILED', message: err.message });
  }
};

exports.register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

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
  res.clearCookie('xploitx_token');
  res.json({ success: true, message: 'Operative signed off' });
};
