/**
 * XPLOITX // CYBER BATTLEFIELD
 * Notification Model (backend/models/Notification.js)
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, default: null, index: true },
  team_id: { type: String, default: null, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'INFO' },
  read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
