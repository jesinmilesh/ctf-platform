/**
 * XPLOITX // CYBER BATTLEFIELD
 * Submission Model (backend/models/Submission.js)
 */

const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, required: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  team_id: { type: String, default: null, index: true },
  flag_submitted: { type: String, required: true },
  is_correct: { type: Boolean, default: false, index: true },
  points_awarded: { type: Number, default: 0 },
  ip_address: { type: String, default: '127.0.0.1' },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
