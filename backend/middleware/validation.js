/**
 * XPLOITX // CYBER BATTLEFIELD
 * Central Request Validation & Security Shield (backend/middleware/validation.js)
 * Implements Sections 10, 11, 12, 13, 14, 15, 16, 52, 53, 54, 55 of Architectural Specification:
 * - Strict ObjectId and ID format validation
 * - Pagination clamping (limits <= 100, page >= 1)
 * - Mass assignment protection on database-controlled fields (role, score, permissions, etc.)
 * - ReDoS / Regex special character escaping
 * - Aggregation pipeline stage injection blocking
 */

const DANGEROUS_AGGREGATION_KEYS = new Set([
  '$lookup', '$match', '$group', '$aggregate', '$unionWith',
  '$graphLookup', '$facet', '$unwind', '$replaceRoot', '$out', '$merge'
]);

const FORBIDDEN_MASS_ASSIGNMENT_FIELDS = new Set([
  'role', 'roles', 'isAdmin', 'is_admin', 'score', 'total_score', 'points',
  'points_awarded', 'first_bloods', 'solves_count', 'is_first_blood',
  'is_banned', 'banned', 'permissions', 'verified', 'is_verified',
  'containerId', 'container_id', 'port', 'hostPort', 'host_port',
  'password_hash', 'passwordHash', 'mfa_secret', 'mfaSecret'
]);

// Valid ID format: UUID, 24-char hex ObjectId, or strict slug/callsign identifier
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{2,64}$/;

/**
 * Validate route ID parameters (e.g., :id, :challengeId, :teamId)
 * Rejects objects, arrays, MongoDB operators, or injection characters
 */
function validateIdParam(...paramNames) {
  const targets = paramNames.length > 0 ? paramNames : ['id'];
  return (req, res, next) => {
    for (const param of targets) {
      const val = req.params[param];
      if (val !== undefined && val !== null) {
        if (typeof val !== 'string' || !SAFE_ID_REGEX.test(val.trim())) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_IDENTIFIER',
              message: `Identifier parameter '${param}' contains an invalid format or unauthorized characters.`
            },
            requestId: req.id || 'req-unknown'
          });
        }
      }
    }
    next();
  };
}

/**
 * Server-side pagination clamping
 * Prevents requests for 999999999 items causing memory/CPU exhaustion
 */
function paginationValidator(req, res, next) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100; // Enforce hard maximum limit of 100

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };
  next();
}

/**
 * Mass assignment shield
 * Blocks participants from modifying system-controlled fields
 */
function massAssignmentShield(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  const isAdmin = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  if (isAdmin) {
    return next(); // Administrators have elevated management clearance
  }

  // Check for privileged field modification attempts
  for (const field of Object.keys(req.body)) {
    if (FORBIDDEN_MASS_ASSIGNMENT_FIELDS.has(field)) {
      delete req.body[field]; // Strip unauthorized fields
    }
  }

  next();
}

/**
 * Aggregation pipeline injection shield
 * Blocks client-submitted aggregation pipeline stages
 */
function aggregationShield(req, res, next) {
  const check = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (DANGEROUS_AGGREGATION_KEYS.has(key)) return true;
      if (typeof obj[key] === 'object' && check(obj[key])) return true;
    }
    return false;
  };

  if (check(req.body) || check(req.query)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INJECTION_DETECTED',
        message: 'Direct MongoDB aggregation pipeline parameters are forbidden.'
      },
      requestId: req.id || 'req-unknown'
    });
  }
  next();
}

/**
 * Safely escape regex characters for text search
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

module.exports = {
  validateIdParam,
  paginationValidator,
  massAssignmentShield,
  aggregationShield,
  escapeRegex,
  SAFE_ID_REGEX
};
