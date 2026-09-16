/**
 * XPLOITX // CYBER BATTLEFIELD
 * Announcements Routes (backend/routes/announcements.js)
 */

const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { requireAuth, requireSquadMembership } = require('../middleware/auth');

router.use(requireAuth, requireSquadMembership);

router.get('/', announcementController.getAll);

module.exports = router;
