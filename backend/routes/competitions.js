/**
 * XPLOITX // CYBER BATTLEFIELD
 * Competitions Routes (backend/routes/competitions.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  res.json({ competitions: db.getCompetitions() });
});

router.get('/current', (req, res) => {
  const comp = db.getCompetitions()[0];
  if (!comp) {
    return res.json({ competition: null });
  }
  const { flag_prefix, flag_suffix, ...safeComp } = comp;
  res.json({
    competition: safeComp
  });
});

module.exports = router;
