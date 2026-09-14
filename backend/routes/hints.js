/**
 * XPLOITX // CYBER BATTLEFIELD
 * Hints Routes (backend/routes/hints.js)
 */

const express = require('express');
const router = express.Router();
const challengeService = require('../services/challengeService');
const db = require('../config/database');

router.get('/', (req, res) => {
  res.json({ hints: db.getHints() });
});

router.post('/:hintId/reveal', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  try {
    const hint = challengeService.unlockHint(req.body.challengeId, req.params.hintId, req.user);
    res.json({ success: true, hint });
  } catch (err) {
    res.status(400).json({ error: 'HINT_ERROR', message: err.message });
  }
});

module.exports = router;
