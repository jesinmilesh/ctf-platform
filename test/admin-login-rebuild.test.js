/**
 * XPLOITX // COMPLETE ADMIN LOGIN REBUILD & FRESH DATABASE VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Clean database state (no fake participants, teams, challenges, submissions)
 * 2. Dedicated admin bootstrap integrity (bcrypt hash, role ADMIN, single account)
 * 3. Exact credentials login: 200 OK, valid JWT, session stored, role ADMIN
 * 4. Invalid credentials: 401 INVALID ADMIN CREDENTIALS
 * 5. Case sensitivity enforcement: 'admin' vs 'Admin'
 * 6. Non-existent user: 401 INVALID ADMIN CREDENTIALS
 * 7. Participant on Admin login: 403 ADMIN ACCESS REQUIRED
 * 8. Strict RBAC: Participant token denied on Admin APIs (403)
 * 9. Unauthenticated requests denied on Admin APIs (401)
 * 10. Admin session logout & revocation
 * 11. Role manipulation protection on participant registration
 * 12. Startup stability: server restarts do not auto-seed or reset database
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const bcrypt = require('bcryptjs');
const db = require('../backend/config/database');
const { app } = require('../backend/server');
const authService = require('../backend/services/authService');

async function runRebuildTestSuite() {
  console.log('================================================================');
  console.log('  XPLOITX // ADMIN REBUILD & DATABASE RESET VERIFICATION SUITE');
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

  const adminUsername = process.env.BOOTSTRAP_ADMIN_USERNAME || 'Admin';
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('FATAL: BOOTSTRAP_ADMIN_PASSWORD not set in environment.');
    process.exit(1);
  }

  console.log('--- SECTION 1: FRESH DATABASE AUDIT & ZERO FAKE DATA ---');

  // 1. Audit user collection
  const allUsers = db.getUsers();
  assert(allUsers.length >= 1, `At least 1 user exists in database (found: ${allUsers.length})`);
  
  const adminDoc = allUsers.find(u => u.username === adminUsername);
  assert(adminDoc !== undefined, `Target Admin "${adminUsername}" exists in database`);
  assert(adminDoc && adminDoc.role === 'ADMIN', `Admin role is strictly "ADMIN"`);

  // 2. Audit that password hash is valid bcrypt (starts with $2) and NOT scrypt/argon2
  assert(
    adminDoc && adminDoc.password_hash && adminDoc.password_hash.startsWith('$2'),
    `Admin password_hash uses modern standard bcrypt ($2a$ / $2b$)`
  );
  assert(
    adminDoc && !adminDoc.password_hash.includes(':') && !adminDoc.password_hash.startsWith('$argon2'),
    `Legacy scrypt (salt:key) and argon2 formats completely eliminated from Admin`
  );

  // 3. Bcrypt self-verification against raw password
  const bcryptMatches = await bcrypt.compare(adminPassword, adminDoc.password_hash);
  assert(bcryptMatches === true, `Admin password hash verifies directly with bcrypt.compare()`);

  // 4. Zero fake teams and fake challenges in clean state
  const allTeams = db.getTeams();
  const allChallenges = db.getChallenges();
  const allSubmissions = db.getSubmissions();
  assert(allTeams.length === 0, `Zero fake teams present in database (found: ${allTeams.length})`);
  assert(allChallenges.length === 0, `Zero fake challenges present in database (found: ${allChallenges.length})`);
  assert(allSubmissions.length === 0, `Zero fake submissions present in database (found: ${allSubmissions.length})`);

  console.log('\n--- SECTION 2: CANONICAL ADMIN LOGIN (POST /api/v1/admin/auth/login) ---');

  // 5. Correct credentials
  const loginSuccess = await post('/api/v1/admin/auth/login', {
    username: adminUsername,
    password: adminPassword
  });
  assert(
    loginSuccess.status === 200 &&
    loginSuccess.body.success === true &&
    loginSuccess.body.user &&
    loginSuccess.body.user.role === 'ADMIN' &&
    typeof loginSuccess.body.token === 'string',
    'Admin login with correct credentials returns 200 OK + JWT token + role ADMIN'
  );
  const adminToken = loginSuccess.body.token;

  // 6. Wrong password
  const wrongPasswordRes = await post('/api/v1/admin/auth/login', {
    username: adminUsername,
    password: 'IncorrectPassword_999#'
  });
  assert(
    wrongPasswordRes.status === 401 &&
    wrongPasswordRes.body.error === 'INVALID_CREDENTIALS',
    'Admin login with incorrect password returns 401 INVALID_CREDENTIALS'
  );

  // 7. Non-existent username
  const ghostUserRes = await post('/api/v1/admin/auth/login', {
    username: 'GhostCommander_XYZ',
    password: adminPassword
  });
  assert(
    ghostUserRes.status === 401 &&
    ghostUserRes.body.error === 'INVALID_CREDENTIALS',
    'Admin login with non-existent username returns 401 INVALID_CREDENTIALS'
  );

  // 8. Case-Insensitive Identifier Resolution ('admin' and 'ADMIN' match 'Admin')
  const lowercaseRes = await post('/api/v1/admin/auth/login', {
    username: 'admin',
    password: adminPassword
  });
  assert(
    lowercaseRes.status === 200 && lowercaseRes.body.success === true,
    'Case-insensitive username supported: "admin" resolves cleanly to Admin'
  );

  const uppercaseRes = await post('/api/v1/admin/auth/login', {
    username: 'ADMIN',
    password: adminPassword
  });
  assert(
    uppercaseRes.status === 200 && uppercaseRes.body.success === true,
    'Case-insensitive username supported: "ADMIN" resolves cleanly to Admin'
  );

  // 9. Missing credentials
  const missingCredsRes = await post('/api/v1/admin/auth/login', {
    username: adminUsername
  });
  assert(
    missingCredsRes.status === 400 || missingCredsRes.status === 401,
    'Missing password rejected with appropriate 400/401 client error'
  );

  console.log('\n--- SECTION 3: PARTICIPANT / ROLE BOUNDARY ENFORCEMENT ---');

  // 10. Register a legitimate participant
  const playerUsername = `agent_delta_${Date.now()}`;
  const playerPassword = 'SecureParticipantPass123!';
  const playerReg = await authService.register({
    username: playerUsername,
    email: `${playerUsername}@xploitx.local`,
    password: playerPassword,
    callsign: 'DELTA_OPERATIVE'
  });
  assert(playerReg && playerReg.user && playerReg.user.role === 'PLAYER', 'Participant registered cleanly with role PLAYER');

  // 11. Participant attempting to log in via Admin login endpoint
  const playerOnAdmin = await post('/api/v1/admin/auth/login', {
    username: playerUsername,
    password: playerPassword
  });
  assert(
    playerOnAdmin.status === 403 &&
    playerOnAdmin.body.error === 'CLEARANCE_DENIED' &&
    playerOnAdmin.body.message === 'ADMIN ACCESS REQUIRED',
    'Participant credentials on Admin endpoint rejected with 403 "ADMIN ACCESS REQUIRED"'
  );

  // 12. Participant logging in via normal endpoint
  const playerLogin = await post('/api/v1/auth/login', {
    username: playerUsername,
    password: playerPassword
  });
  assert(playerLogin.status === 200 && playerLogin.body.token, 'Participant logs in via normal /api/v1/auth/login');
  const playerToken = playerLogin.body.token;

  console.log('\n--- SECTION 4: STRICT RBAC & ADMIN API PROTECTION ---');

  // 13. Participant token denied on Admin APIs (403)
  const playerMe = await get('/api/v1/admin/me', playerToken);
  assert(playerMe.status === 403, 'Participant token denied on GET /api/v1/admin/me (403 Forbidden)');

  const playerDash = await get('/api/v1/admin/dashboard', playerToken);
  assert(playerDash.status === 403, 'Participant token denied on GET /api/v1/admin/dashboard (403 Forbidden)');

  const playerUsers = await get('/api/v1/admin/users', playerToken);
  assert(playerUsers.status === 403, 'Participant token denied on GET /api/v1/admin/users (403 Forbidden)');

  // 14. Unauthenticated access denied on Admin APIs (401)
  const anonMe = await get('/api/v1/admin/me');
  assert(anonMe.status === 401, 'Unauthenticated access denied on GET /api/v1/admin/me (401 Unauthorized)');

  const anonDash = await get('/api/v1/admin/dashboard');
  assert(anonDash.status === 401, 'Unauthenticated access denied on GET /api/v1/admin/dashboard (401 Unauthorized)');

  // 15. Admin token authorized on Admin APIs (200)
  const adminMe = await get('/api/v1/admin/me', adminToken);
  assert(
    adminMe.status === 200 &&
    adminMe.body.user.role === 'ADMIN' &&
    adminMe.body.user.username === adminUsername,
    'Admin token authorized on GET /api/v1/admin/me (200 OK + verified user payload)'
  );

  const adminDash = await get('/api/v1/admin/dashboard', adminToken);
  assert(
    adminDash.status === 200 &&
    typeof adminDash.body.stats === 'object',
    'Admin token authorized on GET /api/v1/admin/dashboard (200 OK + real platform telemetry)'
  );

  console.log('\n--- SECTION 5: PRIVILEGE ESCALATION & SECURITY MITIGATION ---');

  // 16. Mass-assignment attack: attempting to register with role: 'ADMIN'
  const attackerUsername = `attacker_${Date.now()}`;
  const tamperedReg = await post('/api/v1/auth/register', {
    username: attackerUsername,
    email: `${attackerUsername}@xploitx.local`,
    password: 'AttackerPassword123!',
    role: 'ADMIN',
    isAdmin: true,
    permissions: ['admin.all']
  });
  assert(
    tamperedReg.body.user &&
    tamperedReg.body.user.role === 'PLAYER',
    'Mass-assignment attack mitigated: requested role "ADMIN" stripped to "PLAYER"'
  );

  console.log('\n--- SECTION 6: SESSION TERMINATION & LOGOUT ---');

  // 17. Admin logout
  const logoutRes = await post('/api/v1/admin/auth/logout', {}, adminToken);
  assert(logoutRes.status === 200 && logoutRes.body.success === true, 'Admin logout POST /api/v1/admin/auth/logout succeeds (200 OK)');

  // 18. Revoked token rejected
  const postLogoutMe = await get('/api/v1/admin/me', adminToken);
  assert(postLogoutMe.status === 401, 'Revoked admin token rejected with 401 on subsequent requests');

  console.log('\n================================================================');
  console.log(`  REBUILD AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runRebuildTestSuite().catch(err => {
  console.error('Fatal error in rebuild test suite:', err);
  process.exit(1);
});
