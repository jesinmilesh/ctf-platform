/**
 * XPLOITX // CYBER BATTLEFIELD
 * SecurityEvent Model (backend/models/SecurityEvent.js)
 */

const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  event_type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  source_ip: { type: String, default: '127.0.0.1' },
  user_id: { type: String, default: null, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.SecurityEvent || mongoose.model('SecurityEvent', securityEventSchema);
