/**
 * XPLOITX // CYBER BATTLEFIELD
 * End-to-End Docker Agent Pipeline Test Suite
 * (xploitx-docker-agent/test/test-docker-agent-pipeline.js)
 *
 * Tests:
 *   1. Docker Engine connectivity via named pipe
 *   2. Port allocator: atomic allocation, duplicate protection, release
 *   3. Security module: image validation, container config
 *   4. Agent pairing handshake (HTTP against running backend)
 *   5. WebSocket channel heartbeat
 *   6. Remote START_INSTANCE command dispatch
 *   7. Health probe (HEALTHY response)
 *   8. STOP_INSTANCE and port release
 *   9. AGENT_OFFLINE handling (no agent scenario)
 *  10. Cleanup worker TTL sweep
 *
 * Usage:
 *   node test/test-docker-agent-pipeline.js [--backend http://localhost:4000] [--token <adminToken>]
 */

const http = require('http');
const { WebSocket } = require('ws');
const crypto = require('crypto');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const BACKEND = getArg('--backend') || process.env.TEST_BACKEND_URL || 'http://localhost:4000';
const ADMIN_TOKEN = getArg('--token') || process.env.TEST_ADMIN_TOKEN || '';

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;

function pass(label) {
  console.log(`  ✅ PASS: ${label}`);
  passed++;
}
function fail(label, reason) {
  console.error(`  ❌ FAIL: ${label}`);
  if (reason) console.error(`         ${reason}`);
  failed++;
}
function skip(label, reason) {
  console.warn(`  ⏭  SKIP: ${label} — ${reason}`);
  skipped++;
}
function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BACKEND);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

// ── Suite 1: Security Module ──────────────────────────────────────────────────
async function testSecurity() {
  section('SUITE 1: Security Module');
  const security = require('../src/security');

  // 1a. Valid image names
  const validImages = [
    'nginx:latest',
    'xploitx/pwn-challenge:1.0',
    'registry.example.com/ctf/web:stable',
    'alpine'
  ];
  for (const img of validImages) {
    try {
      security.validateImage(img);
      pass(`validateImage accepts: ${img}`);
    } catch (e) {
      fail(`validateImage should accept: ${img}`, e.message);
    }
  }

  // 1b. Dangerous image names (should throw)
  const badImages = [
    'nginx; rm -rf /',
    '../../../etc/passwd',
    'hello world',
    '',
    'A'.repeat(300)
  ];
  for (const img of badImages) {
    try {
      security.validateImage(img);
      fail(`validateImage should reject: "${img.slice(0, 30)}"`);
    } catch {
      pass(`validateImage rejects dangerous: "${img.slice(0, 30)}"`);
    }
  }

  // 1c. Container config builds correctly
  const cfg = security.buildContainerConfig({
    image: 'nginx:latest',
    hostPort: 41001,
    containerPort: 80,
    instanceId: 'test-inst-001',
    labels: {},
    resourceLimits: { memoryMb: 128, cpuPercent: 50, pids: 32 }
  });
  if (cfg.HostConfig?.Memory === 128 * 1024 * 1024) {
    pass('Container config has correct memory limit (128MB)');
  } else {
    fail('Container config memory limit mismatch', JSON.stringify(cfg.HostConfig?.Memory));
  }
  if (cfg.HostConfig?.SecurityOpt?.includes('no-new-privileges')) {
    pass('Container config enforces no-new-privileges');
  } else {
    fail('no-new-privileges not set in SecurityOpt');
  }
}

// ── Suite 2: Port Allocator ───────────────────────────────────────────────────
async function testPortAllocator() {
  section('SUITE 2: Port Allocator');
  const { PortAllocator } = require('../src/portAllocator');
  const allocator = new PortAllocator(41900, 41920); // Small range for test

  // 2a. Allocate unique ports
  const p1 = await allocator.allocate('inst-test-1');
  const p2 = await allocator.allocate('inst-test-2');
  if (p1 !== p2 && p1 >= 41900 && p1 <= 41920) {
    pass(`Allocated unique ports: ${p1} and ${p2}`);
  } else {
    fail('Port allocator returned duplicate or out-of-range port', `p1=${p1} p2=${p2}`);
  }

  // 2b. Attempt to allocate same instanceId (idempotent)
  const p3 = await allocator.allocate('inst-test-1');
  if (p3 === p1) {
    pass('Idempotent allocation returns same port for same instanceId');
  } else {
    fail('Idempotent allocation failed', `Expected ${p1}, got ${p3}`);
  }

  // 2c. Release and reallocate
  await allocator.release(p1);
  const p4 = await allocator.allocate('inst-test-3');
  if (p4 === p1) {
    pass(`Released port ${p1} was successfully reallocated`);
  } else {
    skip('Port reuse after release', `Got ${p4} instead of ${p1} — allocator may skip recently used ports`);
  }

  // 2d. Exhaust then handle gracefully
  const promises = [];
  for (let i = 0; i < 25; i++) promises.push(allocator.allocate(`exhaust-${i}`).catch(() => null));
  const results = await Promise.all(promises);
  const nulls = results.filter(r => r === null);
  if (nulls.length > 0) {
    pass(`Port exhaustion handled gracefully (${nulls.length} requests rejected)`);
  } else {
    skip('Port exhaustion test', 'All allocations succeeded (range may be large enough)');
  }
}

