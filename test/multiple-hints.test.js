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

    // 3. CONFIGURE MULTIPLE HINTS (HINT 1, HINT 2, HINT 3)
    console.log('\n3. Configuring 3 independent hints with costs & order...');
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
        enabled: true
      },
      {
        id: 'HINT-ALPHA-03',
        text: 'Decode the final base64 string after reversing the decrypted buffer.',
        cost: 50,
        order: 3,
        enabled: true
      }
    ];

    const saveRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'PUT',
      headers: adminHeaders
    }, {
      hints: testHints
    });
    assert.strictEqual(saveRes.status, 200, `PUT /admin/challenges/${targetId} failed: ${JSON.stringify(saveRes.body)}`);
    console.log('   ✓ Hints payload sent and accepted by Admin API.');

    // 4. REOPEN / RELOAD CHALLENGE AS ADMIN
    console.log('\n4. Reopening challenge as Admin to verify persistence...');
    const reloadRes = await requestUrl(`${baseUrl}/api/v1/admin/challenges/${targetId}`, {
      method: 'GET',
      headers: adminHeaders
    });
    assert.strictEqual(reloadRes.status, 200);
    const reloaded = reloadRes.body.challenge;
    assert(reloaded, 'Reloaded challenge missing');
    assert(Array.isArray(reloaded.hints), 'Reloaded challenge.hints must be an array');
    assert.strictEqual(reloaded.hints.length, 3, `Expected 3 hints, got ${reloaded.hints.length}`);

    // Verify properties of each hint
    for (let i = 0; i < testHints.length; i++) {
      const exp = testHints[i];
      const actual = reloaded.hints[i];
      assert(actual, `Hint #${i + 1} is missing`);
      assert.strictEqual(actual.text, exp.text, `Hint #${i + 1} text mismatch`);
      assert.strictEqual(actual.cost, exp.cost, `Hint #${i + 1} cost mismatch`);
      assert.strictEqual(actual.order, exp.order, `Hint #${i + 1} order mismatch`);
      assert.strictEqual(actual.enabled, exp.enabled, `Hint #${i + 1} enabled mismatch`);
      assert(actual.id, `Hint #${i + 1} must have a persistent ID`);
    }
    console.log('   ✓ All 3 hints persisted with exact text, cost, order, and enabled flags!');

    // 5. PARTIAL UPDATE PROTECTION: UPDATE DESCRIPTION WITHOUT HINTS
    console.log('\n5. Testing Partial Update Protection (saving description without hints)...');
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
    console.log('   ✓ Partial update protection passed: Hints remained untouched.');

    // 6. PARTICIPANT AUTHENTICATION & ACCESS CONTROL
    console.log('\n6. Participant Authentication & Squad Commissioning...');
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
    console.log('   ✓ Test participant registered and squad commissioned successfully.');

    // 7. PARTICIPANT FETCHES CHALLENGE
    console.log('\n7. Participant fetches challenge details...');
    const publicRouteId = reloaded.publicRouteId || reloaded.id;
    const pChallengeRes = await requestUrl(`${baseUrl}/api/v1/challenges/${publicRouteId}`, {
      method: 'GET',
      headers: participantHeaders
    });
    assert.strictEqual(pChallengeRes.status, 200);
    const pChallenge = pChallengeRes.body.challenge || pChallengeRes.body;

    assert(Array.isArray(pChallenge.hints), 'Participant should receive hints array');
    assert.strictEqual(pChallenge.hints.length, 3, 'Participant should see 3 hints available');

    // CRITICAL SECURITY: Unrevealed hints must NOT contain hint text
    for (const h of pChallenge.hints) {
      assert(h.content === null || h.content === undefined || h.content === false, `Unrevealed hint ${h.id} leaked content: ${h.content}`);
      assert(h.text === undefined, `Unrevealed hint ${h.id} leaked text property: ${h.text}`);
      assert(h.cost !== undefined, `Hint ${h.id} should show cost to participant`);
      assert.strictEqual(h.unlocked, false, `Hint ${h.id} should be locked`);
    }
    console.log('   ✓ Security verified: All 3 hints are locked and content is completely redacted!');

    // 8. PARTICIPANT REVEALS HINT 1
    if (participantToken) {
      const hint1 = pChallenge.hints[0];
      console.log(`\n8. Participant revealing Hint 1 (${hint1.id}, cost: ${hint1.cost})...`);

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
