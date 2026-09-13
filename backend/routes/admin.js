/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Routes (backend/routes/admin.js)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/roles');

// Apply admin clearance check across C2 routes
router.use(requireAdmin);

router.get('/overview', (req, res) => adminController.getOverview(req, res));
router.get('/challenges', (req, res) => adminController.getChallenges(req, res));
router.post('/challenges', (req, res) => adminController.createChallenge(req, res));
router.put('/challenges/:id', (req, res) => adminController.updateChallenge(req, res));
router.delete('/challenges/:id', (req, res) => adminController.deleteChallenge(req, res));
router.get('/challenges/:id/validate', (req, res) => adminController.validateChallenge(req, res));
router.post('/challenges/test-flag', (req, res) => adminController.testFlag(req, res));

router.get('/categories', (req, res) => adminController.getCategories(req, res));
router.get('/users', (req, res) => adminController.getUsers(req, res));
router.post('/users/:id/ban', (req, res) => adminController.toggleUserBan(req, res));
router.get('/teams', (req, res) => adminController.getTeams(req, res));
router.get('/submissions', (req, res) => adminController.getSubmissions(req, res));
router.get('/analytics', (req, res) => adminController.getAnalytics(req, res));
router.get('/instances', (req, res) => adminController.getInstances(req, res));
router.get('/audit', (req, res) => adminController.getAuditLogs(req, res));
router.post('/settings', (req, res) => adminController.updateSettings(req, res));
router.post('/announcements', (req, res) => adminController.dispatchAnnouncement(req, res));

module.exports = router;
