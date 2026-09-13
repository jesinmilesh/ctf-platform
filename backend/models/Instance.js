/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Model (backend/models/Instance.js)
 */

const mongoose = require('mongoose');

const instanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  challenge_id: { type: String, required: true, index: true },
  team_id: { type: String, default: null, index: true },
  user_id: { type: String, default: null, index: true },
  container_id: { type: String, default: null },
  host: { type: String, default: 'xploitxctf.me' },
  port: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['STARTING', 'HEALTH_CHECKING', 'RUNNING', 'STOPPING', 'DESTROYED', 'EXPIRED', 'FAILED'], 
    default: 'STARTING',
    index: true
  },
  connection_url: { type: String, default: null },
  expires_at: { type: Date, required: true, index: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Instance || mongoose.model('Instance', instanceSchema);
