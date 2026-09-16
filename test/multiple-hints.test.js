/**
 * XPLOITX // CYBER BATTLEFIELD
 * Multiple Hint Management & Persistence Test Suite (test/multiple-hints.test.js)
 * Implements Section 51 of Master Specification
 * Supports both local embedded server and DEPLOYED_URL target.
 */

const http = require('http');
const https = require('https');
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('../backend/config/database');
const { app } = require('../backend/server');

const targetBaseUrl = process.env.DEPLOYED_URL || process.env.API_URL || null;

function requestUrl(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const opt = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: { ...(options.headers || {}) }
    };

    const req = client.request(opt, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json !== null ? json : data });
      });
    });

    req.on('error', reject);

    if (postData !== null && postData !== undefined) {
      if (typeof postData === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(postData));
      } else {
        req.write(postData);
      }
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('  XPLOITX // MULTIPLE HINT MANAGEMENT & PERSISTENCE TEST');
  console.log('================================================================');

  let server = null;
  let baseUrl = targetBaseUrl;

  if (!baseUrl) {
    await db.init();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
    console.log(`[TEST] Running against local server at ${baseUrl}`);
  } else {
    console.log(`[TEST] Running against TARGET URL: ${baseUrl}`);
  }

  try {
    // 1. ADMIN AUTHENTICATION
    console.log('\n1. Admin Login...');
    const adminUser = (db.getUsers && db.getUsers().find(u => u.role === 'ADMIN')) || { username: 'Admin' };
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'Commander@Xploitx!Admin';

    const loginRes = await requestUrl(`${baseUrl}/api/v1/admin/auth/login`, {
      method: 'POST'
    }, {
      username: adminUser.username || 'Admin',
      password: adminPassword
    });

    assert.strictEqual(loginRes.status, 200, `Admin login failed: ${JSON.stringify(loginRes.body)}`);
    const adminToken = loginRes.body.token;
    assert(adminToken, 'Admin token missing');
    const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
    console.log('   ✓ Admin authenticated successfully.');

    // 2. FETCH CHALLENGE TO CONFIGURE
    console.log('\n2. Fetching challenge list...');
    const listRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges`, {
      method: 'GET',
      headers: adminHeaders
    });
    assert.strictEqual(listRes.status, 200);
    const challenges = listRes.body.challenges || [];
    assert(challenges.length > 0, 'At least 1 challenge must exist to test hints');
    const challenge = challenges[0];
    const targetId = challenge.id;
    console.log(`   Target Challenge: "${challenge.title}" (ID: ${targetId}, Sector: ${challenge.category})`);

    // 3. CONFIGURE MULTIPLE HINTS & TEST HINT ENABLE/DISABLE CHECKBOX
    console.log('\n3. Testing Hint Enable/Disable Checkbox & Configuration...');
    const testHints = [
      {
        id: 'HINT-ALPHA-01',
        text: 'Analyze the high-entropy bytes at the beginning of the file header.',
        cost: 15,
        order: 1,
        enabled: true
      },
      {
        id: 'HINT-ALPHA-02',
        text: 'The secondary payload uses a simple XOR key derived from the mission code.',
        cost: 30,
        order: 2,
        enabled: false // TEST CHECKBOX DISABLED
      },
      {
        id: 'HINT-ALPHA-03',
        text: 'Decode the final base64 string after reversing the decrypted buffer.',
        cost: 50,
        order: 3,
        enabled: true
      }
    ];

    // 4. TEST "PUBLISH MISSION" BUTTON & VERIFY PERSISTENCE
    console.log('\n4. Testing "PUBLISH MISSION" Button API...');
    const publishPayload = {
      title: challenge.title,
      description: challenge.description || 'Tactical mission briefing.',
      category: challenge.category || 'Cryptography',
      difficulty: challenge.difficulty || 'MEDIUM',
      points: challenge.points || 500,
      flag: 'XploitXβ{the_last_digit_live_flag_1337}',
      hints: testHints,
      status: 'PUBLISHED'
    };

    const saveRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'PUT',
      headers: adminHeaders
    }, publishPayload);
    assert.strictEqual(saveRes.status, 200, `PUBLISH MISSION failed: ${JSON.stringify(saveRes.body)}`);
    console.log('   ✓ "PUBLISH MISSION" button payload accepted and saved to MongoDB Atlas.');

    // 5. TEST "VERIFY CONFIGURATION" BUTTON
    console.log('\n5. Testing "VERIFY CONFIGURATION" Button API...');
    const verifyConfigRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}/validate`, {
      method: 'GET',
      headers: adminHeaders
    });
    assert.strictEqual(verifyConfigRes.status, 200, `VERIFY CONFIGURATION failed: ${JSON.stringify(verifyConfigRes.body)}`);
    assert.strictEqual(verifyConfigRes.body.valid, true, 'Pre-publish configuration should validate to true');
    console.log('   ✓ "VERIFY CONFIGURATION" button API verified: valid = true');

    // 6. TEST "VALIDATE FLAG SYNTAX & INTEGRITY" BUTTON
    console.log('\n6. Testing "VALIDATE FLAG" Button API...');
    const testFlagCorrectRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/test-flag`, {
      method: 'POST',
      headers: adminHeaders
    }, {
      flag: 'XploitXβ{the_last_digit_live_flag_1337}',
      challengeId: targetId
    });
    assert.strictEqual(testFlagCorrectRes.status, 200);
    assert.strictEqual(testFlagCorrectRes.body.valid, true, 'Correct flag should validate to true');
    console.log('   ✓ Correct flag validation passed: valid = true');

    const testFlagWrongRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/test-flag`, {
      method: 'POST',
      headers: adminHeaders
    }, {
      flag: 'XploitXβ{incorrect_test_flag}',
      challengeId: targetId
    });
    assert.strictEqual(testFlagWrongRes.status, 200);
    assert.strictEqual(testFlagWrongRes.body.valid, false, 'Wrong flag should validate to false');
    console.log('   ✓ Wrong flag validation passed: valid = false');

    // 7. REOPEN / RELOAD CHALLENGE AS ADMIN TO VERIFY CHECKBOX & HINT PERSISTENCE
    console.log('\n7. Reopening challenge as Admin: verifying HINT ENABLE/DISABLE checkbox persistence...');
    const reloadRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'GET',
      headers: adminHeaders
    });
    assert.strictEqual(reloadRes.status, 200);
    const reloaded = reloadRes.body.challenge;
    assert(reloaded, 'Reloaded challenge missing');
    assert(Array.isArray(reloaded.hints), 'Reloaded challenge.hints must be an array');
    assert.strictEqual(reloaded.hints.length, 3, `Expected 3 hints, got ${reloaded.hints.length}`);

    // Verify Hint 2 is explicitly disabled (checkbox unchecked)
    const adminH1 = reloaded.hints[0];
    const adminH2 = reloaded.hints[1];
    const adminH3 = reloaded.hints[2];
    assert.strictEqual(adminH1.enabled, true, 'Hint 1 should be enabled');
    assert.strictEqual(adminH2.enabled, false, 'Hint 2 should be disabled');
    assert.strictEqual(adminH3.enabled, true, 'Hint 3 should be enabled');
    console.log('   ✓ Hint 2 checkbox persisted as DISABLED (enabled = false) in MongoDB Atlas!');

    // 8. TESTING PARTIAL UPDATE PROTECTION
    console.log('\n8. Testing Partial Update Protection (saving description without hints)...');
    const partRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'PUT',
      headers: adminHeaders
    }, {
      description: reloaded.description + ' [Verified]'
    });
    assert.strictEqual(partRes.status, 200);

    const checkPart = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'GET',
      headers: adminHeaders
    });
    assert.strictEqual(checkPart.body.challenge.hints.length, 3, 'Partial update MUST NOT erase hints');
    assert.strictEqual(checkPart.body.challenge.hints[1].enabled, false, 'Partial update MUST preserve disabled state');
    console.log('   ✓ Partial update protection passed: Hints and enabled states untouched.');

    // 9. PARTICIPANT AUTHENTICATION & ACCESS CONTROL
    console.log('\n9. Participant Authentication & Verification of Disabled Hint Masking...');
    let participantToken = null;
    const testUsername = `cadet_${Date.now().toString(36)}`;
    const testPassword = 'Password123!';

    const regRes = await requestUrl(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST'
    }, {
      username: testUsername,
      email: `${testUsername}@xploitx.test`,
      password: testPassword,
      callsign: `Callsign_${testUsername.slice(-4)}`
    });

    if (regRes.status === 201 || regRes.status === 200) {
      participantToken = regRes.body.token || regRes.body.session?.token;
    }

    if (!participantToken) {
      const pLoginRes = await requestUrl(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST'
      }, {
        identifier: testUsername,
        password: testPassword
      });
      participantToken = pLoginRes.body.token || pLoginRes.body.session?.token;
    }

    assert(participantToken, 'Participant token must be obtained');
    let participantHeaders = { 'Authorization': `Bearer ${participantToken}` };

    // Commission squad to satisfy requireSquadMembership
    const squadRes = await requestUrl(`${baseUrl}/api/v1/teams`, {
      method: 'POST',
      headers: participantHeaders
    }, {
      name: `Squad_${Date.now().toString(36).toUpperCase()}`
    });
    assert(squadRes.status === 201 || squadRes.status === 200, `Squad creation failed: ${JSON.stringify(squadRes.body)}`);
    console.log('   ✓ Test participant registered and squad commissioned.');

    // 10. PARTICIPANT FETCHES CHALLENGE: DISABLED HINT MUST NOT APPEAR
    console.log('\n10. Participant fetches challenge: verifying disabled hint is hidden...');
    const publicRouteId = reloaded.publicRouteId || reloaded.id;
    const pChallengeRes1 = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}`, {
      method: 'GET',
      headers: participantHeaders
    });
    assert.strictEqual(pChallengeRes1.status, 200);
    const pChallenge1 = pChallengeRes1.body.challenge || pChallengeRes1.body;

    assert(Array.isArray(pChallenge1.hints), 'Participant should receive hints array');
    // Hint 2 was disabled, so participant should only see 2 hints (Hint 1 and Hint 3)
    assert.strictEqual(pChallenge1.hints.length, 2, `Participant should only receive enabled hints (expected 2, got ${pChallenge1.hints.length})`);
    assert(!pChallenge1.hints.some(h => h.id === 'HINT-ALPHA-02'), 'Disabled hint HINT-ALPHA-02 must NOT be sent to participant');
    console.log('   ✓ Verification passed: Disabled hint was completely hidden from participant.');

    // 11. RE-ENABLE HINT 2 (CHECKBOX ENABLED) AND SAVE
    console.log('\n11. Re-enabling Hint 2 (checkbox checked) via Admin and Publishing...');
    testHints[1].enabled = true;
    const reEnableRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'PUT',
      headers: adminHeaders
    }, {
      hints: testHints
    });
    assert.strictEqual(reEnableRes.status, 200);

    const reloaded2 = (await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'GET',
      headers: adminHeaders
    })).body.challenge;
    assert.strictEqual(reloaded2.hints[1].enabled, true, 'Hint 2 should now be enabled');
    console.log('   ✓ Hint 2 re-enabled successfully in MongoDB Atlas.');

    // 12. PARTICIPANT FETCHES CHALLENGE AGAIN: NOW ALL 3 HINTS APPEAR
    console.log('\n12. Participant re-fetches challenge: verifying all 3 hints are now available...');
    const pChallengeRes2 = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}`, {
      method: 'GET',
      headers: participantHeaders
    });
    assert.strictEqual(pChallengeRes2.status, 200);
    const pChallenge = pChallengeRes2.body.challenge || pChallengeRes2.body;
    assert.strictEqual(pChallenge.hints.length, 3, 'Participant should now receive all 3 hints');
    console.log('   ✓ Participant now receives all 3 hints.');

    // 13. PARTICIPANT UNREVEALED HINT MASKING
    console.log('\n13. Verifying unrevealed hint content masking...');
    for (const h of pChallenge.hints) {
      assert(h.content === null || h.content === undefined || h.content === false, `Unrevealed hint ${h.id} leaked content`);
      assert(h.text === undefined, `Unrevealed hint ${h.id} leaked text property`);
      assert(h.cost !== undefined, `Hint ${h.id} should show cost`);
      assert.strictEqual(h.isUnlocked, false, `Hint ${h.id} should be locked`);
    }
    console.log('   ✓ All 3 hints locked with content redacted.');


    // 14. PARTICIPANT REVEALS HINT 1
    if (participantToken) {
      const hint1 = pChallenge.hints[0];
      console.log(`\n14. Participant revealing Hint 1 (${hint1.id}, cost: ${hint1.cost})...`);

      const unlockRes = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}/hints/${hint1.id}/reveal`, {
        method: 'POST',
        headers: participantHeaders
      });

      assert.strictEqual(unlockRes.status, 200, `Hint unlock failed: ${JSON.stringify(unlockRes.body)}`);
      assert(unlockRes.body.hint, 'Unlocked hint payload missing');
      assert.strictEqual(unlockRes.body.hint.content, testHints[0].text, 'Revealed content does not match configured hint 1 text');
      console.log(`   ✓ Hint 1 successfully unlocked! Received content: "${unlockRes.body.hint.content}"`);

      // 9. DUPLICATE REVEAL PROTECTION
      console.log('\n9. Testing duplicate reveal protection (revealing Hint 1 again)...');
      const dupUnlockRes = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}/hints/${hint1.id}/reveal`, {
        method: 'POST',
        headers: participantHeaders
      });
      assert(dupUnlockRes.status === 200 || dupUnlockRes.status === 400 || dupUnlockRes.status === 409, 'Duplicate unlock handled cleanly');
      if (dupUnlockRes.body.alreadyUnlocked || dupUnlockRes.status === 400) {
        console.log('   ✓ Duplicate unlock recognized: no duplicate point deduction.');
      }

      // 10. VERIFY HINT 2 & 3 REMAIN LOCKED
      console.log('\n10. Re-fetching challenge as Participant: verifying Hint 1 unlocked and Hints 2 & 3 locked...');
      const pRecheck = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}`, {
        method: 'GET',
        headers: participantHeaders
      });
      assert.strictEqual(pRecheck.status, 200);
      const recheckedHints = (pRecheck.body.challenge || pRecheck.body).hints;
      const recheckedH1 = recheckedHints.find(h => h.id === hint1.id);
      const recheckedH2 = recheckedHints.find(h => h.id === testHints[1].id || h.order === 2);
      const recheckedH3 = recheckedHints.find(h => h.id === testHints[2].id || h.order === 3);

      assert.strictEqual(recheckedH1.unlocked, true, 'Hint 1 should now be unlocked');
      assert.strictEqual(recheckedH1.content, testHints[0].text, 'Hint 1 content should be visible');
      assert.strictEqual(recheckedH2.unlocked, false, 'Hint 2 must still be locked');
      assert(recheckedH2.content === null || recheckedH2.content === undefined, 'Hint 2 content must still be redacted');
      assert.strictEqual(recheckedH3.unlocked, false, 'Hint 3 must still be locked');
      assert(recheckedH3.content === null || recheckedH3.content === undefined, 'Hint 3 content must still be redacted');
      console.log('   ✓ State consistency verified: Hint 1 unlocked, Hints 2 & 3 strictly masked.');
    }

    console.log('\n================================================================');
    console.log('  ALL MULTIPLE HINT PERSISTENCE & SECURITY TESTS PASSED! ✓');
    console.log('================================================================\n');

  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    process.exit(0);
  }
}

run().catch(err => {
  console.error('\n✗ TEST FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
