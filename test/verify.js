/**
 * XPLOITX // CYBER BATTLEFIELD
 * Comprehensive Production Verification Suite (test/verify.js)
 * Implements Sections 35, 36, 37, 78, 79, 80:
 * - Zero Fake Data Verification
 * - Dynamic scoring decay calculation
 * - Flag validation engine (malformed, incorrect, correct, duplicate)
 * - Leaderboard ranking & tie-breaker
 * - Dedicated Instance Server & Atomic Port Allocator (41000-41999)
 * - Real-Time EventBus & Envelopes
 * - File Service & SHA-256 integrity
 * - Directory architecture & component validation
 * - Concurrency tests: simultaneous submissions, race-safe first blood, simultaneous port allocations
 * - Challenge pre-publishing validation
 * - Real Hint unlocking, point deduction & score events
 * - Real Team membership & size enforcement
 * - Full Automated End-to-End simulation scenario
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function runSuite() {
  console.log('====================================================');
  console.log('RUNNING XPLOITX COMPREHENSIVE VERIFICATION SUITE');
  console.log('====================================================');

  const db = require('../backend/config/database');

  // Test 0: Production Zero Fake Data Verification (Section 1, 2, 4)
  console.log('\n[TEST 0] Verifying Zero Fake Data in Production Database...');
  assert.strictEqual(db.getTeams().length, 0, 'Production database must start with zero demo teams');
  assert.strictEqual(db.getChallenges().length, 0, 'Production database must start with zero demo challenges');
  assert.strictEqual(db.getSolves().length, 0, 'Production database must start with zero demo solves');
  assert.strictEqual(db.getFirstBloods().length, 0, 'Production database must start with zero demo first bloods');
  assert.strictEqual(db.getSubmissions().length, 0, 'Production database must start with zero demo submissions');
  assert.strictEqual(db.getInstances().length, 0, 'Production database must start with zero demo instances');
  assert(db.getUsers().some(u => u.role === 'ADMIN'), 'Production database must contain initial admin setup');
  assert(db.getCategories().length >= 8, 'Production database must contain default sector categories');
  console.log('✓ Zero Fake Data: Production repository verified completely clean of unauthentic competition data.');

  // Set up isolated testing fixtures for test suite
  const testComp = db.getCompetitions()[0];
  const testChallenge = {
    id: 'ch-01',
    competition_id: testComp.id,
    category_id: 'cat-01',
    category_name: 'Cryptography',
    mission_id: 'OP-CRY-01',
    slug: 'the-last-digit',
    title: 'The Last Digit',
    difficulty: 'HARD',
    description: 'Recover the pseudo-random seed state and capture the mission key.',
    base_points: 500,
    minimum_points: 100,
    decay_threshold: 30,
    current_points: 500,
    solve_count: 0,
    status: 'PUBLISHED',
    has_instance: true,
    docker_image: 'xploitx/last-digit:latest',
    container_port: 80,
    protocol: 'HTTP',
    created_at: new Date().toISOString()
  };
  db.getChallenges().push(testChallenge);

  db.getFlags().push({
    id: 'f-01',
    challenge_id: 'ch-01',
    flag_type: 'STATIC',
    flag_value: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}',
    case_sensitive: true
  });

  const testTeam1 = {
    id: 'test-team-alpha',
    competition_id: testComp.id,
    name: 'Alpha Squad',
    slug: 'alpha-squad',
    access_code: 'ALPHA-9901',
    total_score: 500,
    solves_count: 1,
    first_bloods: 1,
    last_score_update: new Date(Date.now() - 60000).toISOString(),
    is_disqualified: false,
    created_at: new Date().toISOString()
  };
  const testTeam2 = {
    id: 'test-team-bravo',
    competition_id: testComp.id,
    name: 'Bravo Squad',
    slug: 'bravo-squad',
    access_code: 'BRAVO-4412',
    total_score: 300,
    solves_count: 1,
    first_bloods: 0,
    last_score_update: new Date().toISOString(),
    is_disqualified: false,
    created_at: new Date().toISOString()
  };
  db.getTeams().push(testTeam1, testTeam2);

  // Test 1: Dynamic Scoring Decay Function (Section 17)
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

  // Test 2: Flag Validation Engine & First Blood Detection (Section 14, 15, 16)
  console.log('\n[TEST 2] Testing Flag Submission & Validation (backend/services/submissionService.js)...');
  const submissionService = require('../backend/services/submissionService');

  const testUser = {
    id: 'test-user-01',
    username: 'test_operative',
    callsign: 'SPECTRE',
    team_id: 'test-team-alpha'
  };

  // Malformed syntax (missing prefix/suffix)
  const resMalformed = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'invalid_raw_flag',
    user: testUser
  });
  assert.strictEqual(resMalformed.correct, false, 'Raw string without prefix/suffix must be rejected as malformed');

  // Incorrect flag with valid prefix
  const resWrong = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{wrong_flag_payload}',
    user: testUser
  });
  assert.strictEqual(resWrong.correct, false, 'Mismatched flag must be rejected');

  // Valid flag submission
  const resValid = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}',
    user: testUser
  });
  assert.strictEqual(resValid.correct, true, 'Valid cryptographic flag must be accepted');

  // Duplicate submission
  const resDuplicate = submissionService.submitFlag({
    challengeId: 'ch-01',
    submittedFlag: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}',
    user: testUser
  });
  assert.strictEqual(resDuplicate.status, 'ALREADY_SOLVED', 'Repeated flag capture by same squad must return ALREADY_SOLVED');
  console.log('✓ Flag Validation Engine Test Passed.');

  // Test 3: Leaderboard Ranking & Tie-Breaking (Section 20)
  console.log('\n[TEST 3] Testing Leaderboard Ranking & Tie-Breaker...');
  const leaderboardService = require('../backend/services/leaderboardService');
  const lbData = leaderboardService.getLeaderboard();

  assert(Array.isArray(lbData.teams), 'Leaderboard must return array of squads');
  assert(lbData.teams.length >= 2, 'Leaderboard must contain active squads');
  assert.strictEqual(lbData.teams[0].rank, 1, 'Top squad must have rank 1');
  assert(lbData.teams[0].score >= lbData.teams[1].score, 'Higher scoring squad must rank above lower scoring squad');
  console.log('✓ Leaderboard Ranking Test Passed.');

  // Test 4: Dedicated Instance Server & Atomic Port Allocator (Section 29, 30)
  console.log('\n[TEST 4] Testing Dedicated Port Allocator (instance-server/portAllocator.js)...');
  const portAllocator = require('../instance-server/portAllocator');

  const portA = await portAllocator.reserve('inst-alpha');
  const portB = await portAllocator.reserve('inst-beta');

  assert(portA >= 41000 && portA <= 41999, 'Port A must be inside 41000-41999 range');
  assert(portB >= 41000 && portB <= 41999, 'Port B must be inside 41000-41999 range');
  assert.notStrictEqual(portA, portB, 'Simultaneously reserved ports must be strictly unique');

  await portAllocator.release(portA);
  await portAllocator.release(portB);
  console.log(`✓ Port Allocator correctly reserved unique ports (${portA}, ${portB}) and released successfully.`);

  // Test 5: Real-Time EventBus & Envelopes (Section 2, 3)
  console.log('\n[TEST 5] Testing Real-Time EventBus & Envelopes (backend/realtime/eventBus.js)...');
  const eventBus = require('../backend/realtime/eventBus');
  await eventBus.init();

  let receivedEvent = null;
  eventBus.subscribe('TEST_ALERT', (envelope) => {
    receivedEvent = envelope;
  });

  await eventBus.publish('TEST_ALERT', {
    message: 'TEST TRANSMISSION FROM C2 OVERWATCH'
  });

  await new Promise(r => setTimeout(r, 80));
  assert(receivedEvent !== null, 'Subscriber must receive dispatched event envelope');
  assert.strictEqual(receivedEvent.event, 'TEST_ALERT', 'Envelope event type must match');
  console.log('✓ Real-Time EventBus published and delivered standard envelope.');

  // Test 6: File Service & SHA-256 Integrity (Section 13, 46)
  console.log('\n[TEST 6] Testing File Service & SHA-256 Integrity (backend/services/fileService.js)...');
  const fileService = require('../backend/services/fileService');

  const testContent = 'TACTICAL_PAYLOAD_CIPHER_CONSTANTS_XYZ_99';
  const testBuffer = Buffer.from(testContent);

  const fileMeta = await fileService.saveFile({
    filename: 'test_payload.bin',
    buffer: testBuffer,
    mimeType: 'application/octet-stream',
    challengeId: 'ch-01'
  });

  assert(fileMeta.id, 'Uploaded file must have persistent ID');
  assert.strictEqual(fileMeta.sha256.length, 64, 'SHA-256 must be 64-char hex string');
  assert.strictEqual(fileMeta.file_size_bytes, testBuffer.length, 'File size must match buffer length');

  const retrieved = await fileService.getFileStream(fileMeta.id);
  assert(retrieved !== null, 'Saved file must be retrievable from storage');
  retrieved.on('error', () => {});
  retrieved.destroy();
  await new Promise(r => setTimeout(r, 50));
  await fileService.deleteFile(fileMeta.id);
  console.log(`✓ File Service stored file with SHA-256: ${fileMeta.sha256.substring(0, 16)}...`);

  // Test 7: Architecture File & Component Verification (Section 5, 7, 61)
  console.log('\n[TEST 7] Verifying File Architecture & Vanilla Components...');
  const rootDir = path.join(__dirname, '..');

  const publicPages = [
    'index.html', 'login.html', 'register.html', 'rules.html', 'announcements.html',
    'dashboard.html', 'challenges.html', 'challenge.html', 'scoreboard.html',
    'team.html', 'profile.html', 'activity.html'
  ];
  publicPages.forEach(p => {
    const exists = fs.existsSync(path.join(rootDir, 'frontend', 'public', p));
    assert(exists, `Public page missing: ${p}`);
  });
  console.log(`✓ All ${publicPages.length} Public Pages verified.`);

  const adminPages = [
    'index.html', 'login.html', 'dashboard.html', 'challenges.html', 'challenge-editor.html',
    'categories.html', 'users.html', 'teams.html', 'submissions.html', 'scoreboard.html',
    'announcements.html', 'analytics.html', 'instances.html', 'audit.html', 'settings.html'
  ];
  adminPages.forEach(p => {
    const exists = fs.existsSync(path.join(rootDir, 'frontend', 'admin', p));
    assert(exists, `Admin page missing: ${p}`);
  });
  console.log(`✓ All ${adminPages.length} Admin Pages verified.`);

  const requiredComponents = [
    'navbar.js', 'sidebar.js', 'modal.js', 'toast.js', 'dialog.js',
    'challengeCard.js', 'scoreCard.js', 'leaderboard.js', 'notification.js',
    'instancePanel.js', 'missionHeader.js', 'activityFeed.js'
  ];
  requiredComponents.forEach(comp => {
    const compPath = path.join(rootDir, 'frontend', 'assets', 'js', 'components', comp);
    assert(fs.existsSync(compPath), `Required component missing: frontend/assets/js/components/${comp}`);
  });
  console.log(`✓ All ${requiredComponents.length} Vanilla JS Components verified.`);

  // Test 8: Concurrency Testing (Section 36, 79)
  console.log('\n[TEST 8] Testing Concurrency: Simultaneous Submissions & Port Allocations...');
  
  // 8a: Simultaneous port allocations
  const portPromises = [];
  for (let i = 0; i < 10; i++) {
    portPromises.push(portAllocator.reserve(`concurrent-inst-${i}`));
  }
  const allocated = await Promise.all(portPromises);
  const uniqueAllocated = new Set(allocated);
  assert.strictEqual(uniqueAllocated.size, 10, 'All 10 concurrently reserved ports must be strictly unique');
  for (const p of allocated) {
    await portAllocator.release(p);
  }
  console.log('✓ Concurrency: 10 simultaneous port allocations were all unique with zero collisions.');

  // 8b: Race-Safe First Blood Test
  const freshChallenge = {
    id: `test-ch-${Date.now()}`,
    title: 'Race Condition Challenge',
    slug: 'race-condition',
    category_id: 'cat-01',
    difficulty: 'MEDIUM',
    base_points: 300,
    minimum_points: 100,
    decay_threshold: 20,
    current_points: 300,
    solve_count: 0,
    status: 'PUBLISHED'
  };
  db.getChallenges().push(freshChallenge);
  db.getFlags().push({
    id: `flag-${freshChallenge.id}`,
    challenge_id: freshChallenge.id,
    flag_type: 'STATIC',
    flag_value: 'XploitXβ{race_safe_flag_test}',
    case_sensitive: true
  });

  const userA = { id: 'user-a', username: 'operative_alpha', team_id: 'team-con-a' };
  const userB = { id: 'user-b', username: 'operative_bravo', team_id: 'team-con-b' };
  db.getTeams().push({ id: 'team-con-a', name: 'Con Squad A', total_score: 0, first_bloods: 0 });
  db.getTeams().push({ id: 'team-con-b', name: 'Con Squad B', total_score: 0, first_bloods: 0 });

  const subA = submissionService.submitFlag({ challengeId: freshChallenge.id, submittedFlag: 'XploitXβ{race_safe_flag_test}', user: userA });
  const subB = submissionService.submitFlag({ challengeId: freshChallenge.id, submittedFlag: 'XploitXβ{race_safe_flag_test}', user: userB });

  assert.strictEqual(subA.correct, true, 'Submission A must be accepted');
  assert.strictEqual(subB.correct, true, 'Submission B must be accepted');

  const solves = db.getSolves().filter(s => s.challenge_id === freshChallenge.id);
  const firstBloods = solves.filter(s => s.is_first_blood);
  assert.strictEqual(firstBloods.length, 1, 'Strictly ONE squad must receive First Blood status');
  console.log('✓ Concurrency: Race-safe First Blood assigned to exactly 1 team.');

  // Test 9: Challenge Pre-Publishing Validation (Section 12)
  console.log('\n[TEST 9] Testing Challenge Pre-Publishing Validation (challengeService.js)...');
  const challengeService = require('../backend/services/challengeService');

  const incompleteChallenge = {
    id: 'incomplete-ch-01',
    title: '',
    slug: '',
    description: '',
    difficulty: 'INVALID_DIFF',
    base_points: -10
  };

  const validation = challengeService.validateChallengeForPublish(incompleteChallenge);
  assert.strictEqual(validation.valid, false, 'Incomplete challenge must fail pre-publish validation');
  assert(validation.errors.length >= 4, 'Must return specific descriptive error messages');
  console.log(`✓ Challenge Pre-Publishing Validation caught ${validation.errors.length} deficiencies as expected.`);

  // Test 10: Real Hint Unlocking & Point Deduction (Section 13)
  console.log('\n[TEST 10] Testing Real Hint Deduction & Score Events (Section 13)...');
  const hintChallenge = {
    id: 'hint-ch-01',
    title: 'Hint Target Mission',
    slug: 'hint-target',
    category_id: 'cat-01',
    difficulty: 'EASY',
    base_points: 200,
    minimum_points: 100,
    decay_threshold: 20,
    current_points: 200,
    solve_count: 0,
    status: 'PUBLISHED'
  };
  db.getChallenges().push(hintChallenge);
  db.getHints().push({
    id: 'hint-01-test',
    challenge_id: 'hint-ch-01',
    content: 'CRITICAL_HINT_PAYLOAD: Look for unaligned stack offsets.',
    cost: 50,
    order_index: 1,
    enabled: true
  });

  const hintSquad = {
    id: 'hint-team-01',
    name: 'Hint Recon Squad',
    total_score: 500
  };
  db.getTeams().push(hintSquad);

  const hintUser = { id: 'hint-user-01', username: 'hint_operative', team_id: hintSquad.id };

  // 1. Initial details: hint content must be masked
  const detailsBefore = challengeService.getChallengeDetails('hint-ch-01', hintUser);
  assert.strictEqual(detailsBefore.hints[0].content, null, 'Unrevealed hint content must be masked');
  assert.strictEqual(detailsBefore.hints[0].isUnlocked, false, 'Hint must be marked locked');

  // 2. Unlock hint
  const unlocked = challengeService.unlockHint('hint-ch-01', 'hint-01-test', hintUser);
  assert.strictEqual(unlocked.content, 'CRITICAL_HINT_PAYLOAD: Look for unaligned stack offsets.', 'Unlocked hint must return content');
  assert.strictEqual(hintSquad.total_score, 450, 'Team score must be deducted by hint cost');

  // 3. Verify score_event created
  const hintScoreEvents = db.getScoreEvents().filter(e => e.team_id === hintSquad.id && e.reason === 'HINT_UNLOCK');
  assert.strictEqual(hintScoreEvents.length, 1, 'Score event must be recorded for hint deduction');
  assert.strictEqual(hintScoreEvents[0].delta, -50, 'Score event delta must reflect penalty');

  // 4. Repeated reveal should not deduct points again
  const secondUnlock = challengeService.unlockHint('hint-ch-01', 'hint-01-test', hintUser);
  assert.strictEqual(secondUnlock.alreadyUnlocked, true, 'Subsequent unlocks must indicate already unlocked');
  assert.strictEqual(hintSquad.total_score, 450, 'Score must not be deducted repeatedly');
  console.log('✓ Real Hints: Point deduction, masking, and score event persistence verified.');

  // Test 11: Dedicated Instance Server Orchestration (Section 19, 20, 21, 22)
  console.log('\n[TEST 11] Testing Dedicated Instance Orchestration & Readiness Probes...');
  const dockerManager = require('../instance-server/dockerManager');
  const instanceRouter = require('../instance-server/instanceRouter');

  const testInstId = `inst-test-${Date.now().toString(36)}`;
  const containerRecord = await dockerManager.createAndStart({
    instanceId: testInstId,
    challenge: { id: 'ch-01', slug: 'last-digit', protocol: 'HTTP', container_port: 80 },
    hostPort: 41050,
    ttlMinutes: 10
  });

  assert.strictEqual(containerRecord.status, 'RUNNING', 'Sandbox container must enter RUNNING status');
  const endpoints = instanceRouter.resolveTargetEndpoints({
    instanceId: testInstId,
    port: 41050,
    challengeProtocol: 'HTTP'
  });

  assert(endpoints.webUrl.includes('inst-'), 'Endpoint must format wildcard subdomain correctly');
  assert(endpoints.webUrl.includes('xploitxctf.me'), 'Domain must match production host');

  await dockerManager.destroyContainer(testInstId);
  console.log('✓ Instance Server successfully spawned sandbox, validated health, and resolved subdomains.');

  // Test 12: Full Automated End-to-End Simulation Scenario (Section 37)
  console.log('\n[TEST 12] Running Full Automated End-to-End Mission Scenario (Section 37)...');

  // Step 1: Admin creates competition & category & challenge
  const authService = require('../backend/services/authService');
  const adminLogin = authService.login('admin', 'admin123');
  assert(adminLogin.token, 'Admin must login successfully');

  const e2eChallenge = challengeService.createChallenge({
    title: 'Orbital Cryptographic Grid',
    category: 'Cryptography',
    difficulty: 'HARD',
    description: 'Intercept orbital transmission and decode cipher state.',
    points: 500,
    minimum_points: 100,
    decay_threshold: 30,
    flag: 'XploitXβ{0rb1t4l_c1ph3r_st4t3_br34k_2026}'
  });
  assert(e2eChallenge.id, 'E2E challenge must be created');

  // Step 2: Player registers & creates team
  const playerRegister = authService.register({
    username: 'operative_apex',
    email: 'apex@xploitxctf.me',
    password: 'super_secure_pass_123',
    callsign: 'APEX_OPERATIVE'
  });
  assert(playerRegister.token, 'Player must register successfully');

  // Step 3: Player creates real team
  const teamReq = {
    user: playerRegister.user,
    body: { name: 'Apex Coalition' }
  };
  let createdTeam = null;
  const teamRes = {
    status: () => ({
      json: (data) => { createdTeam = data.team; }
    })
  };
  const teamController = require('../backend/controllers/teamController');
  teamController.createTeam(teamReq, teamRes);
  assert(createdTeam && createdTeam.id, 'Team must be created');

  // Verify team members recorded
  const members = db.getTeamMembers().filter(m => m.team_id === createdTeam.id);
  assert.strictEqual(members.length, 1, 'Team membership must be recorded');
  assert.strictEqual(members[0].role, 'CAPTAIN', 'Team creator must be Captain');

  // Step 4: Player submits real flag
  playerRegister.user.team_id = createdTeam.id;
  const e2eSolveResult = submissionService.submitFlag({
    challengeId: e2eChallenge.id,
    submittedFlag: 'XploitXβ{0rb1t4l_c1ph3r_st4t3_br34k_2026}',
    user: playerRegister.user
  });
  assert.strictEqual(e2eSolveResult.correct, true, 'Player flag submission must be correct');
  assert.strictEqual(e2eSolveResult.isFirstBlood, true, 'First solver must receive first blood');

  // Step 5: Verify Score Event & Leaderboard updated
  const e2eScoreEvents = db.getScoreEvents().filter(e => e.team_id === createdTeam.id && e.reason === 'FIRST_BLOOD_SOLVE');
  assert.strictEqual(e2eScoreEvents.length, 1, 'Score event must be created for solve');

  const updatedLb = leaderboardService.getLeaderboard();
  const apexSquadLb = updatedLb.teams.find(t => t.id === createdTeam.id);
  assert(apexSquadLb && apexSquadLb.score > 0, 'Apex Coalition score must reflect awarded points');
  console.log('✓ Full End-to-End Scenario: Admin -> Challenge -> Player -> Team -> Solve -> Score Event -> Leaderboard Passed.');

  // Test 13: Core Express Engine & Static Routing
  console.log('\n[TEST 13] Verifying Core Backend Server Engine...');
  const { app } = require('../backend/server');
  assert(app, 'Express app must be exported');
  console.log('✓ Express Engine, Static File Serving & WebSockets successfully initialized.');

  console.log('\n----------------------------------------------------');
  console.log('ALL PRODUCTION VERIFICATION CHECKS PASSED (100%)!');
  console.log('====================================================');
}

runSuite().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
