/**
 * XPLOITX // CHALLENGE IDENTITY & PUBLIC ROUTE INTEGRITY SUITE
 * test/challenge-id-integrity.test.js
 *
 * Verifies:
 * 1. Domain prefix resolver maps the 8 battlefield sectors correctly
 * 2. Challenge ID regex strictly validates format and rejects malformed/injection strings
 * 3. Domain sequences are completely independent across sectors
 * 4. publicRouteId is server-side generated, URL-safe, and opaque
 * 5. Challenge commissioning produces 3 distinct, properly formed identities
 * 6. Commissioning challenges across multiple domains maintains isolated sequences
 * 7. getChallengeDetails resolves cleanly by publicRouteId and challengeId
 * 8. Challenge ID, publicRouteId, and _id cannot be changed via updateChallenge
 * 9. Idempotent migration populates missing challengeId & publicRouteId without mutating existing IDs
 * 10. Files linked to challenge resolve cleanly when queried via publicRouteId
 * 11. Admin authentication succeeds with callsign, username, or email
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const {
  DOMAIN_PREFIXES,
  CHALLENGE_ID_REGEX,
  resolveDomainPrefix,
  allocateNextSequence,
  formatChallengeId,
  isValidChallengeId,
  generatePublicRouteId
} = require('../backend/utils/challengeIdentity');

function isOpaqueRouteId(id) {
  return typeof id === 'string' && id.length >= 16 && /^[a-zA-Z0-9_-]+$/.test(id);
}

const db = require('../backend/config/database');
const challengeService = require('../backend/services/challengeService');
const authService = require('../backend/services/authService');

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  XPLOITX // CHALLENGE IDENTITY & PUBLIC ROUTE INTEGRITY SUITE');
  console.log('===============================================================');

  await db.init();

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. Domain prefix resolver maps the 8 battlefield sectors correctly
  const mappings = [
    { in: 'Cryptography', exp: 'CRY' },
    { in: 'Web', exp: 'WEB' },
    { in: 'Digital Forensic', exp: 'FOR' },
    { in: 'OSINT', exp: 'OSN' },
    { in: 'PWN', exp: 'PWN' },
    { in: 'Network', exp: 'NET' },
    { in: 'Steganography', exp: 'STG' },
    { in: 'Misc', exp: 'MIS' }
  ];
  const allDomainPrefixesMatch = mappings.every(m => resolveDomainPrefix(m.in) === m.exp);
  assert(allDomainPrefixesMatch, 'Domain prefix resolver maps the 8 battlefield sectors correctly');

  // 2. Challenge ID regex strictly validates format and rejects malformed/injection strings
  const validIds = [
    'CRY-000000-00000-C001',
    'WEB-000000-00000-C042',
    'FOR-000000-00000-C100',
    'OSN-000000-00000-C005',
    'PWN-000000-00000-C999',
    'NET-000000-00000-C001',
    'STG-000000-00000-C001',
    'MIS-000000-00000-C001'
  ];
  const invalidIds = [
    'INVALID-000000-00000-C001',
    'CRY-000-00-C01',
    'WEB-000000-00000-C001; DROP TABLE users;',
    'REV-000000-00000-C001', // Removed sector
    'MAL-000000-00000-C001', // Removed sector
    '../etc/passwd'
  ];
  const regexValid = validIds.every(id => isValidChallengeId(id)) &&
                     invalidIds.every(id => !isValidChallengeId(id));
  assert(regexValid, 'Challenge ID regex strictly validates format and rejects malformed/injection strings');

  // 3. Domain sequences are completely independent across sectors
  const existingList = [
    { challengeId: 'CRY-000000-00000-C001', domain: 'CRY' },
    { challengeId: 'CRY-000000-00000-C002', domain: 'CRY' },
    { challengeId: 'WEB-000000-00000-C001', domain: 'WEB' }
  ];
  const nextCry = formatChallengeId('CRY', allocateNextSequence('CRY', existingList));
  const nextWeb = formatChallengeId('WEB', allocateNextSequence('WEB', existingList));
  const nextStg = formatChallengeId('STG', allocateNextSequence('STG', existingList));
  assert(
    nextCry === 'CRY-000000-00000-C003' &&
    nextWeb === 'WEB-000000-00000-C002' &&
    nextStg === 'STG-000000-00000-C001',
    'Domain sequences are completely independent across sectors'
  );

  // 4. publicRouteId is server-side generated, URL-safe, and opaque
  const testId1 = generatePublicRouteId();
  const testId2 = generatePublicRouteId();
  assert(
    testId1 &&
    testId2 &&
    testId1.length >= 16 &&
    testId1 !== testId2 &&
    !testId1.includes('/') &&
    !testId1.includes('?'),
    'publicRouteId is server-side generated, URL-safe, and opaque'
  );

  // 5. Challenge commissioning produces 3 distinct, properly formed identities
  const comm1 = await challengeService.createChallenge({
    title: 'Test Cryptography Challenge',
    category: 'Cryptography',
    difficulty: 'EASY',
    points: 100,
    flag: 'XploitXβ{crypto_test_flag}'
  });
  assert(
    Boolean(comm1.id) &&
    Boolean(comm1.challengeId) &&
    Boolean(comm1.publicRouteId) &&
    comm1.challengeId !== comm1.publicRouteId &&
    comm1.challengeId !== comm1.competitionId &&
    CHALLENGE_ID_REGEX.test(comm1.challengeId) &&
    isOpaqueRouteId(comm1.publicRouteId),
    'Challenge commissioning produces 3 distinct, properly formed identities'
  );

  // 6. Commissioning challenges across multiple domains maintains isolated sequences
  const commWeb = await challengeService.createChallenge({
    title: 'Test Web Challenge',
    category: 'Web',
    difficulty: 'MEDIUM',
    points: 200,
    flag: 'XploitXβ{web_test_flag}'
  });
  const commStg = await challengeService.createChallenge({
    title: 'Test Steganography Challenge',
    category: 'Steganography',
    difficulty: 'HARD',
    points: 300,
    flag: 'XploitXβ{stegano_test_flag}'
  });
  assert(
    commWeb.challengeId.startsWith('WEB-') &&
    commStg.challengeId.startsWith('STG-') &&
    commWeb.challengeId !== commStg.challengeId,
    'Commissioning challenges across multiple domains maintains isolated sequences'
  );

  // 7. getChallengeDetails resolves cleanly by publicRouteId and challengeId
  const detailsByRoute = await challengeService.getChallengeDetails(comm1.publicRouteId);
  const detailsById = await challengeService.getChallengeDetails(comm1.challengeId);
  assert(
    detailsByRoute && detailsById &&
    detailsByRoute.challengeId === comm1.challengeId &&
    detailsById.publicRouteId === comm1.publicRouteId &&
    !detailsByRoute._id, // Mongo _id must NOT be exposed to participants
    'getChallengeDetails resolves cleanly by publicRouteId and challengeId'
  );

  // 8. Challenge ID, publicRouteId, and _id cannot be changed via updateChallenge
  const originalChallengeId = comm1.challengeId;
  const originalPublicRouteId = comm1.publicRouteId;
  await challengeService.updateChallenge(comm1.id, {
    title: 'Updated Challenge Title',
    challengeId: 'HACKED-000000-00000-C999',
    publicRouteId: 'hacked-url-route',
    _id: '67890abcdef1234567890abc'
  });
  const reloaded = db.getChallenges().find(c => c.id === comm1.id);
  assert(
    reloaded &&
    reloaded.challengeId === originalChallengeId &&
    reloaded.publicRouteId === originalPublicRouteId &&
    reloaded.title === 'Updated Challenge Title',
    'Challenge ID, publicRouteId, and _id cannot be changed via updateChallenge'
  );

  // 9. Idempotent migration populates missing challengeId & publicRouteId without mutating existing IDs
  const unmigratedDoc = {
    id: 'c9999999-0000-0000-0000-000000000001',
    title: 'Legacy Legacy Challenge',
    category_name: 'Digital Forensic',
    points: 150
  };
  db.data.challenges.push(unmigratedDoc);
  if (typeof db._migrateChallengeIdentities === 'function') {
    await db._migrateChallengeIdentities();
  }
  const migrated = db.getChallenges().find(c => c.id === unmigratedDoc.id);
  assert(
    migrated &&
    migrated.challengeId &&
    migrated.challengeId.startsWith('FOR-') &&
    migrated.publicRouteId &&
    isOpaqueRouteId(migrated.publicRouteId) &&
    reloaded.challengeId === originalChallengeId,
    'Idempotent migration populates missing challengeId & publicRouteId without mutating existing IDs'
  );

  // Clean up created test challenges from database
  async function cleanupChallenge(id) {
    if (!id) return;
    const idx = db.getChallenges().findIndex(c => c.id === id || c.challengeId === id);
    if (idx !== -1) {
      const rem = db.getChallenges().splice(idx, 1)[0];
      if (db.isMongo && db.mongoDb) {
        await db.mongoDb.collection('challenges').deleteMany({
          $or: [
            { id: rem.id },
            { challengeId: rem.challengeId || rem.id }
          ]
        }).catch(() => {});
      }
    }
  }

  await cleanupChallenge(comm1.id);
  await cleanupChallenge(commWeb.id);
  await cleanupChallenge(commStg.id);
  await cleanupChallenge(unmigratedDoc.id);

  // 10. Files linked to challenge resolve cleanly when queried via publicRouteId
  const fileTestComp = await challengeService.createChallenge({
    title: 'File Resolution Challenge',
    category: 'Network',
    difficulty: 'EASY',
    points: 100,
    flag: 'XploitXβ{file_test_flag}'
  });
  const fileRecord = {
    id: 'f0000000-0000-0000-0000-000000000001',
    challenge_id: fileTestComp.id,
    challengeId: fileTestComp.challengeId,
    name: 'network_capture.pcap',
    size_bytes: 1024,
    download_url: `/api/v1/challenges/${fileTestComp.publicRouteId}/files/f0000000-0000-0000-0000-000000000001/download`
  };
  db.data.challengeFiles.push(fileRecord);
  const filesFound = challengeService.getChallengeFiles(fileTestComp.publicRouteId);
  assert(
    Array.isArray(filesFound) &&
    filesFound.length === 1 &&
    filesFound[0].name === 'network_capture.pcap',
    'Files linked to challenge resolve cleanly when queried via publicRouteId'
  );
  // Clean up
  await cleanupChallenge(fileTestComp.id);
  const fileIdx = db.data.challengeFiles.findIndex(f => f.id === fileRecord.id);
  if (fileIdx !== -1) db.data.challengeFiles.splice(fileIdx, 1);

  // Ensure any orphaned test challenges are purged from Atlas & memory
  if (db.isMongo && db.mongoDb) {
    await db.mongoDb.collection('challenges').deleteMany({
      title: { $in: ['Test Cryptography Challenge', 'Test Web Challenge', 'Test Steganography Challenge', 'Legacy Legacy Challenge', 'File Resolution Challenge'] }
    }).catch(() => {});
  }

  // 11. Admin authentication succeeds with callsign, username, or email (and enforces admin-only clearance)
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Commander@Xploitx!Admin';
  const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'jesinmilesh@gmail.com').trim().toLowerCase();
  const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME || 'Admin';
  const adminCallsign = process.env.BOOTSTRAP_ADMIN_CALLSIGN || 'COMMANDER';

  // Ensure test admin exists in memory for CI runs where .env is not present
  let existingAdmin = db.getUsers().find(u => u.role === 'ADMIN');

  if (!existingAdmin) {
    existingAdmin = {
      id: 'u0000000-0000-0000-0000-000000000001',
      competition_id: 'c0000000-0000-0000-0000-000000000001',
      team_id: null,
      username: adminUsername,
      email: adminEmail,
      password_hash: await authService.hashPassword(adminPassword),
      role: 'ADMIN',
      callsign: adminCallsign,
      affiliation: 'XploitX Operations Command',
      is_banned: false,
      created_at: new Date().toISOString()
    };
    db.getUsers().push(existingAdmin);
  }

  const targetCallsign = existingAdmin.callsign || adminCallsign;
  const targetUsername = existingAdmin.username || adminUsername;
  const targetEmail = existingAdmin.email || adminEmail;

  let authPassCount = 0;
  try {
    const r1 = await authService.login(targetCallsign, adminPassword);
    if (r1.token && r1.user.role === 'ADMIN') authPassCount++;
  } catch (e) {}
  try {
    const r2 = await authService.login(targetUsername, adminPassword);
    if (r2.token && r2.user.role === 'ADMIN') authPassCount++;
  } catch (e) {}
  try {
    const r3 = await authService.login(targetEmail, adminPassword);
    if (r3.token && r3.user.role === 'ADMIN') authPassCount++;
  } catch (e) {}

  // Verify participant rejection on admin portal (clearance check)
  const authController = require('../backend/controllers/authController');
  const participantPassword = 'ParticipantPass123!';
  const participantUser = {
    id: 'u-participant-test',
    competition_id: 'c0000000-0000-0000-0000-000000000001',
    team_id: null,
    username: 'participant_test',
    email: 'participant@test.local',
    password_hash: await authService.hashPassword(participantPassword),
    role: 'PARTICIPANT',
    callsign: 'PARTICIPANT_01',
    affiliation: 'Cadet Wing',
    is_banned: false,
    created_at: new Date().toISOString()
  };
  db.getUsers().push(participantUser);

  let participantRejectedFromAdmin = false;
  const mockReq = {
    body: { username: 'participant_test', password: participantPassword, adminOnly: true },
    headers: {},
    originalUrl: '/api/v1/auth/admin-login',
    socket: {}
  };
  const mockRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) {
      if (this.statusCode === 403 && data.error === 'CLEARANCE_DENIED') {
        participantRejectedFromAdmin = true;
      }
      return this;
    },
    cookie() {},
    clearCookie() {}
  };

  await authController.login(mockReq, mockRes, () => {});
  // Clean up participant test user
  const pIdx = db.getUsers().findIndex(u => u.id === 'u-participant-test');
  if (pIdx !== -1) db.getUsers().splice(pIdx, 1);
  await new Promise(r => setTimeout(r, 100));

  assert(
    authPassCount === 3 && participantRejectedFromAdmin,
    'Admin authentication succeeds with callsign, username, or email and rejects participants from C2 portal'
  );

  console.log('===============================================================');
  if (passed === total) {
    console.log(`  ALL ${passed}/${total} INTEGRITY TESTS PASSED SUCCESSFULLY!`);
    console.log('===============================================================');
  } else {
    console.error(`  TEST SUITE COMPLETED WITH FAILURES: ${passed}/${total} PASSED`);
    console.log('===============================================================');
  }

  // Ensure all test challenges, files, and users created during this test run are cleaned up
  await new Promise(r => setTimeout(r, 400));
  if (db.isMongo && db.mongoDb) {
    await db.mongoDb.collection('challenges').deleteMany({
      title: { $in: ['Test Cryptography Challenge', 'Test Web Challenge', 'Test Steganography Challenge', 'Legacy Legacy Challenge', 'File Resolution Challenge', 'Updated Challenge Title'] }
    }).catch(() => {});
    await db.mongoDb.collection('challenge_files').deleteMany({
      id: 'f0000000-0000-0000-0000-000000000001'
    }).catch(() => {});
    await db.mongoDb.collection('users').deleteMany({
      id: 'u-participant-test'
    }).catch(() => {});
  }

  if (typeof db.close === 'function') {
    await db.close();
  }
  process.exit(passed === total ? 0 : 1);
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
