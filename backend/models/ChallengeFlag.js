/**
 * XPLOITX // CYBER BATTLEFIELD
 * ChallengeFlag Model (backend/models/ChallengeFlag.js)
 */

const mongoose = require('mongoose');

const challengeFlagSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  flag_type: { type: String, enum: ['STATIC', 'DYNAMIC', 'REGEX'], default: 'STATIC' },
  flag_value: { type: String, required: true, select: false },
  case_sensitive: { type: Boolean, default: true }
}, {
  strict: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.flag_value;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform(doc, ret) {
      delete ret.flag_value;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.models.ChallengeFlag || mongoose.model('ChallengeFlag', challengeFlagSchema);
