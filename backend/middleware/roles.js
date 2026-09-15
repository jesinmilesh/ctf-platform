/**
 * XPLOITX // CYBER BATTLEFIELD
 * Role-Based Access Control & Permissions (backend/middleware/roles.js)
 * Implements Section 11: Strict server-side RBAC & Permission Enforcement
 */

const db = require('../config/database');
const auditService = require('../services/auditService');

const ROLE_HIERARCHY = {
  PLAYER: 1,
  TEAM_CAPTAIN: 2,
  CHALLENGE_AUTHOR: 3,
  AUTHOR: 3,
  MODERATOR: 4,
  ADMIN: 5,
  SUPER_ADMIN: 6
};

const PERMISSIONS = {
  'challenge.submit': ['PLAYER', 'TEAM_CAPTAIN', 'CHALLENGE_AUTHOR', 'AUTHOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  'instance.spawn': ['PLAYER', 'TEAM_CAPTAIN', 'CHALLENGE_AUTHOR', 'AUTHOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  'team.manage': ['TEAM_CAPTAIN', 'ADMIN', 'SUPER_ADMIN'],
  'challenge.create': ['CHALLENGE_AUTHOR', 'AUTHOR', 'ADMIN', 'SUPER_ADMIN'],
  'challenge.edit': ['CHALLENGE_AUTHOR', 'AUTHOR', 'ADMIN', 'SUPER_ADMIN'],
  'challenge.publish': ['ADMIN', 'SUPER_ADMIN'],
  'challenge.delete': ['ADMIN', 'SUPER_ADMIN'],
  'admin.access': ['ADMIN', 'SUPER_ADMIN'],
  'user.ban': ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'],
  'system.config': ['SUPER_ADMIN']
};

function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    // Always fetch fresh authoritative role from database
    const freshUser = db.getUsers().find(u => u.id === req.user.id);
    const activeRole = freshUser ? freshUser.role : req.user.role;

    const userLevel = ROLE_HIERARCHY[activeRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 99;

    if (userLevel < requiredLevel) {
      const isAdminRoute = minimumRole === 'ADMIN' || minimumRole === 'SUPER_ADMIN';
      auditService.record({
        action: isAdminRoute ? 'SECURITY.FORBIDDEN_ADMIN_ACCESS' : 'SECURITY.FORBIDDEN_RESOURCE_ACCESS',
        category: 'SECURITY',
        severity: 'HIGH',
        actor: req.user,
        resource: { type: 'ROUTE', id: req.originalUrl },
        result: 'DENIED',
        description: `Clearance level [${minimumRole}] required, but operative held [${activeRole}]`,
        request: { requestId: req.id, method: req.method, route: req.originalUrl },
        network: { ip: req.ip || '127.0.0.1', userAgent: req.headers ? req.headers['user-agent'] : null },
        metadata: { requiredRole: minimumRole, activeRole }
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Clearance level [${minimumRole}] required. Current operative role: [${activeRole}]`
        }
      });
    }

    req.user.role = activeRole;
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const freshUser = db.getUsers().find(u => u.id === req.user.id);
    const activeRole = freshUser ? freshUser.role : req.user.role;

    const allowedRoles = PERMISSIONS[permission] || ['ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(activeRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission [${permission}] denied for operative role [${activeRole}].`
        }
      });
    }

    req.user.role = activeRole;
    next();
  };
}

module.exports = {
  requireRole,
  requirePermission,
  requireAdmin: requireRole('ADMIN'),
  requireAuthor: requireRole('AUTHOR'),
  requireModerator: requireRole('MODERATOR'),
  requireSuperAdmin: requireRole('SUPER_ADMIN'),
  ROLE_HIERARCHY,
  PERMISSIONS
};
