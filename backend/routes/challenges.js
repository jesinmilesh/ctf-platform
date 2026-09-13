/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenges Routes (backend/routes/challenges.js)
 */

const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { submissionLimiter } = require('../middleware/rateLimit');

router.get('/', challengeController.getAll);
router.get('/:id', challengeController.getOne);
router.post('/:id/submit', submissionLimiter, challengeController.submitFlag);
router.post('/:id/hints/:hintId/reveal', challengeController.unlockHint);
router.post('/:id/instance', challengeController.deployInstance);
router.delete('/:id/instance', challengeController.terminateInstance);

module.exports = router;
