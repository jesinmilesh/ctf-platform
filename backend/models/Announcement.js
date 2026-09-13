/**
 * XPLOITX // CYBER BATTLEFIELD
 * Announcement Model (backend/models/Announcement.js)
 */

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  competition_id: { type: String, default: null, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['BROADCAST', 'HINT_RELEASE', 'MAINTENANCE', 'ALERT'], default: 'BROADCAST' },
  pinned: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
