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
    this.domain = process.env.INSTANCE_DOMAIN || process.env.SERVER_HOST || 'xploitxctf.me';
    this.protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    this.domainTemplate = process.env.INSTANCE_DOMAIN_TEMPLATE || 'inst-{id}.xploitxctf.me';
  }

  /**
   * Resolve public target information for a running sandbox instance
   */
  resolveTargetEndpoints({ instanceId, port, challengeProtocol = 'HTTP' }) {
    const cleanId = String(instanceId).replace(/^inst-/, '');
    const subdomain = this.domainTemplate.replace('{id}', cleanId);
    
    const isHttp = (challengeProtocol || 'HTTP').toUpperCase() === 'HTTP';
    const webUrl = `${this.protocol}://${subdomain}`;
    const directHost = `${this.domain}:${port}`;

    return {
      instanceId,
      subdomain,
      domain: this.domain,
      port,
      protocol: challengeProtocol,
      // Public Web URL for browser-based challenges
      webUrl: isHttp ? webUrl : null,
      // Direct host:port for raw netcat / TCP / SSH targets
      directHost,
      // Pre-formatted netcat command for reverse / pwn missions
      netcatCommand: `nc ${this.domain} ${port}`,
      // Curl command
      curlCommand: `curl -I ${webUrl}`
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
