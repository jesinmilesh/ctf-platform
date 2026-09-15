/**
 * XPLOITX // CYBER BATTLEFIELD
 * AuditLog Model (backend/models/AuditLog.js)
 *
 * Implements Section 11 & 30 of Architectural Specification:
 * - Dedicated immutable audit trail collection
 * - Structured actor, action, resource, request correlation, and network metadata
 * - High-speed indexes for timestamp, actor, resource, and severity
 * - Strict schema with secret-free payload validation
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  eventId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },

  actor: {
    type: { type: String, enum: ['USER', 'SYSTEM', 'WORKER', 'SERVICE', 'ANONYMOUS'], default: 'USER', index: true },
    userId: { type: String, default: null, index: true },
    username: { type: String, default: 'anonymous' },
    role: { type: String, default: 'GUEST' },
    teamId: { type: String, default: null, index: true },
    teamName: { type: String, default: null }
  },

  action: { type: String, required: true, index: true },

  category: {
    type: String,
    enum: [
      'AUTH', 'USER', 'TEAM', 'CHALLENGE', 'FILE', 'HINT',
      'SUBMISSION', 'INSTANCE', 'SCORE', 'ANNOUNCEMENT',
      'ADMIN', 'SECURITY', 'SYSTEM', 'MODERATION'
    ],
    default: 'SYSTEM',
    index: true
  },

  severity: {
    type: String,
    enum: ['INFO', 'NOTICE', 'WARNING', 'HIGH', 'CRITICAL'],
    default: 'INFO',
    index: true
  },

  resource: {
    type: { type: String, default: 'GENERAL', index: true },
    id: { type: String, default: null, index: true },
    name: { type: String, default: null }
  },

  result: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'DENIED'],
    default: 'SUCCESS',
    index: true
  },

  description: { type: String, default: '' },

  request: {
    requestId: { type: String, default: null },
    method: { type: String, default: null },
    route: { type: String, default: null }
  },

  network: {
    ip: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: null }
  },

  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Compatibility aliases for legacy audit records
  user_id: { type: String, default: null },
  actor_id: { type: String, default: null },
  resource_type: { type: String, default: 'GENERAL' },
  resource_id: { type: String, default: null },
  target: { type: String, default: null },
  ip_address: { type: String, default: '127.0.0.1' },
  request_id: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now, index: true }
}, {
  strict: true,
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Compound indexes for rapid query performance (Section 30)
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ 'actor.userId': 1, timestamp: -1 });
auditLogSchema.index({ 'actor.teamId': 1, timestamp: -1 });
auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ result: 1, timestamp: -1 });
auditLogSchema.index({ 'request.requestId': 1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
