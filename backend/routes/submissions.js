/**
 * XPLOITX // CYBER BATTLEFIELD
 * Submissions Routes (backend/routes/submissions.js)
 */

const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const challengeController = require('../controllers/challengeController');
const { submissionLimiter } = require('../middleware/rateLimit');

router.get('/', submissionController.getRecentSubmissions);
router.post('/', submissionLimiter, challengeController.submitFlag);

module.exports = router;
