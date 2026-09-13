/**
 * XPLOITX // CYBER BATTLEFIELD
 * Team Model (backend/models/Team.js)
 */

const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, required: true, index: true },
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  access_code: { type: String, required: true, index: true },
  captain_id: { type: String, default: null },
  total_score: { type: Number, default: 0, index: true },
  solves_count: { type: Number, default: 0 },
  first_bloods: { type: Number, default: 0 },
  last_score_update: { type: Date, default: Date.now, index: true },
  is_disqualified: { type: Boolean, default: false, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Team || mongoose.model('Team', teamSchema);
