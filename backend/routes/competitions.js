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
  const settings = db.getSettings();
  res.json({
    competition: {
      ...comp,
      flagPrefix: settings.flagPrefix,
      flagSuffix: settings.flagSuffix
    }
  });
});

module.exports = router;
