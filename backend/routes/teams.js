/**
 * XPLOITX // CYBER BATTLEFIELD
 * Teams Routes (backend/routes/teams.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const teamController = require('../controllers/teamController');

const { validateIdParam } = require('../middleware/validation');

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
router.get('/:id', validateIdParam('id'), teamController.getTeam);
router.post('/', teamController.createTeam);
router.post('/join', teamController.joinTeam);

module.exports = router;
