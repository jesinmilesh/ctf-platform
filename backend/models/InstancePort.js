/**
 * XPLOITX // CYBER BATTLEFIELD
 * InstancePort Model (backend/models/InstancePort.js)
 */

const mongoose = require('mongoose');

const instancePortSchema = new mongoose.Schema({
  port: { type: Number, required: true, unique: true, index: true },
  instance_id: { type: String, required: true, index: true },
  allocated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.models.InstancePort || mongoose.model('InstancePort', instancePortSchema);
