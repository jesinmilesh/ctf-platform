/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Routing & Subdomain Generator (backend/instances/instanceRouter.js)
 * Implements Sections 21, 22, 23, 24 of Architectural Blueprint:
 * Maps container instances to subdomains (inst-183.xploitxctf.me) and direct host:port.
 */

const env = require('../config/environment');

class InstanceRouter {
  constructor() {
    this.host = env.INSTANCE_HOST || 'xploitxctf.me';
    this.template = env.INSTANCE_DOMAIN_TEMPLATE || 'inst-{id}.xploitxctf.me';
  }

  /**
   * Resolve public endpoint descriptors for an allocated instance
   */
  resolveEndpoints(instanceId, port) {
    const subdomain = this.template.replace('{id}', instanceId.replace(/^inst-/, ''));
    const directHost = `${this.host}:${port}`;
    const httpUrl = `http://${subdomain}`;
    const directUrl = `http://${directHost}`;

    return {
      host: this.host,
      port,
      subdomain,
      httpUrl,
      directUrl,
      // Target string for terminal/netcat/curl
      connectionString: `${this.host} ${port}`
    };
  }
}

const instanceRouter = new InstanceRouter();
module.exports = instanceRouter;
