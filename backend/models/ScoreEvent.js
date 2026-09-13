/**
 * XPLOITX // CYBER BATTLEFIELD
 * ScoreEvent Model (backend/models/ScoreEvent.js)
 */

const mongoose = require('mongoose');

const scoreEventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, required: true, index: true },
  team_id: { type: String, default: null, index: true },
  user_id: { type: String, default: null, index: true },
  challenge_id: { type: String, default: null, index: true },
  reason: { 
    type: String, 
    enum: ['SOLVE', 'FIRST_BLOOD', 'HINT_UNLOCK', 'ADMIN_ADJUST'], 
    required: true, 
    index: true 
  },
  points_delta: { type: Number, required: true },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.ScoreEvent || mongoose.model('ScoreEvent', scoreEventSchema);
