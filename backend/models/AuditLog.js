/**
 * XPLOITX // CYBER BATTLEFIELD
 * AuditLog Model (backend/models/AuditLog.js)
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, default: null, index: true },
  action: { type: String, required: true, index: true },
  resource_type: { type: String, required: true },
  resource_id: { type: String, default: null },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip_address: { type: String, default: '127.0.0.1' },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
