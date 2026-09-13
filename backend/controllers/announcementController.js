/**
 * XPLOITX // CYBER BATTLEFIELD
 * Announcements Controller (backend/controllers/announcementController.js)
 */

const db = require('../config/database');

exports.getAll = (req, res) => {
  const announcements = [...db.getAnnouncements()].reverse();
  res.json({ announcements });
};
