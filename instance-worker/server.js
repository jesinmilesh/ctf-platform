/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Linux Docker Host Instance Worker (instance-worker/server.js)
 * Implements Phases 7, 8, 9, 17, 18 of Master Specification:
 * - Standalone microservice running on the dedicated Linux Docker host
 * - Communicates with host Docker Engine via local Unix domain socket
 * - Zero Docker daemon exposure to the public internet
 * - Machine-to-machine authentication via x-instance-worker-auth header
 */

const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const runtime = require('./docker/runtime');
const containers = require('./docker/containers');
const networks = require('./docker/networks');
const images = require('./docker/images');
const reconciliation = require('./reconciliation');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// --------------------------------------------------------------------------
// Machine-to-Machine Service Authentication Middleware (Phase 9)
// --------------------------------------------------------------------------
function requireServiceAuth(req, res, next) {
  const authHeader = req.headers['x-instance-worker-auth'] || req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || token !== config.authSecret) {
    console.warn(`[WORKER AUTH] Rejected unauthorized request to ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({
      error: 'UNAUTHORIZED_SERVICE_REQUEST',
      message: 'Access denied: Valid machine-to-machine authentication required.'
    });
  }
  next();
}

// --------------------------------------------------------------------------
// Internal Endpoints (Phase 8)
// --------------------------------------------------------------------------

// Health Endpoint (Unauthenticated / Monitoring)
app.get('/internal/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'xploitx-instance-worker',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// All other /internal routes require service authentication
app.use('/internal', requireServiceAuth);

// Docker Engine Status & Version
app.get('/internal/docker/status', async (req, res) => {
  try {
    const isReady = await runtime.ping();
    const version = isReady ? await runtime.getVersion().catch(() => ({})) : null;
    res.json({
      dockerOperational: isReady,
      socketPath: config.docker.socketPath,
      network: config.docker.network,
      version
    });
  } catch (err) {
    res.status(500).json({ error: 'DOCKER_ENGINE_ERROR', message: err.message });
  }
});

// Ensure Network
app.post('/internal/networks/ensure', async (req, res) => {
  try {
    const networkName = req.body.network || config.docker.network;
    await networks.ensureNetwork(networkName);
    res.json({ success: true, network: networkName });
  } catch (err) {
    res.status(500).json({ error: 'NETWORK_ERROR', message: err.message });
  }
});

// Pull Image
app.post('/internal/images/pull', async (req, res) => {
  try {
    const { image } = req.body;
    await images.ensureImage(image);
    res.json({ success: true, image });
  } catch (err) {
    res.status(500).json({ error: 'PULL_IMAGE_ERROR', message: err.message });
  }
});

// Spawn / Create Challenge Instance
app.post('/internal/instances', async (req, res) => {
  try {
    const {
      name,
      image,
      hostPort,
      containerPort = 80,
      protocol = 'http',
      healthCheckPath = '/health',
      labels = {},
      env = {},
      cpus,
      memory,
      pidsLimit
    } = req.body;

    if (!image || !hostPort) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Both image and hostPort are required to spawn an instance.'
      });
    }

    const containerName = name || `xploitx-instance-${Date.now().toString(36)}`;
    const result = await containers.spawn({
      name: containerName,
      image,
      hostPort,
      containerPort,
      protocol,
      healthCheckPath,
      labels,
      env,
      cpus,
      memory,
      pidsLimit
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({
      error: 'CONTAINER_SPAWN_FAILED',
      message: err.message
    });
  }
});

// List Managed Containers
app.get('/internal/instances', async (req, res) => {
  try {
    const list = await containers.listManaged();
    res.json({ success: true, containers: list });
  } catch (err) {
    res.status(500).json({ error: 'LIST_CONTAINERS_FAILED', message: err.message });
  }
});

// Inspect Instance Container
app.get('/internal/instances/:id', async (req, res) => {
  try {
    const inspect = await containers.inspect(req.params.id);
    res.json(inspect);
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: 'INSPECT_FAILED',
      message: err.message
    });
  }
});

// Start Instance Container
app.post('/internal/instances/:id/start', async (req, res) => {
  try {
    await containers.start(req.params.id);
    res.json({ success: true, containerId: req.params.id, status: 'RUNNING' });
  } catch (err) {
    res.status(500).json({ error: 'START_FAILED', message: err.message });
  }
});

// Stop Instance Container
app.post('/internal/instances/:id/stop', async (req, res) => {
  try {
    const timeoutSec = req.body.timeoutSec || 2;
    await containers.stop(req.params.id, timeoutSec);
    res.json({ success: true, containerId: req.params.id, status: 'STOPPED' });
  } catch (err) {
    res.status(500).json({ error: 'STOP_FAILED', message: err.message });
  }
});

// Restart Instance Container
app.post('/internal/instances/:id/restart', async (req, res) => {
  try {
    const timeoutSec = req.body.timeoutSec || 2;
    const { hostPort, healthPath = '/health' } = req.body;
    await containers.restart(req.params.id, hostPort, healthPath, timeoutSec);
    res.json({ success: true, containerId: req.params.id, status: 'RUNNING' });
  } catch (err) {
    res.status(500).json({ error: 'RESTART_FAILED', message: err.message });
  }
});

// Delete / Terminate Instance Container
app.delete('/internal/instances/:id', async (req, res) => {
  try {
    const force = req.query.force !== 'false';
    await containers.stop(req.params.id, 1).catch(() => {});
    await containers.remove(req.params.id, force);
    res.json({ success: true, containerId: req.params.id, status: 'DESTROYED' });
  } catch (err) {
    res.status(500).json({ error: 'TERMINATION_FAILED', message: err.message });
  }
});

// Trigger Reconciliation
app.post('/internal/reconcile', async (req, res) => {
  try {
    const activeInstances = req.body.activeInstances || [];
    const result = await reconciliation.reconcile(activeInstances);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'RECONCILIATION_FAILED', message: err.message });
  }
});

// Start Server if invoked directly
if (require.main === module) {
  const server = app.listen(config.port, config.host, () => {
    console.log(`================================================================`);
    console.log(`  XPLOITX // STANDALONE INSTANCE WORKER`);
    console.log(`  Listening on http://${config.host}:${config.port}`);
    console.log(`  Docker Socket: ${config.docker.socketPath}`);
    console.log(`  Machine-to-Machine Auth: ACTIVE (Header: x-instance-worker-auth)`);
    console.log(`================================================================`);
  });

  process.on('SIGTERM', () => {
    server.close();
  });
}

module.exports = app;
