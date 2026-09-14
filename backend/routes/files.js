/**
 * XPLOITX // CYBER BATTLEFIELD
 * Files Routes (backend/routes/files.js)
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const db = require('../config/database');

router.get('/', (req, res) => {
  res.json({ files: db.getFiles() });
});

router.get('/:fileId', fileController.downloadFile);

module.exports = router;
