/**
 * XPLOITX // CYBER BATTLEFIELD
 * Submissions Routes (backend/routes/submissions.js)
 */

const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');

router.get('/', submissionController.getRecentSubmissions);

module.exports = router;
