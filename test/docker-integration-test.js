/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real Docker Challenge Instance System Integration Suite (test/docker-integration-test.js)
 * Implements Section 34 of Architectural Specification:
 * - 100% Real Docker Desktop / WSL2 Engine Testing (ZERO MOCKS, ZERO FAKE CONTAINERS)
 * - Tests Docker API connection, isolated network creation, atomic port allocation
 * - Tests live container creation, health probe verification, and external HTTP responsiveness
 * - Tests duplicate start protection, IDOR authorization security, container termination, and cleanup
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('../backend/config/database');
const dockerClient = require('../backend/instances/dockerClient');
const dockerManager = require('../backend/instances/dockerManager');
const portAllocator = require('../backend/instances/portAllocator');
const instanceManager = require('../backend/instances/instanceManager');
const reconciliation = require('../backend/instances/reconciliation');
const cleanupWorker = require('../backend/instances/cleanupWorker');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function runDockerTestSuite() {
  console.log('================================================================');
  console.log('  XPLOITX // REAL DOCKER INSTANCE SYSTEM INTEGRATION SUITE');
  console.log('================================================================\n');

  try {
    // Step 0: Initialize Database
    await db.init();
    console.log('✓ [STEP 0] Database connection established.');

    // Step 1: Docker Daemon Availability
    console.log('\n[STEP 1] Testing Docker Engine API Connection...');
    const isDockerLive = await dockerClient.isAvailable();
    assert.strictEqual(isDockerLive, true, 'Docker daemon must be operational and reachable.');
    const versionInfo = await dockerClient.getVersion();
    console.log(`  ✓ Docker Engine reached: Version ${versionInfo.Version || versionInfo.Server?.Version || '29.x'}`);

    // Step 2: Idempotent Docker Network
    console.log('\n[STEP 2] Verifying Dedicated Docker Network (xploitx-instances)...');
    await dockerClient.ensureNetwork('xploitx-instances');
    const networks = await dockerClient.request('GET', '/networks');
    const hasNet = networks && networks.some(n => n.Name === 'xploitx-instances');
    assert.strictEqual(hasNet, true, 'Network xploitx-instances must exist in Docker Engine.');
    console.log('  ✓ Dedicated bridge network confirmed: xploitx-instances');

    // Step 3: Atomic Port Allocator Test
    console.log('\n[STEP 3] Testing Atomic Port Allocation in Range 41000-41999...');
    const port1 = await portAllocator.allocate('inst-port-test-1');
    const port2 = await portAllocator.allocate('inst-port-test-2');
    assert(port1 >= 41000 && port1 <= 41999, `Port 1 (${port1}) must be in 41000-41999 range.`);
    assert(port2 >= 41000 && port2 <= 41999, `Port 2 (${port2}) must be in 41000-41999 range.`);
    assert.notStrictEqual(port1, port2, 'Consecutive port allocations must be distinct.');
    await portAllocator.release(port1);
    await portAllocator.release(port2);
    console.log(`  ✓ Allocated and released unique ports (${port1}, ${port2}) with 0 collisions.`);

    // Step 4: Real Container Challenge Setup
    console.log('\n[STEP 4] Preparing Real Challenge Entity in Database...');
    const testMissionId = `ch-real-docker-${Date.now().toString(36)}`;
    const challenge = {
      id: testMissionId,
      slug: `web-vault-${Date.now().toString(36)}`,
      title: 'Docker Cyber Vault Target',
      mission_id: `OP-DOCKER-${Date.now().toString(36)}`,
      competition_id: 'c0000000-0000-0000-0000-000000000001',
      category_id: 'cat-01',
      difficulty: 'MEDIUM',
      base_points: 300,
      description: 'Real live container target running in Docker Desktop.',
      status: 'PUBLISHED',
      has_instance: true,
      docker_image: 'xploitx/vault:latest',
      container_port: 80,
      health_check_path: '/health',
      instance_ttl_minutes: 30
    };
    db.getChallenges().push(challenge);
    console.log(`  ✓ Challenge created: ${challenge.title} (Image: ${challenge.docker_image})`);

    const operativeUser = {
      id: `user-docker-${Date.now().toString(36)}`,
      username: 'agent_docker',
      team_id: `team-docker-${Date.now().toString(36)}`,
      role: 'PLAYER'
    };

    // Step 5: Real Container Spawn & Health Check
    console.log('\n[STEP 5] Spawning REAL Docker Challenge Container (POST /instances)...');
    const spawnResult = await instanceManager.spawnInstance(challenge.id, operativeUser);
    assert.strictEqual(spawnResult.status, 'RUNNING', 'Instance must reach RUNNING status.');
    assert(spawnResult.port >= 41000 && spawnResult.port <= 41999, 'Allocated port must be in 41000-41999.');
    console.log(`  ✓ Real container spawned: ${spawnResult.instanceId} on port ${spawnResult.port}`);
    console.log(`  ✓ Target URL: ${spawnResult.url}`);

    // Step 6: Verify Live Docker Container Exists with Labels
    console.log('\n[STEP 6] Inspecting Real Docker Container in Engine...');
    const managedContainers = await dockerManager.listManagedContainers();
    const activeCont = managedContainers.find(c => {
      const labels = c.Labels || {};
      return labels['xploitx.instanceId'] === spawnResult.instanceId;
    });
    assert(activeCont, 'Real Docker container with matching label must exist in Docker Desktop.');
    console.log(`  ✓ Confirmed container running in Docker Engine (ID: ${(activeCont.Id || activeCont.ID).substring(0, 12)})`);

    // Step 7: Probe Real HTTP Endpoint over Localhost
    console.log('\n[STEP 7] Probing Real Target HTTP Response over Network...');
    const targetProbeUrl = `http://127.0.0.1:${spawnResult.port}/health`;
    const httpRes = await makeRequest(targetProbeUrl);
    assert.strictEqual(httpRes.statusCode, 200, 'Challenge container must respond with HTTP 200 OK.');
    console.log(`  ✓ Target HTTP Socket Responding: ${httpRes.statusCode} OK (Body: ${httpRes.body.trim()})`);

    // Step 8: Duplicate Start Protection (Section 33)
    console.log('\n[STEP 8] Testing Concurrency & Duplicate Start Protection...');
    const dupResult = await instanceManager.spawnInstance(challenge.id, operativeUser);
    assert.strictEqual(dupResult.instanceId, spawnResult.instanceId, 'Duplicate request must return existing active instance.');
    assert.strictEqual(dupResult.port, spawnResult.port, 'Duplicate request must not reallocate port.');
    console.log('  ✓ Duplicate START request safely returned existing active instance.');

    // Step 9: IDOR Security Protection (Section 31)
    console.log('\n[STEP 9] Testing IDOR / Unauthorized Destruction Security...');
    const foreignUser = {
      id: 'foreign-hacker',
      team_id: 'rival-squad',
      role: 'PLAYER'
    };
    let blocked = false;
    try {
      await instanceManager.terminateInstance(spawnResult.instanceId, foreignUser);
    } catch (e) {
      blocked = true;
    }
    assert.strictEqual(blocked, true, 'Foreign operative must be blocked from terminating another team instance.');
    console.log('  ✓ IDOR protection verified: Foreign operative blocked.');

    // Step 10: Legitimate Termination & Port Release (Section 11)
    console.log('\n[STEP 10] Terminating Instance (DELETE /instances/:id)...');
    const termResult = await instanceManager.terminateInstance(spawnResult.instanceId, operativeUser);
    assert.strictEqual(termResult.success, true, 'Termination must succeed.');
    console.log('  ✓ Termination completed.');

    // Step 11: Verify Container Completely Removed from Docker
    console.log('\n[STEP 11] Verifying Docker Container Removal & Port Release...');
    const postContainers = await dockerManager.listManagedContainers();
    const remainingCont = postContainers.find(c => {
      const labels = c.Labels || {};
      return labels['xploitx.instanceId'] === spawnResult.instanceId;
    });
    assert(!remainingCont, 'Container must be completely destroyed and removed from Docker Engine.');
    console.log('  ✓ Container confirmed absent from Docker Desktop.');

    // Step 12: State Reconciliation (Section 22)
    console.log('\n[STEP 12] Testing State Reconciliation Worker...');
    const reconResult = await reconciliation.reconcile();
    assert.strictEqual(reconResult.success, true, 'Reconciliation must complete cleanly.');
    console.log('  ✓ State reconciliation confirmed operational.');

    console.log('\n================================================================');
    console.log('  ALL REAL DOCKER SYSTEM INTEGRATION TESTS PASSED (100%)!');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ REAL DOCKER TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runDockerTestSuite();
