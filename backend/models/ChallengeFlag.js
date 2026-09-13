/**
 * XPLOITX // CYBER BATTLEFIELD
 * ChallengeFlag Model (backend/models/ChallengeFlag.js)
 */

const mongoose = require('mongoose');

const challengeFlagSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  flag_type: { type: String, enum: ['STATIC', 'DYNAMIC', 'REGEX'], default: 'STATIC' },
  flag_value: { type: String, required: true },
  case_sensitive: { type: Boolean, default: true }
});

module.exports = mongoose.models.ChallengeFlag || mongoose.model('ChallengeFlag', challengeFlagSchema);
