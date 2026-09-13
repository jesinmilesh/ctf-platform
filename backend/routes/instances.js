/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instances Routes (backend/routes/instances.js)
 */

const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instanceController');

router.get('/', instanceController.getAll);
router.get('/status', instanceController.getStatus);
router.post('/', instanceController.spawn);
router.post('/spawn/:id', instanceController.spawn);
router.post('/terminate', instanceController.terminate);
router.post('/terminate/:id', instanceController.terminate);
router.delete('/:id', instanceController.terminate);

module.exports = router;
