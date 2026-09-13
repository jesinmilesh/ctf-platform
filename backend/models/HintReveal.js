/**
 * XPLOITX // CYBER BATTLEFIELD
 * HintReveal Model (backend/models/HintReveal.js)
 */

const mongoose = require('mongoose');

const hintRevealSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  hint_id: { type: String, required: true, index: true },
  team_id: { type: String, default: null, index: true },
  user_id: { type: String, default: null, index: true },
  cost: { type: Number, default: 0 },
  revealed_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.HintReveal || mongoose.model('HintReveal', hintRevealSchema);
