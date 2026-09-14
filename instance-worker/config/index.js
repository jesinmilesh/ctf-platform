/**
 * XPLOITX // Dedicated Instance Worker Configuration (instance-worker/config/index.js)
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment files if present
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  port: parseInt(process.env.INTERNAL_WORKER_PORT || process.env.INSTANCE_WORKER_PORT || '5050', 10),
  host: process.env.INSTANCE_WORKER_BIND_HOST || '0.0.0.0',
  authSecret: process.env.INSTANCE_WORKER_AUTH_SECRET || 'xploitx_dev_internal_secret_change_in_production',
  
  docker: {
    socketPath: process.env.DOCKER_SOCKET || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'),
    host: process.env.DOCKER_HOST || null,
    apiVersion: process.env.DOCKER_API_VERSION || 'v1.45',
    network: process.env.DOCKER_NETWORK || 'xploitx-instances'
  },

  limits: {
    defaultCpus: 0.5,
    defaultMemory: '256m',
    defaultPids: 128,
    maxDurationMinutes: 120
  },

  ports: {
    min: parseInt(process.env.INSTANCE_PORT_START || '41000', 10),
    max: parseInt(process.env.INSTANCE_PORT_END || '41999', 10)
  }
};

module.exports = config;
