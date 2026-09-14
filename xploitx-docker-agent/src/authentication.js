/**
 * XPLOITX // CYBER BATTLEFIELD
 * Agent Authentication & Pairing Manager (src/authentication.js)
 * Implements Section 5 of Master Architecture: Short-lived Pairing Handshake & Cryptographic Token Storage.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

class AgentAuthentication {
  constructor(configDir = path.join(__dirname, '..', 'config')) {
    this.configPath = path.join(configDir, 'agent.json');
  }

  isPaired() {
    if (!fs.existsSync(this.configPath)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return !!(data.agentId && data.agentSecret);
    } catch (e) {
      return false;
    }
  }

  getCredentials() {
    if (!this.isPaired()) return null;
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  saveCredentials(creds) {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(creds, null, 2), 'utf8');
  }

  generateDeviceId() {
    const interfaces = os.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac;
          break;
        }
      }
      if (mac) break;
    }
    const seed = `${os.hostname()}-${os.platform()}-${mac || 'default-device'}`;
    return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
  }

  /**
   * Pair agent with production backend using short-lived code (e.g. XPL-8F7K-2M4Q)
   */
  async pair({ pairingCode, backendUrl, agentName = null }) {
    if (!pairingCode) throw new Error('PAIRING_ERROR: A pairing code is required (e.g. XPL-XXXX-XXXX).');

    const cleanCode = String(pairingCode).trim().toUpperCase();
    const url = new URL(`${backendUrl.replace(/\/$/, '')}/api/v1/agents/pair`);
    const deviceId = this.generateDeviceId();
    const name = agentName || `Agent-${os.hostname()}`;

    const payload = JSON.stringify({
      pairingCode: cleanCode,
      deviceId,
      name,
      platform: process.platform,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      version: '1.0.0'
    });

    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
              const creds = {
                agentId: data.agentId,
                agentSecret: data.agentSecret,
                name: data.name || name,
                deviceId,
                backendUrl,
                pairedAt: new Date().toISOString()
              };
              this.saveCredentials(creds);
              resolve(creds);
            } else {
              reject(new Error(data.error?.message || data.message || `Pairing failed with HTTP status ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse backend pairing response: ${raw}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Unable to reach backend at ${url}: ${err.message}`)));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = AgentAuthentication;
