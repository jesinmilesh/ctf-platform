/**
 * XPLOITX // CYBER BATTLEFIELD
 * Scoreboard Routes (backend/routes/scoreboard.js)
 */

const express = require('express');
const router = express.Router();
const scoreboardController = require('../controllers/scoreboardController');
const { requireAuth, requireSquadMembership } = require('../middleware/auth');

router.use(requireAuth, requireSquadMembership);

router.get('/', scoreboardController.getScoreboard);
router.get('/history', scoreboardController.getScoreboardHistory);

module.exports = router;
