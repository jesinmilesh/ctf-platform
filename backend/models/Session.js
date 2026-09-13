/**
 * XPLOITX // CYBER BATTLEFIELD
 * Session Model (backend/models/Session.js)
 */

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  expires_at: { type: Date, required: true, index: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
