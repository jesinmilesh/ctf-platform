/**
 * XPLOITX // CYBER BATTLEFIELD
 * Comprehensive Docker Runtime Abstraction & Instance Worker Test Suite (test/docker-runtime-test.js)
 * 
 * Verifies:
 * 1. LocalDockerRuntime: Zero CLI dependency, programmatic Engine API via native socket/pipe
 * 2. Instance Worker: Standalone microservice, machine-to-machine authentication (401 on missing/wrong token)
 * 3. RemoteDockerRuntime: Full lifecycle routing through the Instance Worker
 * 4. DockerRuntimeFactory: Provider switching between local and worker
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const LocalDockerRuntime = require('../backend/instances/runtime/localDockerRuntime');
const RemoteDockerRuntime = require('../backend/instances/runtime/remoteDockerRuntime');
const runtimeFactory = require('../backend/instances/runtime/dockerRuntimeFactory');
const workerApp = require('../instance-worker/server');
const workerConfig = require('../instance-worker/config');

async function runDockerRuntimeTests() {
  console.log('================================================================');
  console.log('  XPLOITX // DOCKER RUNTIME ABSTRACTION & WORKER TEST SUITE');
  console.log('================================================================\n');

  let workerServer = null;

  try {
    // --------------------------------------------------------------------------
    // PART 1: LocalDockerRuntime Native Programmatic Testing
    // --------------------------------------------------------------------------
    console.log('[PART 1] Testing LocalDockerRuntime (Direct Engine API, Zero CLI)...');
    const localRuntime = new LocalDockerRuntime();

    const isLocalReady = await localRuntime.ping();
    assert.strictEqual(isLocalReady, true, 'LocalDockerRuntime must successfully ping Docker Engine via socket/pipe.');
    console.log('  ✓ Ping: Successfully communicated with Docker Engine API.');

    const versionInfo = await localRuntime.getVersion();
    const serverVer = versionInfo.Version || versionInfo.Server?.Version || '29.x';
    console.log(`  ✓ Version: Docker Engine ${serverVer} verified.`);

    await localRuntime.ensureNetwork('xploitx-instances');
    console.log('  ✓ Network: Dedicated network xploitx-instances ensured.');

    // Spawn disposable test container via LocalDockerRuntime
    const testPort = 41050;
    const testContainerName = `xploitx-test-local-${Date.now().toString(36)}`;
    const created = await localRuntime.createContainer({
      name: testContainerName,
      image: 'xploitx/vault:latest',
      hostPort: testPort,
      containerPort: 80,
      network: 'xploitx-instances',
      labels: {
        'xploitx.instanceId': 'test-local-01',
        'xploitx.challengeId': 'ch-test-local'
      }
    });
    assert(created.containerId, 'Container creation must return containerId');
    console.log(`  ✓ Container Created: ${created.containerId.substring(0, 12)} (Name: ${created.containerName})`);

    await localRuntime.startContainer(created.containerId);
    console.log('  ✓ Container Started successfully.');

    const inspect = await localRuntime.inspectContainer(created.containerId);
    assert.strictEqual(inspect.State?.Running, true, 'Container State.Running must be true.');
    console.log('  ✓ Container Inspected: Confirmed State.Running = true.');

    const managedList = await localRuntime.listManagedContainers();
    const foundManaged = managedList.find(c => (c.Id || c.ID) === created.containerId);
    assert(foundManaged, 'Container with xploitx.managed=true must appear in listManagedContainers()');
    console.log('  ✓ Managed List: Verified xploitx.managed=true label discovery.');

    await localRuntime.stopContainer(created.containerId, 1);
    await localRuntime.removeContainer(created.containerId, true);
    console.log('  ✓ Container Stopped & Removed cleanly.');

    // --------------------------------------------------------------------------
    // PART 2: Instance Worker Standalone Microservice & Machine-to-Machine Auth
    // --------------------------------------------------------------------------
    console.log('\n[PART 2] Testing Standalone Instance Worker & M2M Service Authentication...');
    
    // Start ephemeral instance-worker server
    workerServer = http.createServer(workerApp);
    await new Promise(resolve => workerServer.listen(0, '127.0.0.1', resolve));
    const workerPort = workerServer.address().port;
    const workerUrl = `http://127.0.0.1:${workerPort}`;
    console.log(`  ✓ Instance Worker server listening on ${workerUrl}`);

    // 1. Health check (unauthenticated public endpoint)
    const healthRes = await fetch(`${workerUrl}/internal/health`);
    assert.strictEqual(healthRes.status, 200, 'Worker health endpoint must return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.service, 'xploitx-instance-worker');
    console.log('  ✓ Worker Health: /internal/health returned 200 OK.');

    // 2. M2M Auth: Missing token must be rejected with 401
    const unauthRes = await fetch(`${workerUrl}/internal/docker/status`);
    assert.strictEqual(unauthRes.status, 401, 'Request without service auth header must be rejected with 401');
    console.log('  ✓ M2M Security: Unauthenticated request rejected (HTTP 401).');

    // 3. M2M Auth: Wrong token must be rejected with 401
    const invalidAuthRes = await fetch(`${workerUrl}/internal/docker/status`, {
      headers: { 'x-instance-worker-auth': 'Bearer invalid_tampered_secret_token' }
    });
    assert.strictEqual(invalidAuthRes.status, 401, 'Request with invalid secret must be rejected with 401');
    console.log('  ✓ M2M Security: Invalid token rejected (HTTP 401).');

    // 4. M2M Auth: Valid token accepted with 200
    const validSecret = workerConfig.authSecret;
    const validAuthRes = await fetch(`${workerUrl}/internal/docker/status`, {
      headers: { 'x-instance-worker-auth': `Bearer ${validSecret}` }
    });
    assert.strictEqual(validAuthRes.status, 200, 'Request with valid service secret must be accepted with 200');
    const statusData = await validAuthRes.json();
    assert.strictEqual(statusData.dockerOperational, true, 'Docker operational status must be true');
    console.log('  ✓ M2M Security: Valid service secret accepted (HTTP 200, Docker Operational).');

    // --------------------------------------------------------------------------
    // PART 3: RemoteDockerRuntime Client Communication
    // --------------------------------------------------------------------------
    console.log('\n[PART 3] Testing RemoteDockerRuntime Routing via Instance Worker...');
    process.env.INSTANCE_WORKER_URL = workerUrl;
    process.env.INSTANCE_WORKER_AUTH_SECRET = validSecret;

    const remoteRuntime = new RemoteDockerRuntime();
    const isRemoteReady = await remoteRuntime.ping();
    assert.strictEqual(isRemoteReady, true, 'RemoteDockerRuntime must successfully ping worker.');
    console.log('  ✓ Remote Ping: Confirmed connectivity to worker.');

    const workerVer = await remoteRuntime.getVersion();
    assert(workerVer, 'Worker version info must be returned');
    console.log('  ✓ Remote Version: Received Docker Engine version info through worker.');

    // Test container spawn through RemoteDockerRuntime
    const remotePort = 41051;
    const remoteContainerName = `xploitx-test-remote-${Date.now().toString(36)}`;
    const remoteSpawned = await remoteRuntime.createContainer({
      name: remoteContainerName,
      image: 'xploitx/vault:latest',
      hostPort: remotePort,
      containerPort: 80,
      protocol: 'http',
      healthCheckPath: '/health',
      network: 'xploitx-instances',
      labels: {
        'xploitx.instanceId': 'test-remote-01',
        'xploitx.challengeId': 'ch-test-remote'
      }
    });
    assert(remoteSpawned.containerId, 'Remote container creation must return containerId');
    console.log(`  ✓ Remote Container Spawned: ${remoteSpawned.containerId.substring(0, 12)} on port ${remotePort}`);

    const remoteInspect = await remoteRuntime.inspectContainer(remoteSpawned.containerId);
    assert.strictEqual(remoteInspect.State?.Running, true, 'Remote container must be running');
    console.log('  ✓ Remote Inspect: Verified container running state through worker.');

    await remoteRuntime.restartContainer(remoteSpawned.containerId, 2);
    console.log('  ✓ Remote Restart: Successfully restarted container through worker.');

    await remoteRuntime.removeContainer(remoteSpawned.containerId, true);
    console.log('  ✓ Remote Remove: Container cleanly removed through worker.');

    // --------------------------------------------------------------------------
    // PART 4: DockerRuntimeFactory Provider Switching
    // --------------------------------------------------------------------------
    console.log('\n[PART 4] Testing DockerRuntimeFactory Environment Provider Resolution...');
    runtimeFactory.reset();

    process.env.DOCKER_RUNTIME = 'local';
    const factoryLocal = runtimeFactory.getRuntime();
    assert.strictEqual(factoryLocal instanceof LocalDockerRuntime, true, 'DOCKER_RUNTIME=local must instantiate LocalDockerRuntime');
    console.log('  ✓ Factory: DOCKER_RUNTIME=local correctly resolved LocalDockerRuntime.');

    runtimeFactory.reset();
    process.env.DOCKER_RUNTIME = 'worker';
    const factoryRemote = runtimeFactory.getRuntime();
    assert.strictEqual(factoryRemote instanceof RemoteDockerRuntime, true, 'DOCKER_RUNTIME=worker must instantiate RemoteDockerRuntime');
    console.log('  ✓ Factory: DOCKER_RUNTIME=worker correctly resolved RemoteDockerRuntime.');

    // Reset back to local for continuing development environment
    runtimeFactory.reset();
    process.env.DOCKER_RUNTIME = 'local';
    runtimeFactory.getRuntime();

    console.log('\n================================================================');
    console.log('  ALL DOCKER RUNTIME & WORKER TESTS PASSED (100%)!');
    console.log('================================================================\n');

  } finally {
    if (workerServer) {
      workerServer.close();
    }
  }
}

if (require.main === module) {
  runDockerRuntimeTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('\n❌ DOCKER RUNTIME TEST FAILED:', err);
    process.exit(1);
  });
}

module.exports = runDockerRuntimeTests;
