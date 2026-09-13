/**
 * XPLOITX // CYBER BATTLEFIELD
 * User Model (backend/models/User.js)
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, default: null, index: true },
  team_id: { type: String, default: null, index: true },
  username: { type: String, required: true, unique: true, index: true, trim: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['PLAYER', 'TEAM_CAPTAIN', 'CHALLENGE_AUTHOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'], 
    default: 'PLAYER',
    index: true
  },
  callsign: { type: String, default: null },
  avatar: { type: String, default: null },
  bio: { type: String, default: null },
  affiliation: { type: String, default: 'Independent Operative' },
  is_banned: { type: Boolean, default: false, index: true },
  mfa_enabled: { type: Boolean, default: false },
  mfa_secret: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
