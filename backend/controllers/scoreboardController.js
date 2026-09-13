/**
 * XPLOITX // CYBER BATTLEFIELD
 * Scoreboard Controller (backend/controllers/scoreboardController.js)
 */

const leaderboardService = require('../services/leaderboardService');

exports.getScoreboard = (req, res) => {
  const data = leaderboardService.getLeaderboard();
  res.json(data);
};

exports.getScoreboardHistory = (req, res) => {
  const history = leaderboardService.getScoreHistory();
  res.json(history);
};
