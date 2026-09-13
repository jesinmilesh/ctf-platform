/**
 * XPLOITX // CYBER BATTLEFIELD
 * Competition Model (backend/models/Competition.js)
 */

const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  tagline: { type: String, default: 'ENTER THE DIGITAL BATTLEFIELD' },
  description: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['DRAFT', 'REGISTRATION', 'SCHEDULED', 'LIVE', 'PAUSED', 'ENDED', 'ARCHIVED'], 
    default: 'LIVE',
    index: true
  },
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  freeze_time: { type: Date, default: null },
  flag_prefix: { type: String, default: 'XploitXβ{' },
  flag_suffix: { type: String, default: '}' },
  max_team_size: { type: Number, default: 4 },
  dynamic_scoring: { type: Boolean, default: true },
  scoring_decay: { type: Number, default: 30 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.Competition || mongoose.model('Competition', competitionSchema);
