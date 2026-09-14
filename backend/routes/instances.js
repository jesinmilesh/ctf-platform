/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instances Routes (backend/routes/instances.js)
 * Implements Section 10, 11, 12 of Architectural Specification
 */

const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instanceController');

router.get('/', instanceController.getAll);
router.get('/status', instanceController.getStatus);
router.get('/:id', instanceController.getStatus);

router.post('/', instanceController.spawn);
router.post('/spawn/:id', instanceController.spawn);

router.delete('/:id', instanceController.terminate);
router.post('/terminate', instanceController.terminate);
router.post('/terminate/:id', instanceController.terminate);

module.exports = router;
