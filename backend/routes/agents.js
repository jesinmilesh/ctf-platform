/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Routes (backend/routes/agents.js)
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Admin: generate a one-time pairing code
router.post('/generate-code', agentController.generateCode);

// Agent daemon: redeem pairing code and register
router.post('/pair', agentController.pair);

// Admin: list all agents
router.get('/', agentController.list);

// Admin: get single agent
router.get('/:id', agentController.getOne);

// Admin: revoke agent
router.post('/:id/revoke', agentController.revoke);

// Admin: get active instances on an agent
router.get('/:id/instances', agentController.getInstances);

module.exports = router;
