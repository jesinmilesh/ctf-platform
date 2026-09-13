/**
 * XPLOITX // CYBER BATTLEFIELD
 * Health Probes Route (backend/routes/health.routes.js)
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/v1/health - Full system health
router.get('/', async (req, res) => {
  try {
    const dbHealth = await db.checkHealth();
    res.json({
      status: 'ok',
      platform: 'XPLOITX // CYBER BATTLEFIELD',
      version: '2.0.0',
      services: {
        api: 'ok',
        database: dbHealth.status,
        databaseType: dbHealth.type,
        dbLatencyMs: dbHealth.latencyMs
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      platform: 'XPLOITX // CYBER BATTLEFIELD',
      services: {
        api: 'ok',
        database: 'error',
        error: err.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/health/ready - Orchestration Readiness Probe
router.get('/ready', async (req, res) => {
  try {
    await db.checkHealth();
    res.status(200).send('READY');
  } catch (err) {
    res.status(503).send('NOT_READY');
  }
});

// GET /api/v1/health/live - Orchestration Liveness Probe
router.get('/live', (req, res) => {
  res.status(200).send('LIVE');
});

module.exports = router;
