/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenges Routes (backend/routes/challenges.js)
 */

const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const { submissionLimiter } = require('../middleware/rateLimit');
const { validateIdParam } = require('../middleware/validation');
const { requireAuth, requireSquadMembership } = require('../middleware/auth');

router.use(requireAuth, requireSquadMembership);

router.get('/', challengeController.getAll);
router.get('/public/:publicRouteId', validateIdParam('publicRouteId'), challengeController.getByPublicRouteId);
router.get('/:id', validateIdParam('id'), challengeController.getOne);
router.get('/:id/files', validateIdParam('id'), challengeController.getChallengeFiles);
router.get('/:id/files/:fileId/download', validateIdParam('id', 'fileId'), challengeController.downloadChallengeFile);
router.post('/:id/submit', validateIdParam('id'), submissionLimiter, challengeController.submitFlag);
router.post('/:id/hints/:hintId/reveal', validateIdParam('id', 'hintId'), challengeController.unlockHint);
router.post('/:id/instance', validateIdParam('id'), challengeController.deployInstance);
router.delete('/:id/instance', validateIdParam('id'), challengeController.terminateInstance);

module.exports = router;
