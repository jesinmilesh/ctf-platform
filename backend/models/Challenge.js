/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Model (backend/models/Challenge.js)
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
  has_instance: { type: Boolean, default: false },
  docker_image: { type: String, default: null },
  container_port: { type: Number, default: 80 },
  protocol: { type: String, enum: ['HTTP', 'TCP'], default: 'HTTP' },
  author: { type: String, default: 'C2 Intelligence' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
