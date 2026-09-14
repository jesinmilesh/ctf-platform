/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Model (backend/models/Agent.js)
 * Tracks registered XploitX Docker Agent daemons.
 */

const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  agentId: { type: String, required: true, unique: true, index: true },
  name:    { type: String, required: true },
  deviceId:{ type: String, required: true, unique: true },
  owner:   { type: String, required: true, index: true },   // Admin userId

  status: {
    type: String,
    enum: ['ONLINE', 'OFFLINE', 'REVOKED'],
    default: 'OFFLINE',
    index: true
  },

  runtime: { type: String, default: 'docker' },
  version: { type: String, default: '1.0.0' },
  capabilities: { type: [String], default: ['docker', 'http', 'tcp'] },

  systemInfo: {
    platform:        { type: String, default: null },
    cpus:            { type: Number, default: 0 },
    totalMemoryMB:   { type: Number, default: 0 },
    freeMemoryMB:    { type: Number, default: 0 },
    cpuUsagePercent: { type: Number, default: 0 }
  },

  activeInstances: { type: Number, default: 0 },

  lastHeartbeat: { type: Date, default: null },
  registeredAt:  { type: Date, default: Date.now },
  revokedAt:     { type: Date, default: null },

  // Scrypt/SHA256 hash of the agent secret (never stored in plaintext)
  secretHash: { type: String, required: true }
}, { timestamps: true });

agentSchema.index({ status: 1, lastHeartbeat: -1 });

module.exports = mongoose.models.Agent || mongoose.model('Agent', agentSchema);
