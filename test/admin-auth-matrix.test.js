/**
 * XPLOITX // STRICT ADMIN AUTHENTICATION & AUTHORIZATION TEST MATRIX
 * Verifies all 10 matrix tests + case sensitivity + database persistence
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const db = require('../backend/config/database');
const { app } = require('../backend/server');
const authService = require('../backend/services/authService');

async function runTests() {
  console.log('================================================================');
  console.log('  XPLOITX // ADMIN AUTH & STRICT RBAC VERIFICATION MATRIX');
  console.log('================================================================\n');

  await db.init();

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  async function post(endpoint, data, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json, headers: res.headers };
  }

  async function get(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${endpoint}`, { headers });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json, headers: res.headers };
  }

  // Setup: Ensure a participant account exists for testing
  const participantUsername = 'test_player_01';
  const participantPassword = 'PlayerPass123!Safe';
  let participantUser = db.getUsers().find(u => u.username === participantUsername);
  if (!participantUser) {
    try {
      const reg = await authService.register({
        username: participantUsername,
        email: 'test_player_01@xploitx.local',
        password: participantPassword,
        callsign: 'GHOST_01'
      });
      participantUser = reg.user;
    } catch (e) {
      participantUser = db.getUsers().find(u => u.username === participantUsername);
    }
  }

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  // -------------------------------------------------------------------------
  // Test 1: Admin correct credentials via canonical POST /api/v1/admin/auth/login
  // -------------------------------------------------------------------------
  const adminLoginRes = await post('/api/v1/admin/auth/login', {
    username: 'Admin',
    password: adminPassword
  });
  assert(
    adminLoginRes.status === 200 &&
    adminLoginRes.body.success === true &&
    adminLoginRes.body.user.role === 'ADMIN' &&
    !!adminLoginRes.body.token,
    'Test 1: Admin correct credentials log in successfully (200 OK + ADMIN role + token)'
  );
  const adminToken = adminLoginRes.body.token;

  // -------------------------------------------------------------------------
  // Test 2: Admin wrong password
  // -------------------------------------------------------------------------
  const wrongPwRes = await post('/api/v1/admin/auth/login', {
    username: 'Admin',
    password: 'WrongPassword999!'
  });
  assert(
    wrongPwRes.status === 401 &&
    wrongPwRes.body.error === 'INVALID_CREDENTIALS',
    'Test 2: Admin wrong password rejected with 401 Unauthorized'
  );

  // -------------------------------------------------------------------------
  // Test 3: Wrong username
  // -------------------------------------------------------------------------
  const wrongUserRes = await post('/api/v1/admin/auth/login', {
    username: 'NonExistentAdminUser',
    password: adminPassword
  });
  assert(
    wrongUserRes.status === 401 &&
    wrongUserRes.body.error === 'INVALID_CREDENTIALS',
    'Test 3: Non-existent username rejected with 401 Unauthorized'
  );

  // -------------------------------------------------------------------------
  // Test 4: Case-sensitivity test (Requirement 46)
  // -------------------------------------------------------------------------
  const lowerCaseRes = await post('/api/v1/admin/auth/login', {
    username: 'admin', // lowercase
    password: adminPassword
  });
  assert(
    lowerCaseRes.status === 401,
    'Test 4: Case-sensitive username enforced: "admin" rejected when stored is "Admin"'
  );

  const upperCaseRes = await post('/api/v1/admin/auth/login', {
    username: 'ADMIN', // all uppercase
    password: adminPassword
  });
  assert(
    upperCaseRes.status === 401,
    'Test 4b: Case-sensitive username enforced: "ADMIN" rejected when stored is "Admin"'
  );

  // -------------------------------------------------------------------------
  // Test 5: Participant credentials entered on Admin Login
  // -------------------------------------------------------------------------
  const playerOnAdminRes = await post('/api/v1/admin/auth/login', {
    username: participantUsername,
    password: participantPassword
  });
  assert(
    playerOnAdminRes.status === 403 &&
    playerOnAdminRes.body.error === 'CLEARANCE_DENIED' &&
    playerOnAdminRes.body.message === 'ADMIN ACCESS REQUIRED',
    'Test 5: Participant credentials on Admin login rejected with 403 "ADMIN ACCESS REQUIRED"'
  );

  // -------------------------------------------------------------------------
  // Test 6: Participant session accessing Admin APIs
  // -------------------------------------------------------------------------
  const playerLoginRes = await post('/api/v1/auth/login', {
    username: participantUsername,
    password: participantPassword
  });
  const playerToken = playerLoginRes.body.token;

  const playerMeRes = await get('/api/v1/admin/me', playerToken);
  assert(
    playerMeRes.status === 403,
    'Test 6a: Participant token accessing GET /api/v1/admin/me returns 403 Forbidden'
  );

  const playerDashRes = await get('/api/v1/admin/dashboard', playerToken);
  assert(
    playerDashRes.status === 403,
    'Test 6b: Participant token accessing GET /api/v1/admin/dashboard returns 403 Forbidden'
  );

  const playerUsersRes = await get('/api/v1/admin/users', playerToken);
  assert(
    playerUsersRes.status === 403,
    'Test 6c: Participant token accessing GET /api/v1/admin/users returns 403 Forbidden'
  );

  // -------------------------------------------------------------------------
  // Test 7: Unauthenticated access to Admin APIs
  // -------------------------------------------------------------------------
  const anonDashRes = await get('/api/v1/admin/dashboard');
  assert(
    anonDashRes.status === 401,
    'Test 7: Unauthenticated access to Admin API returns 401 Unauthorized'
  );

  // -------------------------------------------------------------------------
  // Test 8: Admin token accessing Admin APIs
  // -------------------------------------------------------------------------
  const adminMeRes = await get('/api/v1/admin/me', adminToken);
  assert(
    adminMeRes.status === 200 &&
    adminMeRes.body.user.role === 'ADMIN' &&
    adminMeRes.body.user.username === 'Admin',
    'Test 8a: Authenticated Admin accessing GET /api/v1/admin/me returns 200 OK'
  );

  const adminDashRes = await get('/api/v1/admin/dashboard', adminToken);
  assert(
    adminDashRes.status === 200 &&
    adminDashRes.body.stats &&
    typeof adminDashRes.body.stats.activeOperatives === 'number',
    'Test 8b: Authenticated Admin accessing GET /api/v1/admin/dashboard returns real telemetry'
  );

  // -------------------------------------------------------------------------
  // Test 9: Mass-assignment / privilege escalation test
  // -------------------------------------------------------------------------
  const uniqueHacker = `hacker_${Date.now()}`;
  const tamperedRegRes = await post('/api/v1/auth/register', {
    username: uniqueHacker,
    email: `${uniqueHacker}@xploitx.local`,
    password: 'Password123!Safe',
    role: 'ADMIN',
    isAdmin: true,
    permissions: ['admin.access']
  });
  assert(
    tamperedRegRes.body.user &&
    tamperedRegRes.body.user.role === 'PLAYER',
    'Test 9: Registration strips role manipulation and strictly creates PLAYER role'
  );

  // -------------------------------------------------------------------------
  // Test 10: Admin logout
  // -------------------------------------------------------------------------
  const logoutRes = await post('/api/v1/admin/auth/logout', {}, adminToken);
  assert(
    logoutRes.status === 200 &&
    logoutRes.body.success === true,
    'Test 10a: POST /api/v1/admin/auth/logout succeeds'
  );

  const revokedMeRes = await get('/api/v1/admin/me', adminToken);
  assert(
    revokedMeRes.status === 401,
    'Test 10b: Revoked admin session rejected on subsequent Admin API calls (401)'
  );

  // -------------------------------------------------------------------------
  // Test 11: MongoDB Atlas database admin account integrity
  // -------------------------------------------------------------------------
  const adminInDb = db.getUsers().find(u => u.username === (process.env.BOOTSTRAP_ADMIN_USERNAME || 'Admin'));
  assert(
    adminInDb &&
    adminInDb.role === 'ADMIN' &&
    adminInDb.password_hash &&
    adminInDb.password_hash.startsWith('$2'),
    'Test 11: Admin account preserved with role ADMIN and secure bcrypt hash'
  );

  console.log(`\n================================================================`);
  console.log(`  MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test matrix error:', err);
  process.exit(1);
});
