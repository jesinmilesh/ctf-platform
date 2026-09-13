/**
 * XPLOITX // CYBER BATTLEFIELD
 * Role-Based Access Control (backend/middleware/roles.js)
 */

const ROLE_HIERARCHY = {
  PLAYER: 1,
  AUTHOR: 2,
  MODERATOR: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5
};

function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 99;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Clearance level [${minimumRole}] required. Current operative role: [${req.user.role}]`
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requireRole('ADMIN'),
  requireAuthor: requireRole('AUTHOR'),
  requireModerator: requireRole('MODERATOR')
};
