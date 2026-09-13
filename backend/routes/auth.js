/**
 * XPLOITX // CYBER BATTLEFIELD
 * Auth Routes (backend/routes/auth.js)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, authController.login);
router.post('/register', authController.register);
router.get('/me', authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;
