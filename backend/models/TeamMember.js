/**
 * XPLOITX // CYBER BATTLEFIELD
 * TeamMember Model (backend/models/TeamMember.js)
 */

const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  team_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, unique: true, index: true },
  joined_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.TeamMember || mongoose.model('TeamMember', teamMemberSchema);