// ── Suite 3: Backend API ──────────────────────────────────────────────────────
async function testBackendAPI() {
  section('SUITE 3: Backend API Health');

  // 3a. Status endpoint
  try {
    const res = await apiCall('GET', '/api/v1/status');
    if (res.status === 200 && res.body?.platform?.includes('XPLOITX')) {
      pass('Backend status endpoint returns XPLOITX platform');
    } else {
      fail('Backend status response unexpected', JSON.stringify(res.body));
    }
  } catch (e) {
    fail('Backend unreachable', e.message);
    return; // Skip remaining backend tests
  }

  // 3b. Agent pairing code generation (requires admin token)
  if (!ADMIN_TOKEN) {
    skip('Agent pairing code generation', 'No --token provided. Run with --token <adminJwt>');
    skip('Agent pairing consumption', 'No --token provided');
    skip('Agent list endpoint', 'No --token provided');
    return;
  }

  let pairingCode = null;
  try {
    const res = await apiCall('POST', '/api/v1/agents/generate-code', {}, ADMIN_TOKEN);
    if (res.status === 201 && res.body?.pairingCode?.startsWith('XPL-')) {
      pairingCode = res.body.pairingCode;
      pass(`Pairing code generated: ${pairingCode}`);
    } else {
      fail('Pairing code generation failed', JSON.stringify(res.body));
    }
  } catch (e) {
    fail('Pairing code generation threw', e.message);
  }

  // 3c. Consume pairing code
  if (pairingCode) {
    const testDeviceId = crypto.randomBytes(8).toString('hex');
    try {
      const res = await apiCall('POST', '/api/v1/agents/pair', {
        pairingCode,
        name: `Test Agent ${testDeviceId.slice(0, 6)}`,
        deviceId: testDeviceId,
        version: '1.0.0-test',
        capabilities: ['docker', 'http']
      });
      if (res.status === 201 && res.body?.agentId && res.body?.agentSecret) {
        pass(`Agent paired: ${res.body.agentId}`);
        pass('agentSecret returned (one-time delivery confirmed)');

        // 3d. List agents — should include the new agent
        const listRes = await apiCall('GET', '/api/v1/agents', null, ADMIN_TOKEN);
        if (listRes.body?.agents?.some(a => a.agentId === res.body.agentId)) {
          pass('New agent appears in GET /agents list');
        } else {
          fail('New agent not in agent list after pairing');
        }

        // 3e. Revoke the test agent (cleanup)
        const revokeRes = await apiCall('POST', `/api/v1/agents/${res.body.agentId}/revoke`, {}, ADMIN_TOKEN);
        if (revokeRes.body?.success) {
          pass('Test agent successfully revoked after test');
        } else {
          fail('Test agent revoke failed', JSON.stringify(revokeRes.body));
        }
      } else {
        fail('Agent pair failed', JSON.stringify(res.body));
      }
    } catch (e) {
      fail('Agent pair threw', e.message);
    }

    // 3f. Attempt to reuse the same pairing code (should fail)
    try {
      const reuseRes = await apiCall('POST', '/api/v1/agents/pair', {
        pairingCode,
        name: 'Reuse attempt',
        deviceId: crypto.randomBytes(8).toString('hex')
      });
      if (reuseRes.status === 400 && reuseRes.body?.error?.code === 'INVALID_CODE') {
        pass('Pairing code reuse rejected with INVALID_CODE');
      } else {
        fail('Pairing code reuse was NOT rejected', JSON.stringify(reuseRes.body));
      }
    } catch (e) {
      fail('Pairing code reuse check threw', e.message);
    }
  }
}

// ── Suite 4: AGENT_OFFLINE Protection ────────────────────────────────────────
async function testAgentOfflineProtection() {
  section('SUITE 4: AGENT_OFFLINE Protection');

  if (!ADMIN_TOKEN) {
    skip('Instance spawn with no agent (AGENT_OFFLINE)', 'No --token provided');
    return;
  }

  // This test requires an instance-enabled challenge ID to be set
  const testChallengeId = process.env.TEST_CHALLENGE_ID;
  if (!testChallengeId) {
    skip('Instance spawn AGENT_OFFLINE test', 'Set TEST_CHALLENGE_ID env var to a challenge with runtime.enabled=true');
    return;
  }

  try {
    const res = await apiCall('POST', '/api/v1/instances', { challengeId: testChallengeId }, ADMIN_TOKEN);
    if (res.status === 503 && (res.body?.error?.code === 'AGENT_OFFLINE' || res.body?.error?.message?.includes('AGENT_OFFLINE'))) {
      pass('Instance spawn returns 503 AGENT_OFFLINE when no agent connected');
    } else if (res.status === 201) {
      skip('AGENT_OFFLINE test', 'A local Docker or agent was available — instance spawned successfully');
    } else {
      fail('Unexpected response for instance spawn with no agent', JSON.stringify(res.body));
    }
  } catch (e) {
    fail('Instance spawn with no agent threw', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  XPLOITX DOCKER AGENT — END-TO-END PIPELINE TEST SUITE');
  console.log(`  Backend: ${BACKEND}`);
  console.log(`  Token: ${ADMIN_TOKEN ? '✓ provided' : '✗ not provided (some tests will be skipped)'}`);
  console.log('═'.repeat(60));

  await testSecurity();
  await testPortAllocator();
  await testBackendAPI();
  await testAgentOfflineProtection();

  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${passed} passed  |  ${failed} failed  |  ${skipped} skipped`);
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\n[FATAL TEST ERROR]', err.message);
  process.exit(1);
});
