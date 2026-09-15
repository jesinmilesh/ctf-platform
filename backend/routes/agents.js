/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Routes (backend/routes/agents.js)
 */

const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');

// All routes require authentication
router.use(authMiddleware);

// Admin: generate a one-time pairing code
router.post('/generate-code', requireAdmin, agentController.generateCode);

// Agent daemon: redeem pairing code and register (pairing code itself is secret single-use auth)
router.post('/pair', agentController.pair);

// Admin: list all agents
router.get('/', requireAdmin, agentController.list);

// Admin: get single agent
router.get('/:id', requireAdmin, agentController.getOne);

// Admin: revoke agent
router.post('/:id/revoke', requireAdmin, agentController.revoke);

// Admin: get active instances on an agent
router.get('/:id/instances', requireAdmin, agentController.getInstances);

module.exports = router;
