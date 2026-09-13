/**
 * XPLOITX // CYBER BATTLEFIELD
 * Scoreboard Routes (backend/routes/scoreboard.js)
 */

const express = require('express');
const router = express.Router();
const scoreboardController = require('../controllers/scoreboardController');

router.get('/', scoreboardController.getScoreboard);
router.get('/history', scoreboardController.getScoreboardHistory);

module.exports = router;
