/**
 * XPLOITX // CYBER BATTLEFIELD
 * Instance Router & Endpoint Resolver (backend/instances/instanceRouter.js)
 * Implements Section 17 of Architectural Specification:
 * - Development mode: resolves to http://127.0.0.1:<port>
 * - Production mode: resolves to configured domain / subdomain architecture
 */

const env = require('../config/environment');

class InstanceRouter {
  constructor() {
    this.isProd = process.env.NODE_ENV === 'production';
    this.defaultHost = this.isProd ? (process.env.INSTANCE_HOST || env.INSTANCE_HOST || 'xploitxctf.me') : (process.env.INSTANCE_HOST || '127.0.0.1');
    this.template = process.env.INSTANCE_DOMAIN_TEMPLATE || env.INSTANCE_DOMAIN_TEMPLATE || 'inst-{id}.xploitxctf.me';
  }

  resolveEndpoints(instanceId, port, protocol = 'http') {
    const cleanId = String(instanceId).replace(/^inst-/, '');
    const subdomain = this.template.replace('{id}', cleanId);
    const host = process.env.INSTANCE_HOST || this.defaultHost;
    const proto = (protocol || 'http').toLowerCase();

    const isLocal = host === '127.0.0.1' || host === 'localhost';
    const targetHost = isLocal ? '127.0.0.1' : subdomain;
    const url = `${proto}://${targetHost}:${port}`;
    const directUrl = `${proto}://${host}:${port}`;

    return {
      instanceId,
      host,
      port: Number(port),
      protocol: proto,
      subdomain,
      url,
      httpUrl: url,
      directUrl,
      connectionString: `${host} ${port}`,
      netcatCommand: `nc ${host} ${port}`,
      curlCommand: `curl -I ${url}`
    };
  }
}

const instanceRouter = new InstanceRouter();
module.exports = instanceRouter;
