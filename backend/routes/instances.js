/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instances Routes (backend/routes/instances.js)
 * Implements Section 10, 11, 12 of Architectural Specification
 */

const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instanceController');

const { validateIdParam } = require('../middleware/validation');

router.get('/', instanceController.getAll);
router.get('/status', instanceController.getStatus);
router.get('/:id', validateIdParam('id'), instanceController.getStatus);

router.post('/', instanceController.spawn);
router.post('/spawn/:id', validateIdParam('id'), instanceController.spawn);

router.delete('/:id', validateIdParam('id'), instanceController.terminate);
router.post('/terminate', instanceController.terminate);
router.post('/terminate/:id', validateIdParam('id'), instanceController.terminate);
router.post('/:id/terminate', validateIdParam('id'), instanceController.terminate);

module.exports = router;
