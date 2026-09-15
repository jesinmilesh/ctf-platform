/**
 * XPLOITX // CYBER BATTLEFIELD
 * Teams Routes (backend/routes/teams.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const teamController = require('../controllers/teamController');
const { requireAuth } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validation');

// Public: list teams (strips access_code for non-members)
router.get('/', (req, res) => {
  const isPrivileged = req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN');
  const teams = db.getTeams().map(t => {
    if (isPrivileged || (req.user && req.user.team_id === t.id)) {
      return t;
    }
    const { access_code, ...safe } = t;
    return safe;
  });
  res.json({ teams });
});

// IMPORTANT: /join must come BEFORE /:id to avoid being matched as an ID param
router.post('/join', requireAuth, teamController.joinTeam);

// Protected: create and get team (auth required for create)
router.post('/', requireAuth, teamController.createTeam);
router.get('/:id', validateIdParam('id'), teamController.getTeam);

module.exports = router;
