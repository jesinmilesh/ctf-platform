/**
 * XPLOITX // CYBER BATTLEFIELD
 * Teams Routes (backend/routes/teams.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const teamController = require('../controllers/teamController');

router.get('/', (req, res) => {
  res.json({ teams: db.getTeams() });
});
router.get('/:id', teamController.getTeam);
router.post('/', teamController.createTeam);
router.post('/join', teamController.joinTeam);

module.exports = router;
