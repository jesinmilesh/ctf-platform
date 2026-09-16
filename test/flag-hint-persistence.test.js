/**
 * XPLOITX // CYBER BATTLEFIELD
 * Flag & Hint Persistence + Flag Validation Test Suite (test/flag-hint-persistence.test.js)
 * Implements Section 71 (Final Test Matrix) of Master Specification
 */

const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('../backend/config/database');
const challengeService = require('../backend/services/challengeService');
const flagVerificationService = require('../backend/services/flagVerificationService');
const submissionService = require('../backend/services/submissionService');

async function runTests() {
  console.log('================================================================');
  console.log('  XPLOITX // AUDIT: FLAG & HINT PERSISTENCE + FLAG VALIDATION');
  console.log('================================================================');

  await db.init();

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // Find or create test challenge
  let challenge = db.getChallenges()[0];
  if (!challenge) {
    challenge = challengeService.createChallenge({
      title: 'The Last Digit',
      description: 'Find the secret prime remainder.',
      category: 'Crypto',
      difficulty: 'MEDIUM',
      points: 500,
      flag: 'XploitXβ{the_last_digit_original_flag}',
      hint: 'Inspect modular arithmetic patterns',
      hint_cost: 50,
      status: 'PUBLISHED'
    });
  }

  const cid = challenge.id;
  const publicRouteId = challenge.publicRouteId || 'A9UkpCLxd9jtVCrZ';
  if (!challenge.publicRouteId) challenge.publicRouteId = publicRouteId;

  // ── TEST 1: Identifier Resolution ──────────────────────────────────────────
  test('Identifier Resolution: resolves by id, challengeId, and publicRouteId', () => {
    const byId = challengeService.resolveChallenge(cid);
    assert(byId, 'Should resolve by canonical id');
    assert.strictEqual(byId.id, cid);

    const byPublicRoute = challengeService.resolveChallenge(publicRouteId);
    assert(byPublicRoute, 'Should resolve by publicRouteId');
    assert.strictEqual(byPublicRoute.id, cid);

    if (challenge.challengeId) {
      const byChallengeId = challengeService.resolveChallenge(challenge.challengeId);
      assert(byChallengeId, 'Should resolve by challengeId');
      assert.strictEqual(byChallengeId.id, cid);
    }
  });

  // ── TEST 2: Admin Challenge Detail DTO ─────────────────────────────────────
  test('Admin Challenge Detail DTO contains plaintext flag and full hints', () => {
    // Configure known flag and hint
    challengeService.updateChallenge(cid, {
      flag: 'XploitXβ{audit_master_flag_2026}',
      hint: 'Check the cryptographic hash collision',
      hint_cost: 25
    });

    const adminDetails = challengeService.getAdminChallengeDetails(cid);
    assert(adminDetails, 'Admin details should be retrieved');
    assert.strictEqual(adminDetails.flag, 'XploitXβ{audit_master_flag_2026}', 'Admin DTO must contain exact plaintext flag');
    assert(Array.isArray(adminDetails.flags) && adminDetails.flags.length > 0, 'Admin DTO must contain flags array');
    assert.strictEqual(adminDetails.flags[0].value, 'XploitXβ{audit_master_flag_2026}');

    assert.strictEqual(adminDetails.hint, 'Check the cryptographic hash collision', 'Admin DTO must contain exact hint text');
    assert.strictEqual(adminDetails.hint_cost, 25, 'Admin DTO must contain exact hint cost');
    assert(Array.isArray(adminDetails.hints) && adminDetails.hints.length > 0, 'Admin DTO must contain hints array');
  });

  // ── TEST 3: Participant Challenge Detail DTO ───────────────────────────────
  test('Participant Challenge Detail DTO strictly hides plaintext flag and unrevealed hints', () => {
    const participantUser = { id: 'user-audit-001', role: 'USER', team_id: 'team-audit-001' };
    const participantDetails = challengeService.getChallengeDetails(publicRouteId, participantUser);

    assert(participantDetails, 'Participant details should be retrieved');
    assert.strictEqual(participantDetails.flag, undefined, 'Participant DTO must NEVER include flag');
    assert.strictEqual(participantDetails.flags, undefined, 'Participant DTO must NEVER include flags array');

    // Locked hints should have null content
    if (participantDetails.hints && participantDetails.hints.length > 0) {
      const locked = participantDetails.hints.filter(h => h.cost > 0 && !h.isUnlocked);
      locked.forEach(h => {
        assert.strictEqual(h.content, null, 'Locked hint content must be null in participant DTO');
      });
    }
  });

  // ── TEST 4: Partial Updates Do NOT Wipe Flags or Hints ─────────────────────
  test('Partial update (editing description only) preserves existing flag and hints', () => {
    challengeService.updateChallenge(cid, {
      description: 'Updated operational briefing for CTF operatives.'
    });

    const refreshed = challengeService.getAdminChallengeDetails(cid);
    assert.strictEqual(refreshed.description, 'Updated operational briefing for CTF operatives.');
    assert.strictEqual(refreshed.flag, 'XploitXβ{audit_master_flag_2026}', 'Flag must NOT disappear on description update');
    assert.strictEqual(refreshed.hint, 'Check the cryptographic hash collision', 'Hint must NOT disappear on description update');
    assert.strictEqual(refreshed.hint_cost, 25, 'Hint cost must NOT disappear on description update');
  });

  // ── TEST 5: Flag Verification Service ──────────────────────────────────────
  test('FlagVerificationService: exact match, case sensitivity, and syntax validation', () => {
    const targetChallenge = challengeService.resolveChallenge(cid);

    // Exact match
    const match = flagVerificationService.verifySubmission(targetChallenge, 'XploitXβ{audit_master_flag_2026}');
    assert.strictEqual(match.correct, true, 'Exact flag must match');

    // Case sensitivity (exact CTF semantics)
    const wrongCase = flagVerificationService.verifySubmission(targetChallenge, 'XploitXβ{AUDIT_MASTER_FLAG_2026}');
    assert.strictEqual(wrongCase.correct, false, 'Case mismatch must be rejected');

    // Completely wrong flag
    const wrong = flagVerificationService.verifySubmission(targetChallenge, 'XploitXβ{wrong_flag}');
    assert.strictEqual(wrong.correct, false, 'Wrong flag must be rejected');

    // Malformed syntax
    const malformed = flagVerificationService.verifySubmission(targetChallenge, 'not_a_valid_flag');
    assert.strictEqual(malformed.correct, false, 'Malformed syntax must be rejected');
    assert.strictEqual(malformed.reason, 'MALFORMED_SYNTAX');
  });

  // ── TEST 6: Participant Flag Submission via publicRouteId ──────────────────
  test('Participant submits correct flag via publicRouteId: accepted and scored once', () => {
    const testUser = {
      id: `operative-${Date.now()}`,
      username: 'ShadowOperative',
      role: 'USER',
      team_id: `team-${Date.now()}`
    };

    // Ensure competition is active/LIVE
    const comps = db.getCompetitions();
    if (comps[0]) comps[0].status = 'LIVE';

    // Submit wrong flag first
    const wrongResult = submissionService.submitFlag({
      challengeId: publicRouteId,
      submittedFlag: 'XploitXβ{wrong_attempt}',
      user: testUser
    });
    assert.strictEqual(wrongResult.correct, false, 'Wrong flag must be rejected');

    // Submit exact correct flag via publicRouteId
    const correctResult = submissionService.submitFlag({
      challengeId: publicRouteId,
      submittedFlag: 'XploitXβ{audit_master_flag_2026}',
      user: testUser
    });
    assert.strictEqual(correctResult.correct, true, 'Exact correct flag must be accepted');
    assert(correctResult.points > 0, 'Points must be awarded');

    // Duplicate submission of same flag
    const duplicateResult = submissionService.submitFlag({
      challengeId: publicRouteId,
      submittedFlag: 'XploitXβ{audit_master_flag_2026}',
      user: testUser
    });
    assert.strictEqual(duplicateResult.correct, false, 'Duplicate flag submission must not be accepted again');
    assert.strictEqual(duplicateResult.status, 'ALREADY_SOLVED', 'Duplicate status must be ALREADY_SOLVED');
  });

  // ── TEST 7: Flag Rotation / Update ─────────────────────────────────────────
  test('Flag rotation: Admin updates flag -> new flag works, old flag fails', () => {
    const rotationUser = {
      id: `operative-rot-${Date.now()}`,
      username: 'RotOperative',
      role: 'USER',
      team_id: `team-rot-${Date.now()}`
    };

    challengeService.updateChallenge(cid, {
      flag: 'XploitXβ{rotated_secret_key_9999}'
    });

    // Old flag must now fail
    const oldResult = submissionService.submitFlag({
      challengeId: publicRouteId,
      submittedFlag: 'XploitXβ{audit_master_flag_2026}',
      user: rotationUser
    });
    assert.strictEqual(oldResult.correct, false, 'Old rotated flag must fail');

    // New flag must succeed
    const newResult = submissionService.submitFlag({
      challengeId: publicRouteId,
      submittedFlag: 'XploitXβ{rotated_secret_key_9999}',
      user: rotationUser
    });
    assert.strictEqual(newResult.correct, true, 'New rotated flag must succeed');
  });

  console.log('----------------------------------------------------------------');
  console.log(`  AUDIT COMPLETE: ${passed} / ${total} TESTS PASSED (${Math.round(passed / total * 100)}%)`);
  console.log('================================================================');

  await new Promise(r => setTimeout(r, 600));
  await db.close();

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
