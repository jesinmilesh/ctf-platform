/**
 * XPLOITX // CYBER BATTLEFIELD
 * Centralized Audit Log & Security Telemetry Service (backend/services/auditService.js)
 *
 * Implements Sections 3-17, 19-28, 30-38 of Master Specification:
 * - Centralized immutable security audit trail
 * - Strict secret redaction on all payloads
 * - Rich structured schema (actor, action, resource, result, severity, request correlation)
 * - Server-side indexed search, filtering, pagination, and sorting
 * - Real-time WebSocket telemetry broadcast
 * - Safe export pipeline (CSV / JSON)
 * - Zero fake/placeholder metrics
 */

const crypto = require('crypto');
const db = require('../config/database');
const realtimeService = require('./realtimeService');

// Allowlisted Severity Levels
const SEVERITY_LEVELS = ['INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL'];
const SEVERITY_WEIGHTS = {
  CRITICAL: 5,
  HIGH: 4,
  WARNING: 3,
  NOTICE: 2,
  INFO: 1
};

// Allowlisted Categories
const CATEGORIES = new Set([
  'AUTH', 'USER', 'TEAM', 'CHALLENGE', 'FILE', 'HINT',
  'SUBMISSION', 'INSTANCE', 'SCORE', 'ANNOUNCEMENT',
  'ADMIN', 'SECURITY', 'SYSTEM', 'MODERATION'
]);

// Sensitive keys strictly forbidden from entering logs
const SENSITIVE_KEYS = [
  'password', 'passphrase', 'password_hash', 'passwordhash',
  'flag', 'submittedflag', 'submitted_flag', 'flag_value',
  'token', 'jwt', 'secret', 'mfa_secret', 'mfasecret',
  'otp', 'totp', 'apikey', 'api_key', 'authorization',
  'cookie', 'mongodb_uri', 'database_url', 'redis_url'
];

