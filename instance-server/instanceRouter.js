/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Instance Server - Wildcard Subdomain & Route Generator (instance-server/instanceRouter.js)
 * Implements Section 34 & 35 of Master Production Specification:
 * - Generates clean public endpoints: https://instance-<id>.xploitxctf.me
 * - Generates direct host connection strings for binary/netcat/curl targets (e.g. nc xploitxctf.me 41023)
 * - Validates and normalizes subdomains
 */

class InstanceRouter {
  constructor() {
    this.domain = process.env.INSTANCE_BASE_DOMAIN || process.env.INSTANCE_DOMAIN || process.env.SERVER_HOST || 'xploitxctf.me';
    this.protocol = (process.env.INSTANCE_PROTOCOL || 'http').toLowerCase();
    this.domainTemplate = process.env.INSTANCE_DOMAIN_TEMPLATE || 'inst-{id}.xploitxctf.me';
  }

  /**
   * Resolve public target information for a running sandbox instance
   */
  resolveTargetEndpoints({ instanceId, port, challengeProtocol = 'http' }) {
    const cleanId = String(instanceId).replace(/^inst-/, '');
    const subdomain = this.domainTemplate.replace('{id}', cleanId);
    
    const proto = (challengeProtocol || this.protocol || 'http').toLowerCase();
    const url = `${proto}://${subdomain}:${port}`;
    const directHost = `${this.domain}:${port}`;
    const directUrl = `${proto}://${directHost}`;

    return {
      instanceId,
      subdomain,
      domain: this.domain,
      port: Number(port),
      protocol: proto,
      // Public Web URL for browser-based challenges
      url,
      webUrl: url,
      directUrl,
      // Direct host:port for raw netcat / TCP / SSH targets
      directHost,
      // Pre-formatted netcat command for reverse / pwn missions
      netcatCommand: `nc ${this.domain} ${port}`,
      // Curl command
      curlCommand: `curl -I ${url}`
    };
  }

  /**
   * Parse incoming Host header to extract instance ID
   */
  parseInstanceFromHost(hostHeader = '') {
    const host = hostHeader.split(':')[0].toLowerCase();
    const regex = /^inst-([a-z0-9_-]+)\./i;
    const match = host.match(regex);
    if (match) {
      return `inst-${match[1]}`;
    }
    return null;
  }
}

module.exports = new InstanceRouter();
