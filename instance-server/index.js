/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Challenge Instance Orchestration Service (instance-server/index.js)
 * Implements Section 27, 28, 70, 75 of Master Production Specification:
 * - Dedicated internal service communicating securely with main backend
 * - Authenticated via INSTANCE_SERVER_TOKEN bearer header
 * - Exposes atomic spawn, health check, status, and termination endpoints
 */

const http = require('http');
const express = require('express');
const dockerManager = require('./dockerManager');
const portAllocator = require('./portAllocator');
const healthChecker = require('./healthChecker');
const instanceRouter = require('./instanceRouter');
const cleanupWorker = require('./cleanupWorker');
const reconciliation = require('./reconciliation');

const app = express();
const PORT = process.env.INSTANCE_SERVER_PORT || 5000;
const AUTH_TOKEN = process.env.INSTANCE_SERVER_TOKEN || 'xploitx_internal_instance_auth_token_secret_2026';

app.use(express.json());

// Authentication Middleware for internal service communication
function internalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== AUTH_TOKEN && req.path !== '/health') {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED_INSTANCE_SERVICE', message: 'Invalid or missing internal service token.' }
    });
  }
  next();
}

app.use(internalAuth);

// Health Endpoint (Section 75)
app.get('/health', async (req, res) => {
  const dockerLive = await dockerManager.isDockerAvailable();
  res.json({
    status: 'OPERATIONAL',
    service: 'xploitx-instance-orchestrator',
    dockerAvailable: dockerLive,
    allocatedPortsCount: portAllocator.getAllocations().length,
    activeContainersCount: dockerManager.getAllActive().length,
    timestamp: new Date().toISOString()
  });
});

// Spawn Sandbox Instance (Section 32)
app.post('/instances/spawn', async (req, res) => {
  const { instanceId, challenge, ttlMinutes = 30 } = req.body;

  if (!instanceId || !challenge || !challenge.id) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SPAWN_PAYLOAD', message: 'Missing instanceId or challenge specification.' }
    });
  }

  let reservedPort;
  try {
    // 1. Atomic Port Reservation (Section 30)
    reservedPort = await portAllocator.reserve(instanceId);

    // 2. Spawn Container & Perform Health Check (Section 32 & 33)
    const containerRecord = await dockerManager.createAndStart({
      instanceId,
      challenge,
      hostPort: reservedPort,
      ttlMinutes
    });

    // 3. Confirm Port Allocation
    await portAllocator.confirmAllocation(reservedPort, instanceId);

    // 4. Resolve Target Endpoints (Section 34 & 35)
    const targetEndpoints = instanceRouter.resolveTargetEndpoints({
      instanceId,
      port: reservedPort,
      challengeProtocol: challenge.protocol || 'HTTP'
    });

    return res.status(201).json({
      success: true,
      instance: {
        instanceId,
        status: containerRecord.status,
        hostPort: reservedPort,
        containerId: containerRecord.containerId,
        expiresAt: containerRecord.expiresAt,
        startedAt: containerRecord.startedAt,
        ...targetEndpoints
      }
    });
  } catch (err) {
    // Release port on failure
    if (reservedPort) {
      await portAllocator.release(reservedPort).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INSTANCE_SPAWN_ERROR', message: err.message }
    });
  }
});

// Terminate Sandbox Instance (Section 37)
app.post('/instances/:id/terminate', async (req, res) => {
  const instanceId = req.params.id;
  try {
    const success = await cleanupWorker.terminateInstance(instanceId);
    return res.json({ success, message: `Instance ${instanceId} terminated.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'TERMINATION_ERROR', message: err.message } });
  }
});

// Query Status of Instance
app.get('/instances/:id', async (req, res) => {
  const instanceId = req.params.id;
  const status = await dockerManager.getStatus(instanceId);
  if (!status) {
    return res.status(404).json({ success: false, error: { code: 'INSTANCE_NOT_FOUND', message: 'Sandbox instance not found.' } });
  }
  const endpoints = instanceRouter.resolveTargetEndpoints({
    instanceId,
    port: status.hostPort,
    challengeProtocol: status.protocol
  });
  return res.json({ success: true, instance: { ...status, ...endpoints } });
});

// List All Active Instances
app.get('/instances', (req, res) => {
  res.json({ success: true, active: dockerManager.getAllActive() });
});

// Start cleanup background scanner
cleanupWorker.start();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  XPLOITX // DEDICATED INSTANCE SERVER ONLINE`);
    console.log(`  INTERNAL PORT: http://localhost:${PORT}`);
    console.log(`  PORT RANGE: ${portAllocator.minPort} - ${portAllocator.maxPort}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
