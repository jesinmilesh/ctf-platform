/**
 * XPLOITX // CYBER BATTLEFIELD
 * State Synchronization Route (backend/routes/sync.js)
 * Implements Section 32 of Architectural Blueprint:
 * Authoritative current state snapshot for client reconnect recovery.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const leaderboardService = require('../services/leaderboardService');

router.get('/', (req, res) => {
  const comp = db.getCompetitions()[0] || null;
  const settings = db.getSettings();
  const lb = leaderboardService.getLeaderboard();
  const solves = db.getSolves();
  const announcements = db.getAnnouncements().slice(-5).reverse();

  res.json({
    timestamp: new Date().toISOString(),
    competition: comp ? {
      id: comp.id,
      name: comp.name,
      status: comp.status,
      flagPrefix: settings.flagPrefix,
      flagSuffix: settings.flagSuffix
    } : null,
    totalSolves: solves.length,
    topScores: lb.teams.slice(0, 5),
    latestAnnouncements: announcements
  });
});

module.exports = router;
