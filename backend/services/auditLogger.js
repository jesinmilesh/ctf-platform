/**
 * XPLOITX // CYBER BATTLEFIELD
 * Centralized Audit Logger Compatibility Layer (backend/services/auditLogger.js)
 * Wraps auditService to provide consistent structured audit telemetry.
 */

const auditService = require('./auditService');

class AuditLogger {
  async log({
    actor = 'anonymous',
    actorId = null,
    role = 'UNKNOWN',
    action,
    category = null,
    severity = null,
    target = null,
    resource = null,
    requestId = null,
    ip = '127.0.0.1',
    result = 'SUCCESS',
    details = {},
    metadata = null,
    description = null,
    req = null
  }) {
    if (!action) return null;

    let resCategory = category;
    if (!resCategory) {
      const act = String(action).toUpperCase();
      if (act.startsWith('AUTH') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('PASSWORD')) resCategory = 'AUTH';
      else if (act.startsWith('CHALLENGE')) resCategory = 'CHALLENGE';
      else if (act.startsWith('FILE')) resCategory = 'FILE';
      else if (act.startsWith('INSTANCE')) resCategory = 'INSTANCE';
      else if (act.startsWith('SUBMISSION') || act.includes('FLAG')) resCategory = 'SUBMISSION';
      else if (act.startsWith('TEAM')) resCategory = 'TEAM';
      else if (act.startsWith('ADMIN')) resCategory = 'ADMIN';
      else if (act.startsWith('SECURITY') || act.includes('DENIED') || act.includes('ATTEMPT') || act.includes('INJECTION')) resCategory = 'SECURITY';
      else resCategory = 'SYSTEM';
    }

    let resSeverity = severity;
    if (!resSeverity) {
      if (result === 'DENIED' || String(action).includes('INJECTION') || String(action).includes('ATTEMPT') || String(action).includes('TRAVERSAL')) {
        resSeverity = 'HIGH';
      } else if (result === 'FAILURE') {
        resSeverity = 'WARNING';
      } else {
        resSeverity = 'INFO';
      }
    }

    let targetResource = resource;
    if (!targetResource && target) {
      const parts = String(target).split(':');
      targetResource = {
        type: parts[0] || 'GENERAL',
        id: parts[1] || null,
        name: target
      };
    }

    return auditService.record({
      action,
      category: resCategory,
      severity: resSeverity,
      actor: typeof actor === 'object' && actor !== null ? actor : {
        username: typeof actor === 'string' ? actor : 'anonymous',
        userId: actorId,
        role: role || 'UNKNOWN'
      },
      resource: targetResource,
      result,
      description: description || `${action} on ${target || 'system'}`,
      metadata: metadata || details || {},
      requestId,
      ip,
      req
    });
  }

  record(opts) {
    return auditService.record(opts);
  }

  queryLogs(opts) {
    return auditService.queryLogs(opts);
  }

  getDashboardStats() {
    return auditService.getDashboardStats();
  }

  getEventById(id) {
    return auditService.getEventById(id);
  }

  exportLogs(filterParams, format) {
    return auditService.exportLogs(filterParams, format);
  }
}

const auditLogger = new AuditLogger();
module.exports = auditLogger;
