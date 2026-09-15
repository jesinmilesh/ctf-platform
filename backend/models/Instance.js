/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Model (backend/models/Instance.js)
 * Implements Section 8 & 9 of Architectural Specification:
 * - Complete MongoDB Atlas Instance Record Schema
 * - Full 10-status lifecycle enum
 * - Compound indexes on teamId + challengeId + status
 * - Unique active host port indexing strategy
 */

const mongoose = require('mongoose');

const instanceSchema = new mongoose.Schema({
  instanceId: { type: String, required: true, unique: true, index: true },
  challengeId: { type: String, required: true, index: true },
  competitionId: { type: String, default: null, index: true },
  teamId: { type: String, default: null, index: true },
  ownerUserId: { type: String, default: null, index: true },

  containerId: { type: String, default: null },
  containerName: { type: String, default: null },

  host: { type: String, default: '127.0.0.1' },
  port: { type: Number, required: true },
  protocol: { type: String, default: 'http', immutable: true },

  status: { 
    type: String, 
    enum: [
      'REQUESTED',
      'ALLOCATING',
      'PORT_RESERVED',
      'CONTAINER_CREATING',
      'STARTING',
      'HEALTH_CHECKING',
      'RUNNING',
      'STOPPING',
      'STOPPED',
      'EXPIRED',
      'DESTROYED',
      'FAILED'
    ], 
    default: 'REQUESTED',
    index: true
  },

  image: { type: String, default: null },
  containerPort: { type: Number, default: 80 },

  url: { type: String, default: null },
  subdomain: { type: String, default: null },
  connection_url: { type: String, default: null },

  createdAt: { type: Date, default: Date.now, index: true },
  startedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
  stoppedAt: { type: Date, default: null },
  destroyedAt: { type: Date, default: null },

  lastHealthCheckAt: { type: Date, default: Date.now },
  healthCheckStatus: { type: String, enum: ['PENDING', 'HEALTHY', 'UNHEALTHY', 'FAILED'], default: 'PENDING' },

  failureReason: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Compatibility aliases
  id: { type: String },
  challenge_id: { type: String },
  team_id: { type: String },
  user_id: { type: String },
  container_id: { type: String },
  lastHealthCheck: { type: Date },
  expires_at: { type: Date },
  created_at: { type: Date }
}, {
  strict: true,
  timestamps: { createdAt: 'createdAt', updatedAt: 'lastHealthCheckAt' },
  toJSON: {
    transform(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound index for active instances per team & challenge
instanceSchema.index({ teamId: 1, challengeId: 1, status: 1 });
instanceSchema.index({ ownerUserId: 1, challengeId: 1, status: 1 });

// Partial unique index preventing duplicate port allocation across active containers
instanceSchema.index(
  { port: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      status: { $in: ['ALLOCATING', 'PORT_RESERVED', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING', 'STOPPING'] } 
    } 
  }
);

// Sync aliases before save
instanceSchema.pre('save', function(next) {
  if (!this.id) this.id = this.instanceId;
  if (!this.challenge_id) this.challenge_id = this.challengeId;
  if (!this.team_id) this.team_id = this.teamId;
  if (!this.user_id) this.user_id = this.ownerUserId;
  if (!this.container_id) this.container_id = this.containerId;
  if (!this.expires_at) this.expires_at = this.expiresAt;
  if (!this.created_at) this.created_at = this.createdAt;
  if (!this.lastHealthCheck) this.lastHealthCheck = this.lastHealthCheckAt;
  next();
});

module.exports = mongoose.models.Instance || mongoose.model('Instance', instanceSchema);