class AuditService {
  /**
   * Deeply sanitize an object to strip all passwords, tokens, and flag secrets
   */
  sanitizeMetadata(input, depth = 0) {
    if (depth > 5 || input === null || input === undefined) return input;
    if (typeof input !== 'object') return input;

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeMetadata(item, depth + 1));
    }

    const clean = {};
    for (const [key, val] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk));
      if (isSensitive) {
        clean[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        clean[key] = this.sanitizeMetadata(val, depth + 1);
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  /**
   * Primary entrypoint: Record a structured audit event
   */
  async record({
    action,
    category = 'SYSTEM',
    severity = 'INFO',
    actor = null,
    resource = null,
    result = 'SUCCESS',
    description = '',
    metadata = {},
    req = null,
    requestId = null,
    ip = null,
    userAgent = null
  }) {
    if (!action) return null;

    try {
      const cleanAction = String(action).toUpperCase().trim();
      const cleanCategory = CATEGORIES.has(String(category).toUpperCase())
        ? String(category).toUpperCase()
        : 'SYSTEM';

      const cleanSeverity = SEVERITY_LEVELS.includes(String(severity).toUpperCase())
        ? String(severity).toUpperCase()
        : 'INFO';

      const cleanResult = ['SUCCESS', 'FAILURE', 'DENIED'].includes(String(result).toUpperCase())
        ? String(result).toUpperCase()
        : 'SUCCESS';

      // 1. Resolve Request Metadata
      const effectiveReqId = requestId || (req && (req.id || req.headers?.['x-request-id'])) || null;
      const effectiveIp = ip || (req && (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress)) || '127.0.0.1';
      const effectiveUserAgent = userAgent || (req && req.headers?.['user-agent']) || null;
      const reqMethod = req ? req.method : null;
      const reqRoute = req ? (req.originalUrl || req.url) : null;

      // 2. Resolve Actor
      let actorType = 'USER';
      let userId = null;
      let username = 'anonymous';
      let role = 'GUEST';
      let teamId = null;
      let teamName = null;

      if (actor) {
        actorType = actor.type || 'USER';
        userId = actor.userId || actor.id || null;
        username = actor.username || actor.name || 'anonymous';
        role = actor.role || 'GUEST';
        teamId = actor.teamId || actor.team_id || null;
        teamName = actor.teamName || actor.team_name || null;
      } else if (req && req.user) {
        actorType = 'USER';
        userId = req.user.id || (req.user._id ? String(req.user._id) : null);
        username = req.user.username || 'unknown';
        role = req.user.role || 'PLAYER';
        teamId = req.user.team_id || (req.user.team && req.user.team.id) || null;
        teamName = (req.user.team && req.user.team.name) || null;
      }

      // 3. Resolve Target Resource
      let resType = 'GENERAL';
      let resId = null;
      let resName = null;

      if (resource) {
        resType = (resource.type || 'GENERAL').toUpperCase();
        resId = resource.id ? String(resource.id) : null;
        resName = resource.name || null;
      }

      // 4. Sanitize and Bound Metadata
      const safeMetadata = this.sanitizeMetadata(metadata || {});

      // 5. Build Canonical Record
      const id = crypto.randomUUID();
      const eventId = `evt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date();

      const record = {
        id,
        eventId,
        timestamp: now.toISOString(),
        actor: {
          type: actorType,
          userId,
          username,
          role,
          teamId,
          teamName
        },
        action: cleanAction,
        category: cleanCategory,
        severity: cleanSeverity,
        resource: {
          type: resType,
          id: resId,
          name: resName
        },
        result: cleanResult,
        description: description || `${cleanAction} executed on ${resType}${resId ? ` (${resId})` : ''}`,
        request: {
          requestId: effectiveReqId,
          method: reqMethod,
          route: reqRoute
        },
        network: {
          ip: effectiveIp,
          userAgent: effectiveUserAgent
        },
        metadata: safeMetadata,

        // Legacy compatibility mappings
        user_id: userId,
        actor_id: userId,
        resource_type: resType,
        resource_id: resId,
        target: resName ? `${resType}:${resName}` : (resId ? `${resType}:${resId}` : resType),
        ip_address: effectiveIp,
        request_id: effectiveReqId,
        details: safeMetadata,
        created_at: now.toISOString()
      };

      // 6. Push to Database Storage
      const logs = db.getAuditLogs ? db.getAuditLogs() : [];
      logs.push(record);

      if (db.isMongo && db.persistDoc) {
        db.persistDoc('auditLogs', record).catch(err => {
          console.warn('[AUDIT SERVICE] Atlas persist error (non-fatal):', err.message);
        });
      }

      // 7. Real-Time Telemetry Broadcast to Admin C2
      realtimeService.broadcastAdminEvent('audit.created', record).catch(() => {});

      return record;
    } catch (err) {
      console.error('[AUDIT SERVICE ERROR] Failed to record audit log:', err.message);
      return null;
    }
  }

  /**
   * Fast alias for controllers: auditService.log(opts)
   */
  async log(opts) {
    return this.record(opts);
  }

  /**
   * Query & filter audit logs with pagination and search
   */
  queryLogs({
    page = 1,
    limit = 50,
    search = '',
    category = '',
    action = '',
    severity = '',
    result = '',
    actorType = '',
    userId = '',
    teamId = '',
    resourceType = '',
    resourceId = '',
    requestId = '',
    timeRange = '',
    startDate = '',
    endDate = '',
    sortBy = 'newest'
  }) {
    let logs = [...(db.getAuditLogs ? db.getAuditLogs() : [])];

    // 1. Time Range / Date Filtering
    let startMs = null;
    let endMs = null;

    if (startDate) startMs = new Date(startDate).getTime();
    if (endDate) endMs = new Date(endDate).getTime();

    if (timeRange) {
      const now = Date.now();
      if (timeRange === '15m') startMs = now - 15 * 60 * 1000;
      else if (timeRange === '1h') startMs = now - 60 * 60 * 1000;
      else if (timeRange === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startMs = d.getTime();
      } else if (timeRange === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(0, 0, 0, 0);
        startMs = d.getTime();
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        endMs = end.getTime();
      } else if (timeRange === '7d') startMs = now - 7 * 24 * 60 * 60 * 1000;
      else if (timeRange === '30d') startMs = now - 30 * 24 * 60 * 60 * 1000;
    }

    if (startMs !== null) {
      logs = logs.filter(l => new Date(l.timestamp || l.created_at).getTime() >= startMs);
    }
    if (endMs !== null) {
      logs = logs.filter(l => new Date(l.timestamp || l.created_at).getTime() <= endMs);
    }

    // 2. Facet Filters
    if (category && category !== 'ALL') {
      const cUpper = category.toUpperCase();
      logs = logs.filter(l => (l.category || '').toUpperCase() === cUpper);
    }

    if (action && action !== 'ALL') {
      const aUpper = action.toUpperCase();
      logs = logs.filter(l => (l.action || '').toUpperCase() === aUpper);
    }

    if (severity && severity !== 'ALL') {
      const sUpper = severity.toUpperCase();
      logs = logs.filter(l => (l.severity || '').toUpperCase() === sUpper);
    }

    if (result && result !== 'ALL') {
      const rUpper = result.toUpperCase();
      logs = logs.filter(l => (l.result || '').toUpperCase() === rUpper);
    }

    if (actorType && actorType !== 'ALL') {
      const atUpper = actorType.toUpperCase();
      logs = logs.filter(l => (l.actor?.type || '').toUpperCase() === atUpper);
    }

    if (userId) {
      const uClean = String(userId).trim();
      logs = logs.filter(l => (l.actor?.userId === uClean || l.user_id === uClean));
    }

    if (teamId) {
      const tClean = String(teamId).trim();
      logs = logs.filter(l => (l.actor?.teamId === tClean));
    }

    if (resourceType && resourceType !== 'ALL') {
      const rtUpper = resourceType.toUpperCase();
      logs = logs.filter(l => (l.resource?.type || l.resource_type || '').toUpperCase() === rtUpper);
    }

    if (resourceId) {
      const rClean = String(resourceId).trim();
      logs = logs.filter(l => (l.resource?.id === rClean || l.resource_id === rClean));
    }

    if (requestId) {
      const reqClean = String(requestId).trim();
      logs = logs.filter(l => (l.request?.requestId === reqClean || l.request_id === reqClean));
    }

    // 3. Text Search
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      logs = logs.filter(l => {
        const uname = l.actor?.username || l.actor || '';
        const act = l.action || '';
        const desc = l.description || '';
        const rType = l.resource?.type || l.resource_type || '';
        const rId = l.resource?.id || l.resource_id || '';
        const rName = l.resource?.name || '';
        const ipStr = l.network?.ip || l.ip_address || '';
        const reqStr = l.request?.requestId || l.request_id || '';
        const evId = l.eventId || l.id || '';

        return uname.toLowerCase().includes(term) ||
               act.toLowerCase().includes(term) ||
               desc.toLowerCase().includes(term) ||
               rType.toLowerCase().includes(term) ||
               rId.toLowerCase().includes(term) ||
               rName.toLowerCase().includes(term) ||
               ipStr.includes(term) ||
               reqStr.toLowerCase().includes(term) ||
               evId.toLowerCase().includes(term);
      });
    }

    // 4. Sorting
    if (sortBy === 'oldest') {
      logs.sort((a, b) => new Date(a.timestamp || a.created_at) - new Date(b.timestamp || b.created_at));
    } else if (sortBy === 'severity') {
      logs.sort((a, b) => {
        const weightA = SEVERITY_WEIGHTS[a.severity] || 1;
        const weightB = SEVERITY_WEIGHTS[b.severity] || 1;
        if (weightB !== weightA) return weightB - weightA;
        return new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at);
      });
    } else {
      // Default: newest first
      logs.sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at));
    }

    // 5. Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const total = logs.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedLogs = logs.slice(startIndex, startIndex + limitNum);

    return {
      logs: paginatedLogs,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };
  }

  /**
   * Real Security & Activity Dashboard Counters
   * Zero fake numbers; all derived from authoritative database records
   */
  getDashboardStats() {
    const logs = db.getAuditLogs ? db.getAuditLogs() : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const todayLogs = logs.filter(l => new Date(l.timestamp || l.created_at).getTime() >= todayMs);

    const securityEventsToday = todayLogs.filter(l =>
      l.category === 'SECURITY' ||
      ['HIGH', 'CRITICAL'].includes(l.severity) ||
      l.result === 'DENIED' ||
      (l.action && (l.action.includes('ATTEMPT') || l.action.includes('LOCKOUT') || l.action.includes('INJECTION')))
    ).length;

    const failedLoginsToday = todayLogs.filter(l =>
      l.action === 'AUTH.LOGIN_FAILED' || l.action === 'LOGIN_FAILED'
    ).length;

    const authDenialsToday = todayLogs.filter(l =>
      l.result === 'DENIED' ||
      (l.action && l.action.includes('FORBIDDEN'))
    ).length;

    const suspiciousRequestsToday = todayLogs.filter(l =>
      l.action && (
        l.action.includes('NO_SQL_INJECTION') ||
        l.action.includes('PATH_TRAVERSAL') ||
        l.action.includes('IDOR') ||
        l.action.includes('RATE_LIMIT')
      )
    ).length;

    const instanceFailuresToday = todayLogs.filter(l =>
      l.category === 'INSTANCE' && (l.result === 'FAILURE' || (l.action && l.action.includes('FAILED')))
    ).length;

    const adminActionsToday = todayLogs.filter(l =>
      l.category === 'ADMIN' || (l.actor && l.actor.role === 'ADMIN')
    ).length;

    const participantActionsToday = todayLogs.filter(l =>
      l.actor && ['USER', 'PLAYER'].includes(l.actor.role)
    ).length;

    return {
      totalEventsToday: todayLogs.length,
      securityEventsToday,
      securityEvents: securityEventsToday,
      failedLoginsToday,
      failedLogins: failedLoginsToday,
      authDenialsToday,
      authDenials: authDenialsToday,
      suspiciousRequestsToday,
      suspiciousRequests: suspiciousRequestsToday,
      instanceFailuresToday,
      instanceFailures: instanceFailuresToday,
      adminActionsToday,
      adminActions: adminActionsToday,
      participantActionsToday,
      playerActions: participantActionsToday,
      totalHistoricalLogs: logs.length
    };
  }

  /**
   * Find single log event by ID or eventId
   */
  getEventById(idOrEventId) {
    if (!idOrEventId) return null;
    const cleanId = String(idOrEventId).trim();
    const logs = db.getAuditLogs ? db.getAuditLogs() : [];
    return logs.find(l => l.id === cleanId || l.eventId === cleanId) || null;
  }

  async exportLogs(filterParams = {}, format = 'csv', actor = null, requestId = null, ip = '127.0.0.1') {
    const queryResult = this.queryLogs({ ...filterParams, page: 1, limit: 10000 });
    const logs = queryResult.logs || [];
    const fmt = (format || 'csv').toLowerCase();

    // Record self-audit event (Section 26: Every export should itself create an audit event: AUDIT_LOG_EXPORTED)
    this.record({
      action: 'ADMIN.AUDIT_LOG_EXPORTED',
      category: 'ADMIN',
      severity: 'NOTICE',
      actor,
      resource: { type: 'AUDIT_LOG', id: 'EXPORT' },
      result: 'SUCCESS',
      description: `Audit log exported in ${fmt.toUpperCase()} format (${logs.length} records)`,
      request: { requestId, method: 'GET', route: '/api/v1/admin/audit-logs/export' },
      network: { ip },
      metadata: { format: fmt, count: logs.length }
    }).catch(() => {});

    if (fmt === 'json') {
      return {
        contentType: 'application/json',
        filename: `xploitx_audit_export_${Date.now()}.json`,
        data: JSON.stringify(logs, null, 2)
      };
    }

    // CSV format generator
    const headers = [
      'EventID', 'Timestamp', 'Actor', 'Role', 'Action', 'Category',
      'Severity', 'ResourceType', 'ResourceID', 'Result', 'Description', 'IP', 'RequestID'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map(l => [
      escapeCsv(l.eventId || l.id),
      escapeCsv(l.timestamp || l.created_at),
      escapeCsv(l.actor?.callsign || l.actor?.username || l.actor?.type || 'SYSTEM'),
      escapeCsv(l.actor?.role || l.role || ''),
      escapeCsv(l.action),
      escapeCsv(l.category || ''),
      escapeCsv(l.severity || 'INFO'),
      escapeCsv(l.resource?.type || l.resource_type || ''),
      escapeCsv(l.resource?.id || l.resource_id || ''),
      escapeCsv(l.result || 'SUCCESS'),
      escapeCsv(l.description || ''),
      escapeCsv(l.network?.ip || l.ip_address || ''),
      escapeCsv(l.request?.requestId || l.request_id || '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    return {
      contentType: 'text/csv',
      filename: `xploitx_audit_export_${Date.now()}.csv`,
      data: csvContent
    };
  }
}

const auditService = new AuditService();
module.exports = auditService;
