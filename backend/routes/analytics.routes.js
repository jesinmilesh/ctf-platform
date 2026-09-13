/**
 * XPLOITX // CYBER BATTLEFIELD
 * Analytics Routes (backend/routes/analytics.routes.js)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/', (req, res) => adminController.getAnalytics(req, res));

module.exports = router;
