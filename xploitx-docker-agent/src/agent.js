/**
 * XPLOITX // CYBER BATTLEFIELD
 * Autonomous Docker Agent Service Daemon (src/agent.js)
 * Implements Section 3, 4, 5, 6 of Master Implementation Plan
 */

const fs = require('fs');
const path = require('path');
const DockerManager = require('./dockerManager');
const PortAllocator = require('./portAllocator');
const AgentInstanceManager = require('./instanceManager');
const CleanupWorker = require('./cleanupWorker');
const AgentAuthentication = require('./authentication');
const AgentWebSocketClient = require('./websocket');

// Simple .env parser for default.env
function loadEnv() {
  const envPath = path.join(__dirname, '..', 'config', 'default.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...rest] = trimmed.split('=');
        const key = k.trim();
        const val = rest.join('=').trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

const config = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
  BACKEND_WS_URL: process.env.BACKEND_WS_URL || 'ws://localhost:4000/api/v1/agents/channel',
  AGENT_NAME: process.env.AGENT_NAME || 'XploitX-Windows-01',
  NETWORK_MODE: process.env.NETWORK_MODE || 'LOCAL',
  PORT_RANGE_START: parseInt(process.env.PORT_RANGE_START || '41000', 10),
  PORT_RANGE_END: parseInt(process.env.PORT_RANGE_END || '41999', 10),
  CLEANUP_INTERVAL_SECONDS: parseInt(process.env.CLEANUP_INTERVAL_SECONDS || '15', 10),
  HEARTBEAT_INTERVAL_SECONDS: parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || '15', 10)
};

async function main() {
  const auth = new AgentAuthentication();
  const args = process.argv.slice(2);

  // 1. CLI Pairing Mode: node src/agent.js pair <CODE>
  if (args[0] === 'pair') {
    const code = args[1];
    if (!code) {
      console.error('\n[!] Missing pairing code.');
      console.log('Usage: node src/agent.js pair <PAIRING_CODE>');
      console.log('Example: node src/agent.js pair XPL-8F7K-2M4Q\n');
      process.exit(1);
    }

    console.log(`\n========================================================`);
    console.log(`  XPLOITX // AGENT PAIRING HANDSHAKE`);
    console.log(`  Target Backend: ${config.BACKEND_URL}`);
    console.log(`  Pairing Code:   ${code}`);
    console.log(`========================================================\n`);

    try {
      const creds = await auth.pair({
        pairingCode: code,
        backendUrl: config.BACKEND_URL,
        agentName: config.AGENT_NAME
      });
      console.log(`✓ [SUCCESS] Agent successfully registered & paired!`);
      console.log(`  Agent ID: ${creds.agentId}`);
      console.log(`  Name:     ${creds.name}`);
      console.log(`  Device:   ${creds.deviceId}`);
      console.log(`\nCredentials saved to: config/agent.json`);
      console.log(`Start the agent daemon with: npm start\n`);
      process.exit(0);
    } catch (err) {
      console.error(`\n[ERROR] Pairing failed: ${err.message}\n`);
      process.exit(1);
    }
  }

  // 2. Daemon Run Mode
  console.log(`\n========================================================`);
  console.log(`  XPLOITX // DOCKER AGENT DAEMON ONLINE`);
  console.log(`  Target Backend: ${config.BACKEND_URL}`);
  console.log(`  Network Mode:   ${config.NETWORK_MODE}`);
  console.log(`  Port Pool:      ${config.PORT_RANGE_START} - ${config.PORT_RANGE_END}`);
  console.log(`========================================================\n`);

  if (!auth.isPaired()) {
    console.error(`[!] Agent is not paired with a production XploitX backend.`);
    console.log(`Please obtain a pairing code from Admin -> Infrastructure -> Docker Agents.`);
    console.log(`Then run: node src/agent.js pair <PAIRING_CODE>\n`);
    process.exit(1);
  }

  const credentials = auth.getCredentials();
  console.log(`✓ Agent Credentials Loaded: ${credentials.agentId} (${credentials.name})`);

  // Check Docker Engine connectivity
  const docker = new DockerManager();
  const dockerOnline = await docker.isAvailable();
  if (!dockerOnline) {
    console.error(`\n[CRITICAL ERROR] Unable to reach Docker Engine API.`);
    console.error(`Ensure Docker Desktop is running on this Windows PC.`);
    console.error(`Socket Path checked: ${docker.socketPath}\n`);
    process.exit(1);
  }

  const dockerVer = await docker.getVersion().catch(() => ({ Version: 'Unknown' }));
  console.log(`✓ Docker Engine Connected: Version ${dockerVer.Version || 'Unknown'} (Socket: ${docker.socketPath})`);

  // Initialize Subsystems
  const portAllocator = new PortAllocator(config.PORT_RANGE_START, config.PORT_RANGE_END);
  const instanceManager = new AgentInstanceManager({
    dockerManager: docker,
    portAllocator,
    config
  });

  await instanceManager.reconcile();

  const cleanupWorker = new CleanupWorker({
    instanceManager,
    intervalSeconds: config.CLEANUP_INTERVAL_SECONDS
  });
  cleanupWorker.start();

  // Connect to C2 Backend via WebSocket
  const wsClient = new AgentWebSocketClient({
    wsUrl: config.BACKEND_WS_URL,
    credentials,
    instanceManager,
    heartbeatInterval: config.HEARTBEAT_INTERVAL_SECONDS
  });

  // Forward internal instance lifecycle events to backend
  instanceManager.on('status', (evt) => {
    wsClient.send({
      type: 'EVENT',
      event: 'INSTANCE_STATUS',
      agentId: credentials.agentId,
      ...evt,
      timestamp: new Date().toISOString()
    });
  });

  wsClient.connect();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[AGENT] Initiating graceful agent shutdown...');
    cleanupWorker.stop();
    wsClient.disconnect();
    console.log('[AGENT] Shutdown complete. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('[AGENT CRITICAL FAILURE]:', err);
  process.exit(1);
});
