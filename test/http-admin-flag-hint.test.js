/**
 * XPLOITX // CYBER BATTLEFIELD
 * HTTP End-to-End Test: Admin Flag/Hint CRUD + Participant Flag Submission
 */

const http = require('http');
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = require('../backend/config/database');
const { app } = require('../backend/server');

function makeRequest(server, options, postData) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opt = {
      hostname: '127.0.0.1',
      port: addr.port,
      ...options
    };
    const req = http.request(opt, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });
    req.on('error', reject);
    if (postData) {
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
  console.log('  XPLOITX // HTTP E2E: ADMIN FLAG/HINT CRUD & SUBMISSIONS');
  console.log('================================================================');

  await db.init();

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Admin Login to obtain Bearer token
    console.log('1. Authenticating as Admin...');
    const adminUser = db.getUsers().find(u => u.role === 'ADMIN');
    assert(adminUser, 'Admin user must exist in database');

    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'XploitX_C2_Command_2026!';
    const loginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/auth/login'
    }, {
      username: adminUser.username,
      password: adminPassword
    });

    assert.strictEqual(loginRes.status, 200, `Admin login should succeed: ${JSON.stringify(loginRes.body)}`);
    const token = loginRes.body.token;
    assert(token, 'Admin session token must be returned');

    const adminHeaders = {
      'Authorization': `Bearer ${token}`
    };

    // 2. Fetch challenge list via Admin API
    console.log('2. Fetching Admin challenges list...');
    const listRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/challenges',
      headers: adminHeaders
    });
    assert.strictEqual(listRes.status, 200);
    const challenges = listRes.body.challenges;
    assert(challenges && challenges.length > 0, 'At least one challenge must exist');
    const targetChallenge = challenges[0];
    const targetId = targetChallenge.id;
    console.log(`   Target Challenge: "${targetChallenge.title}" (${targetId})`);

    // 3. Fetch single challenge via new GET /api/v1/admin/challenges/:id
    console.log('3. Fetching single challenge via GET /api/v1/admin/challenges/:id...');
    const detailRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/challenges/${targetId}`,
      headers: adminHeaders
    });
    assert.strictEqual(detailRes.status, 200, `GET /admin/challenges/:id should return 200: ${JSON.stringify(detailRes.body)}`);
    assert(detailRes.body.challenge, 'Challenge object must be returned');
    assert(detailRes.body.challenge.flag, 'Authoritative flag must be returned to Admin');
    console.log(`   ✓ Retrieved Authoritative Flag: "${detailRes.body.challenge.flag}"`);
    console.log(`   ✓ Retrieved Authoritative Hint: "${detailRes.body.challenge.hint}" (Cost: ${detailRes.body.challenge.hint_cost})`);

    // 4. Update challenge with specific flag and hint
    console.log('4. Updating Challenge with new Flag and Hint via PUT /admin/challenges/:id...');
    const testFlag = 'XploitXβ{the_last_digit_live_flag_1337}';
    const testHint = 'Analyze the mod 10 remainder sequence';
    const testHintCost = 35;

    const updateRes = await makeRequest(server, {
      method: 'PUT',
      path: `/api/v1/admin/challenges/${targetId}`,
      headers: adminHeaders
    }, {
      flag: testFlag,
      hint: testHint,
      hint_cost: testHintCost,
      status: 'PUBLISHED'
    });
    assert.strictEqual(updateRes.status, 200, `PUT /admin/challenges/:id should succeed: ${JSON.stringify(updateRes.body)}`);

    // 5. Reopen challenge via Admin GET and verify same flag and hints appear
    console.log('5. Reopening Challenge via GET /admin/challenges/:id to verify persistence...');
    const reopenRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/challenges/${targetId}`,
      headers: adminHeaders
    });
    assert.strictEqual(reopenRes.status, 200);
    assert.strictEqual(reopenRes.body.challenge.flag, testFlag, 'Reopened challenge must display newly saved flag');
    assert.strictEqual(reopenRes.body.challenge.hint, testHint, 'Reopened challenge must display newly saved hint');
    assert.strictEqual(reopenRes.body.challenge.hint_cost, testHintCost, 'Reopened challenge must display newly saved hint cost');
    console.log('   ✓ Persistence verified: Same flag and hints reloaded successfully!');

    // 6. Test Admin Flag validation endpoint POST /admin/challenges/test-flag
    console.log('6. Testing Admin Flag Verification endpoint...');
    const testFlagMatchRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/challenges/test-flag',
      headers: adminHeaders
    }, {
      flag: testFlag,
      challengeId: targetId
    });
    assert.strictEqual(testFlagMatchRes.status, 200);
    assert.strictEqual(testFlagMatchRes.body.valid, true, 'Test flag should validate to true');
    console.log('   ✓ Admin Flag Test passed: valid = true');

    const testFlagWrongRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/challenges/test-flag',
      headers: adminHeaders
    }, {
      flag: 'XploitXβ{incorrect_flag}',
      challengeId: targetId
    });
    assert.strictEqual(testFlagWrongRes.status, 200);
    assert.strictEqual(testFlagWrongRes.body.valid, false, 'Wrong test flag should validate to false');
    console.log('   ✓ Admin Wrong Flag Test passed: valid = false');

    // 7. Verify Participant Endpoint does NOT expose flag
    console.log('7. Verifying Participant GET endpoint does not expose flag...');
    const participantRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/challenges/${targetId}`,
      headers: adminHeaders
    });
    assert.strictEqual(participantRes.status, 200);
    const pChallenge = participantRes.body.challenge || participantRes.body;
    assert.strictEqual(pChallenge.flag, undefined, 'Participant DTO must NEVER contain flag');
    assert.strictEqual(pChallenge.flags, undefined, 'Participant DTO must NEVER contain flags');
    console.log('   ✓ Security verified: Flag is completely redacted in participant response.');

    console.log('================================================================');
    console.log('  ALL HTTP E2E AUDIT TESTS PASSED SUCCESSFULLY! ✓');
    console.log('================================================================');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(r => setTimeout(r, 600));
    await db.close();
  }
}

run().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
