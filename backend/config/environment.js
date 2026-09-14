/**
 * XPLOITX // CYBER BATTLEFIELD
 * Environment Configuration (backend/config/environment.js)
 */

const path = require('path');
const fs = require('fs');

// Simple .env parser without external dependencies
function loadEnv() {
  const backendEnv = path.join(__dirname, '..', '.env');
  const rootEnv = path.join(__dirname, '..', '..', '.env');
  const envPath = fs.existsSync(backendEnv) ? backendEnv : rootEnv;
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        const key = k.trim();
        const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

module.exports = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://xploitx_admin:battlefield_pass@localhost:5432/xploitx_db',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'xploitx_tactical_cyber_secret_key_2026',
  FLAG_PREFIX: process.env.FLAG_PREFIX || 'XploitXβ{',
  FLAG_SUFFIX: process.env.FLAG_SUFFIX || '}',
  
  // Instance Orchestration Port Range (Section 13 & 43)
  INSTANCE_PORT_START: parseInt(process.env.INSTANCE_PORT_START || '41000', 10),
  INSTANCE_PORT_END: parseInt(process.env.INSTANCE_PORT_END || '41999', 10),
  INSTANCE_HOST: process.env.INSTANCE_HOST || 'xploitxctf.me',
  INSTANCE_DOMAIN_TEMPLATE: process.env.INSTANCE_DOMAIN_TEMPLATE || 'inst-{id}.xploitxctf.me',
  INSTANCE_DEFAULT_TTL_MINUTES: parseInt(process.env.INSTANCE_DEFAULT_TTL_MINUTES || '30', 10),
  
  // Container Resource Limits (Section 45)
  CONTAINER_CPU_LIMIT: process.env.CONTAINER_CPU_LIMIT || '0.5',
  CONTAINER_MEMORY_LIMIT: process.env.CONTAINER_MEMORY_LIMIT || '256m',
  CONTAINER_PIDS_LIMIT: parseInt(process.env.CONTAINER_PIDS_LIMIT || '64', 10)
};
