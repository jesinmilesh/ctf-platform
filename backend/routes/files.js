/**
 * XPLOITX // CYBER BATTLEFIELD
 * Files Routes (backend/routes/files.js)
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

router.get('/:fileId', fileController.downloadFile);

module.exports = router;
