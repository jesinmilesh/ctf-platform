/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Model (backend/models/Challenge.js)
 * Implements Section 14 & 16 of Architectural Specification:
 * - Dynamic container runtime configuration (image, port, resources, healthCheck, duration).
 * - Backward compatibility with legacy schema fields.
 */

const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, required: true, index: true },
  category_id: { type: String, required: true, index: true },
  category_name: { type: String, default: 'MISC' },
  mission_id: { type: String, required: true, unique: true, index: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD', 'INSANE'], default: 'MEDIUM', index: true },
  description: { type: String, required: true },
  base_points: { type: Number, default: 500 },
  minimum_points: { type: Number, default: 100 },
  decay_threshold: { type: Number, default: 30 },
  current_points: { type: Number, default: 500 },
  solve_count: { type: Number, default: 0 },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'DRAFT', index: true },
  
  // Real Container Sandbox Runtime Configuration (Section 14)
  has_instance: { type: Boolean, default: false },
  docker_image: { type: String, default: null },
  container_port: { type: Number, default: 80 },
  protocol: { type: String, enum: ['HTTP', 'TCP', 'http', 'tcp'], default: 'HTTP' },
  health_check_path: { type: String, default: '/' },
  instance_ttl_minutes: { type: Number, default: 30 },
  cpu_limit: { type: Number, default: 0.5 },
  memory_limit: { type: String, default: '256m' },

  runtime: {
    enabled: { type: Boolean, default: false },
    image: { type: String, default: null },
    containerPort: { type: Number, default: 80 },
    protocol: { type: String, default: 'http' },
    healthCheck: {
      type: { type: String, default: 'http' },
      path: { type: String, default: '/' }
    },
    resources: {
      cpus: { type: Number, default: 0.5 },
      memory: { type: String, default: '256m' },
      pidsLimit: { type: Number, default: 128 }
    },
    durationMinutes: { type: Number, default: 30 }
  },

  author: { type: String, default: 'C2 Intelligence' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Sync runtime subdocument and top-level fields
challengeSchema.pre('save', function(next) {
  if (this.runtime) {
    if (this.runtime.enabled !== undefined) this.has_instance = Boolean(this.runtime.enabled);
    if (this.runtime.image) this.docker_image = this.runtime.image;
    if (this.runtime.containerPort) this.container_port = this.runtime.containerPort;
    if (this.runtime.durationMinutes) this.instance_ttl_minutes = this.runtime.durationMinutes;
    if (this.runtime.healthCheck && this.runtime.healthCheck.path) this.health_check_path = this.runtime.healthCheck.path;
    if (this.runtime.resources) {
      if (this.runtime.resources.cpus) this.cpu_limit = this.runtime.resources.cpus;
      if (this.runtime.resources.memory) this.memory_limit = this.runtime.resources.memory;
    }
  } else if (this.has_instance) {
    this.runtime = {
      enabled: true,
      image: this.docker_image,
      containerPort: this.container_port || 80,
      protocol: (this.protocol || 'http').toLowerCase(),
      healthCheck: { type: 'http', path: this.health_check_path || '/' },
      resources: { cpus: this.cpu_limit || 0.5, memory: this.memory_limit || '256m', pidsLimit: 128 },
      durationMinutes: this.instance_ttl_minutes || 30
    };
  }
  next();
});

module.exports = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
