/**
 * XPLOITX // CYBER BATTLEFIELD
 * Notifications Routes (backend/routes/notifications.routes.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const userId = req.user ? req.user.id : null;
  const teamId = req.user ? req.user.team_id : null;
  const notifications = db.getNotifications().filter(n => 
    !n.user_id || n.user_id === userId || (teamId && n.team_id === teamId)
  );
  res.json({ notifications });
});

module.exports = router;
