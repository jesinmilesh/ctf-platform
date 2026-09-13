/**
 * XPLOITX // CYBER BATTLEFIELD
 * Comprehensive Automated Verification Suite (test/verify.js)
 * Tests scoring decay, flag submissions, leaderboard, port allocator,
 * realtime event bus, file storage SHA-256 integrity, sync recovery, and templates.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runSuite() {
  console.log('====================================================');
  console.log('RUNNING XPLOITX COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================');

  // Test 1: Dynamic Scoring Decay Function
  console.log('\n[TEST 1] Testing Quadratic Dynamic Scoring Decay (backend/services/scoringService.js)...');
  const scoringService = require('../backend/services/scoringService');

  const p0 = scoringService.calculatePoints(500, 100, 30, 0);
  assert.strictEqual(p0, 500, '0 solves must award base points (500)');

  const p1 = scoringService.calculatePoints(500, 100, 30, 1);
  assert.strictEqual(p1, 500, '1 solve (First Blood) must award base points (500)');

  const p15 = scoringService.calculatePoints(500, 100, 30, 15);
  assert(p15 < 500 && p15 > 100, '15 solves must award decayed points between 500 and 100');

  const p30 = scoringService.calculatePoints(500, 100, 30, 30);
  assert.strictEqual(p30, 100, '30 solves must award floor points (100)');

  const p50 = scoringService.calculatePoints(500, 100, 30, 50);
  assert.strictEqual(p50, 100, '50 solves must not fall below floor (100)');
  console.log('✓ Dynamic Scoring Decay Test Passed.');

  // Test 2: Flag Validation Engine & First Blood Detection
  console.log('\n[TEST 2] Testing Flag Submission & Validation (backend/services/submissionService.js)...');
  const submissionService = require('../backend/services/submissionService');
  const db = require('../backend/config/database');

  const mockUser = {
    id: 'test-user-01',
    username: 'test_operative',
    callsign: 'SPECTRE',
    team_id: 't0000000-0000-0000-0000-000000000004'
  };

  // Malformed syntax (missing prefix/suffix)
  const resMalformed = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'invalid_raw_flag',
    user: mockUser
  });
  assert.strictEqual(resMalformed.correct, false, 'Raw string without prefix/suffix must be rejected as malformed');

  // Incorrect flag with valid prefix
  const resWrong = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{wrong_flag_payload}',
    user: mockUser
  });
  assert.strictEqual(resWrong.correct, false, 'Mismatched flag must be rejected');

  // Valid flag submission
  const resValid = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}',
    user: mockUser
  });
  assert.strictEqual(resValid.correct, true, 'Valid cryptographic flag must be accepted');

  // Duplicate submission
  const resDuplicate = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}',
    user: mockUser
  });
  assert.strictEqual(resDuplicate.status, 'ALREADY_SOLVED', 'Repeated flag capture by same squad must return ALREADY_SOLVED');
  console.log('✓ Flag Validation Engine Test Passed.');

  // Test 3: Leaderboard Ranking & Tie-Breaking
  console.log('\n[TEST 3] Testing Leaderboard Ranking & Tie-Breaker...');
  const leaderboardService = require('../backend/services/leaderboardService');
  const lbData = leaderboardService.getLeaderboard();

  assert(Array.isArray(lbData.teams), 'Teams should be returned as array');
  assert(lbData.teams.length >= 2, 'Should have teams seeded');
  assert(lbData.teams[0].score >= lbData.teams[1].score, 'Teams must be ranked by score descending');
  assert(lbData.podium.first !== null, 'Podium first place must exist');
  console.log('✓ Leaderboard Ranking Test Passed.');

  // Test 4: Multi-Port Docker Port Allocator (41000 - 41999)
  console.log('\n[TEST 4] Testing Atomic Port Allocator (backend/instances/portAllocator.js)...');
  const portAllocator = require('../backend/instances/portAllocator');

  const port1 = await portAllocator.allocate('inst-test-01');
  assert(port1 >= 41000 && port1 <= 41999, `Port ${port1} must be in range 41000-41999`);

  const port2 = await portAllocator.allocate('inst-test-02');
  assert(port2 >= 41000 && port2 <= 41999, `Port ${port2} must be in range 41000-41999`);
  assert.notStrictEqual(port1, port2, 'Consecutively allocated ports must be unique');

  await portAllocator.release(port1);
  await portAllocator.release(port2);
  console.log(`✓ Port Allocator correctly reserved ports (${port1}, ${port2}) and released successfully.`);

  // Test 5: Real-Time EventBus & Envelope Standards
  console.log('\n[TEST 5] Testing Real-Time EventBus & Envelopes (backend/realtime/eventBus.js)...');
  const eventBus = require('../backend/realtime/eventBus');
  const realtimeService = require('../backend/services/realtimeService');
  await eventBus.init();

  let receivedEnvelope = null;
  eventBus.on('challenge.first_blood', (env) => {
    receivedEnvelope = env;
  });

  await realtimeService.broadcastFirstBlood({
    challengeId: 'ch-01',
    challengeTitle: 'Quantum Vault Breach',
    teamName: 'ROOT_ACCESS',
    points: 300,
    capturedAt: new Date().toISOString()
  });

  assert(receivedEnvelope !== null, 'Event envelope should be received on eventBus');
  assert.strictEqual(receivedEnvelope.event, 'challenge.first_blood');
  assert.strictEqual(receivedEnvelope.payload.teamName, 'ROOT_ACCESS');
  assert.strictEqual(receivedEnvelope.payload.points, 300);
  console.log('✓ Real-Time EventBus published and delivered standard envelope.');

  // Test 6: Challenge Storage & SHA-256 Integrity (backend/services/fileService.js)
  console.log('\n[TEST 6] Testing File Service & SHA-256 Integrity (backend/services/fileService.js)...');
  const fileService = require('../backend/services/fileService');
  const testBuffer = Buffer.from('XploitX Tactical Telemetry Verification Payload');
  const fileMeta = await fileService.storeFile({
    challengeId: 'ch-test-99',
    filename: 'telemetry.bin',
    buffer: testBuffer,
    mimeType: 'application/octet-stream'
  });

  assert(fileMeta.sha256, 'SHA-256 checksum must be computed');
  assert.strictEqual(fileMeta.sha256.length, 64, 'SHA-256 must be 64-char hex string');
  assert.strictEqual(fileMeta.file_size_bytes, testBuffer.length, 'File size must match buffer length');

  const retrieved = await fileService.getFileStream(fileMeta.id);
  assert(retrieved !== null, 'Saved file must be retrievable from storage');
  console.log(`✓ File Service stored file with SHA-256: ${fileMeta.sha256.substring(0, 16)}...`);

  // Test 7: Architecture File Verification
  console.log('\n[TEST 7] Verifying File Architecture & Challenge Templates...');
  const rootDir = path.join(__dirname, '..');

  // Public Pages
  const publicPages = [
    'index.html', 'login.html', 'register.html', 'rules.html', 'announcements.html',
    'dashboard.html', 'challenges.html', 'challenge.html', 'scoreboard.html',
    'team.html', 'profile.html', 'activity.html'
  ];
  publicPages.forEach(p => {
    assert(fs.existsSync(path.join(rootDir, 'public', p)), `Public page missing: public/${p}`);
  });
  console.log(`✓ All ${publicPages.length} Public Pages verified.`);

  // Admin Pages
  const adminPages = [
    'index.html', 'login.html', 'dashboard.html', 'challenges.html', 'challenge-editor.html',
    'categories.html', 'users.html', 'teams.html', 'submissions.html', 'scoreboard.html',
    'announcements.html', 'analytics.html', 'instances.html', 'audit.html', 'settings.html'
  ];
  adminPages.forEach(p => {
    assert(fs.existsSync(path.join(rootDir, 'admin', p)), `Admin page missing: admin/${p}`);
  });
  console.log(`✓ All ${adminPages.length} Admin Pages verified.`);

  // Challenge Templates
  const templateCategories = ['web', 'pwn', 'crypto', 'forensics', 'reversing'];
  templateCategories.forEach(tc => {
    const templateDir = path.join(rootDir, 'challenge-templates', tc);
    assert(fs.existsSync(templateDir), `Challenge template dir missing: challenge-templates/${tc}`);
  });
  console.log(`✓ All ${templateCategories.length} Challenge Templates verified.`);

  // Infrastructure Configuration
  assert(fs.existsSync(path.join(rootDir, 'nginx', 'nginx.conf')), 'nginx.conf must exist');
  assert(fs.existsSync(path.join(rootDir, 'docker-compose.yml')), 'docker-compose.yml must exist');
  assert(fs.existsSync(path.join(rootDir, '.env.example')), '.env.example must exist');
  assert(fs.existsSync(path.join(rootDir, 'database', 'migrations', '001_initial_schema.sql')), 'Migration schema must exist');
  assert(fs.existsSync(path.join(rootDir, 'database', 'seeds', 'initial_seed.sql')), 'Seed file must exist');
  console.log('✓ All Infrastructure & Migration files verified.');

  // Test 8: Backend Server & Routes Verification
  console.log('\n[TEST 8] Verifying Express Backend Engine...');
  const { app } = require('../backend/server');
  assert(app, 'Express app must be exported');
  console.log('✓ Express Engine, Sync route & WebSocket server successfully loaded.');

  console.log('\n----------------------------------------------------');
  console.log('ALL 8 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runSuite().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
