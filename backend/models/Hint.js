/**
 * XPLOITX // CYBER BATTLEFIELD
 * Hint & HintReveal Models (backend/models/Hint.js, backend/models/HintReveal.js)
 */

const mongoose = require('mongoose');

const hintSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  title: { type: String, default: 'TACTICAL DECRYPT HINT' },
  content: { type: String, required: true },
  cost: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true }
});

module.exports = mongoose.models.Hint || mongoose.model('Hint', hintSchema);
