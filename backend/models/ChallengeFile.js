/**
 * XPLOITX // CYBER BATTLEFIELD
 * ChallengeFile Model (backend/models/ChallengeFile.js)
 */

const mongoose = require('mongoose');

const challengeFileSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  storage_key: { type: String, required: true },
  file_size_bytes: { type: Number, required: true },
  mime_type: { type: String, default: 'application/octet-stream' },
  sha256: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ChallengeFile || mongoose.model('ChallengeFile', challengeFileSchema);
