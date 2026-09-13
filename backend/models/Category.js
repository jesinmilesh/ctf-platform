/**
 * XPLOITX // CYBER BATTLEFIELD
 * Category Model (backend/models/Category.js)
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, default: '' },
  color_accent: { type: String, default: '#00ff9c' },
  display_order: { type: Number, default: 0 }
});

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
