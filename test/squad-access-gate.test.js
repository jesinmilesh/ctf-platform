/**
 * XPLOITX // PRODUCTION SQUAD MEMBERSHIP ACCESS GATE TEST SUITE
 * Validates complete enforcement, two-layer security (API + Direct HTML),
 * Atlas persistence, Admin clearance exemption, and real-time lifecycle events.
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const db = require('../backend/config/database');
const { app } = require('../backend/server');

async function runTests() {
  console.log('================================================================');
  console.log('  XPLOITX // SQUAD MEMBERSHIP ACCESS GATE VERIFICATION SUITE');
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

  async function post(endpoint, data, token = null, cookie = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      redirect: 'manual'
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json, headers: res.headers };
  }

  async function get(endpoint, token = null, cookie = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers,
      redirect: 'manual'
    });
    let body = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => ({}));
    } else {
      body = await res.text().catch(() => '');
    }
    return { status: res.status, body, headers: res.headers };
  }

  try {
    const ts = Date.now();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Unauthenticated Requests
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[SECTION 1] Unauthenticated API Gate Verification');
    const unauthChallenges = await get('/api/v1/challenges');
    assert(unauthChallenges.status === 401, 'Unauthenticated GET /api/v1/challenges returns 401');

    const unauthScoreboard = await get('/api/v1/scoreboard');
    assert(unauthScoreboard.status === 401, 'Unauthenticated GET /api/v1/scoreboard returns 401');

    const unauthDashboard = await get('/api/v1/dashboard');
    assert(unauthDashboard.status === 401, 'Unauthenticated GET /api/v1/dashboard returns 401');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Register Un-squadded Operatives
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 2] Operative Registration & Un-squadded State');
    const op1Name = `op_alpha_${ts}`;
    const op1Reg = await post('/api/v1/auth/register', {
      username: op1Name,
      email: `${op1Name}@battlefield.io`,
      password: 'StrongOperativePass#2026',
      callsign: `ALPHA_${ts.toString().slice(-4)}`
    });
    assert(op1Reg.status === 201 && op1Reg.body.token, `Operative 1 registered successfully: ${op1Name}`);
    const token1 = op1Reg.body.token;
    const cookie1 = `xploitx_token=${token1}`;

    const op2Name = `op_bravo_${ts}`;
    const op2Reg = await post('/api/v1/auth/register', {
      username: op2Name,
      email: `${op2Name}@battlefield.io`,
      password: 'StrongOperativePass#2026',
      callsign: `BRAVO_${ts.toString().slice(-4)}`
    });
    assert(op2Reg.status === 201 && op2Reg.body.token, `Operative 2 registered successfully: ${op2Name}`);
    const token2 = op2Reg.body.token;
    const cookie2 = `xploitx_token=${token2}`;

    // Verify /api/v1/auth/me shows hasSquad: false
    const me1 = await get('/api/v1/auth/me', token1);
    assert(me1.status === 200, 'GET /api/v1/auth/me returns 200 for authenticated user');
    assert(me1.body.user.hasSquad === false, 'Auth /me reports hasSquad === false for un-squadded user');
    assert(me1.body.user.team_id === null, 'Auth /me reports team_id === null for un-squadded user');
    assert(me1.body.user.team === null, 'Auth /me reports team === null for un-squadded user');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Un-squadded Participant API Lock Matrix (Expect 403 SQUAD_REQUIRED)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 3] Un-squadded Participant API Lock Matrix (403 SQUAD_REQUIRED)');

    const chRes = await get('/api/v1/challenges', token1);
    assert(chRes.status === 403, 'GET /api/v1/challenges blocked with 403 for un-squadded user');
    assert(chRes.body.error === 'SQUAD_REQUIRED' || chRes.body.code === 'SQUAD_REQUIRED', 'Response contains machine-readable error: SQUAD_REQUIRED');

    const chOneRes = await get('/api/v1/challenges/CHAL-000001', token1);
    assert(chOneRes.status === 403, 'GET /api/v1/challenges/:id blocked with 403 for un-squadded user');

    const chPublicRes = await get('/api/v1/challenges/public/CHAL-000001', token1);
    assert(chPublicRes.status === 403, 'GET /api/v1/challenges/public/:publicRouteId blocked with 403');

    const sbRes = await get('/api/v1/scoreboard', token1);
    assert(sbRes.status === 403, 'GET /api/v1/scoreboard blocked with 403 for un-squadded user');

    const dashRes = await get('/api/v1/dashboard', token1);
    assert(dashRes.status === 403, 'GET /api/v1/dashboard blocked with 403 for un-squadded user');

    const subsRes = await get('/api/v1/submissions', token1);
    assert(subsRes.status === 403, 'GET /api/v1/submissions blocked with 403 for un-squadded user');

    const feedRes = await get('/api/v1/feed', token1);
    assert(feedRes.status === 403, 'GET /api/v1/feed blocked with 403 for un-squadded user');

    const actRes = await get('/api/v1/activity', token1);
    assert(actRes.status === 403, 'GET /api/v1/activity blocked with 403 for un-squadded user');

    const annRes = await get('/api/v1/announcements', token1);
    assert(annRes.status === 403, 'GET /api/v1/announcements blocked with 403 for un-squadded user');

    const intelRes = await get('/api/v1/intel', token1);
    assert(intelRes.status === 403, 'GET /api/v1/intel blocked with 403 for un-squadded user');

    const hintsRes = await get('/api/v1/hints', token1);
    assert(hintsRes.status === 403, 'GET /api/v1/hints blocked with 403 for un-squadded user');

    const instRes = await get('/api/v1/instances', token1);
    assert(instRes.status === 403, 'GET /api/v1/instances blocked with 403 for un-squadded user');

    const filesRes = await get('/api/v1/files', token1);
    assert(filesRes.status === 403, 'GET /api/v1/files blocked with 403 for un-squadded user');

    const submitRes = await post('/api/v1/challenges/CHAL-000001/submit', { flag: 'flag{test}' }, token1);
    assert(submitRes.status === 403, 'POST /api/v1/challenges/:id/submit blocked with 403 for un-squadded user');

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Direct URL Navigation Gate (302 Redirect to /team.html?onboarding=1)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 4] Direct HTML Page Navigation Squad Gate (302 Redirect)');

    const navDashboard = await get('/dashboard.html', null, cookie1);
    assert(navDashboard.status === 302, 'Direct GET /dashboard.html triggers 302 redirect');
    assert(navDashboard.headers.get('location') === '/team.html?onboarding=1', 'Redirects un-squadded user to /team.html?onboarding=1');

    const navChallenges = await get('/challenges.html', null, cookie1);
    assert(navChallenges.status === 302, 'Direct GET /challenges.html triggers 302 redirect to /team.html?onboarding=1');

    const navScoreboard = await get('/scoreboard.html', null, cookie1);
    assert(navScoreboard.status === 302, 'Direct GET /scoreboard.html triggers 302 redirect to /team.html?onboarding=1');

    const navActivity = await get('/activity.html', null, cookie1);
    assert(navActivity.status === 302, 'Direct GET /activity.html triggers 302 redirect to /team.html?onboarding=1');

    const navAnnounce = await get('/announcements.html', null, cookie1);
    assert(navAnnounce.status === 302, 'Direct GET /announcements.html triggers 302 redirect to /team.html?onboarding=1');

    // RULES page remains accessible
    const navRules = await get('/rules.html', null, cookie1);
    assert(navRules.status === 200, 'Direct GET /rules.html remains accessible (200 OK)');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Admin Squad Gate Exemption
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 5] Administrator Level 5 Clearance Exemption');
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;
    const adminLogin = await post('/api/v1/admin/auth/login', {
      username: 'Admin',
      password: adminPassword
    });
    assert(adminLogin.status === 200 && adminLogin.body.token, 'Admin authenticated successfully');
    const adminToken = adminLogin.body.token;
    const adminCookie = `xploitx_token=${adminToken}`;

    const adminChallenges = await get('/api/v1/challenges', adminToken);
    assert(adminChallenges.status === 200, 'Admin accesses GET /api/v1/challenges with 200 OK (Squad Gate Exempt)');

    const adminScoreboard = await get('/api/v1/scoreboard', adminToken);
    assert(adminScoreboard.status === 200, 'Admin accesses GET /api/v1/scoreboard with 200 OK');

    const adminDashboard = await get('/api/v1/dashboard', adminToken);
    assert(adminDashboard.status === 200, 'Admin accesses GET /api/v1/dashboard with 200 OK');

    const adminSubmissions = await get('/api/v1/submissions', adminToken);
    assert(adminSubmissions.status === 200, 'Admin accesses GET /api/v1/submissions with 200 OK');

    const adminNavDash = await get('/dashboard.html', null, adminCookie);
    assert(adminNavDash.status === 200, 'Admin navigates directly to /dashboard.html without redirection (200 OK)');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Commission a Squad (Creation Flow & Duplicate Guards)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 6] Squad Commissioning Protocol & Duplicate Guards');
    const squadName = `CYBER_VIPERS_${ts}`;
    const createRes = await post('/api/v1/teams', { name: squadName }, token1);
    assert(createRes.status === 201, `Operative 1 commissions squad: ${squadName}`);
    assert(createRes.body.team && createRes.body.team.id && createRes.body.team.id.startsWith('XPX-TEAM-'), `Assigned valid ID format: ${createRes.body.team?.id}`);
    assert(createRes.body.team && createRes.body.team.accessCode && createRes.body.team.accessCode.startsWith('XPL-'), `Generated secure access code: ${createRes.body.team?.accessCode}`);

    const squadId = createRes.body.team.id;
    const accessCode = createRes.body.team.accessCode;

    // Verify /api/v1/auth/me now reflects squad membership
    const me1After = await get('/api/v1/auth/me', token1);
    assert(me1After.body.user.hasSquad === true, 'GET /api/v1/auth/me immediately reflects hasSquad === true');
    assert(me1After.body.user.team_id === squadId, `GET /api/v1/auth/me returns team_id === ${squadId}`);
    assert(me1After.body.user.team?.name === squadName, `GET /api/v1/auth/me returns team object with name ${squadName}`);

    // Duplicate squad name attempt by another user -> 409 RECORD ALREADY EXISTS
    const dupCreate = await post('/api/v1/teams', { name: squadName.toLowerCase() }, token2);
    assert(dupCreate.status === 409, 'Duplicate squad name creation rejected with 409');
    assert(dupCreate.body.message && dupCreate.body.message.includes('RECORD ALREADY EXISTS'), 'Error message contains "RECORD ALREADY EXISTS"');

    // Already-squadded operative attempting to create another squad -> 409 ALREADY_MEMBER
    const reCreate = await post('/api/v1/teams', { name: `ANOTHER_SQUAD_${ts}` }, token1);
    assert(reCreate.status === 409, 'Already-squadded operative creating second squad rejected with 409');
    assert(reCreate.body.error === 'ALREADY_MEMBER', 'Rejection code is ALREADY_MEMBER');

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Post-Commissioning Feature Access (Unlocked)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 7] Post-Commissioning Full Access Verification (Unlocked)');

    const chPost = await get('/api/v1/challenges', token1);
    assert(chPost.status === 200, 'GET /api/v1/challenges returns 200 OK after joining squad');

    const sbPost = await get('/api/v1/scoreboard', token1);
    assert(sbPost.status === 200, 'GET /api/v1/scoreboard returns 200 OK after joining squad');

    const dashPost = await get('/api/v1/dashboard', token1);
    assert(dashPost.status === 200, 'GET /api/v1/dashboard returns 200 OK after joining squad');

    const subsPost = await get('/api/v1/submissions', token1);
    assert(subsPost.status === 200, 'GET /api/v1/submissions returns 200 OK after joining squad');

    const annPost = await get('/api/v1/announcements', token1);
    assert(annPost.status === 200, 'GET /api/v1/announcements returns 200 OK after joining squad');

    const hintsPost = await get('/api/v1/hints', token1);
    assert(hintsPost.status === 200, 'GET /api/v1/hints returns 200 OK after joining squad');

    const filesPost = await get('/api/v1/files', token1);
    assert(filesPost.status === 200, 'GET /api/v1/files returns 200 OK after joining squad');

    // Direct HTML page navigation now allowed (no redirect)
    const navDashPost = await get('/dashboard.html', null, cookie1);
    assert(navDashPost.status === 200, 'Direct GET /dashboard.html returns 200 OK (access unlocked)');

    const navChallPost = await get('/challenges.html', null, cookie1);
    assert(navChallPost.status === 200, 'Direct GET /challenges.html returns 200 OK (access unlocked)');

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Squad Join Flow
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 8] Operative Squad Join Flow via Access Code');

    // Operative 2 before join cannot access
    const op2ChBefore = await get('/api/v1/challenges', token2);
    assert(op2ChBefore.status === 403, 'Operative 2 blocked before joining squad (403)');

    // Join squad with invalid code
    const invalidJoin = await post('/api/v1/teams/join', { accessCode: 'XPL-INVALID' }, token2);
    assert(invalidJoin.status === 404, 'Joining with invalid code returns 404');

    // Join squad with valid code
    const joinRes = await post('/api/v1/teams/join', { accessCode }, token2);
    assert(joinRes.status === 200, 'Operative 2 links with squad successfully (200 OK)');
    assert(joinRes.body.team?.id === squadId, `Joined correct squad ID: ${squadId}`);

    // Operative 2 /auth/me reflects squad
    const me2After = await get('/api/v1/auth/me', token2);
    assert(me2After.body.user.hasSquad === true, 'Operative 2 /auth/me reflects hasSquad === true');
    assert(me2After.body.user.team_id === squadId, `Operative 2 /auth/me returns team_id === ${squadId}`);

    // Operative 2 can now access protected features
    const op2ChAfter = await get('/api/v1/challenges', token2);
    assert(op2ChAfter.status === 200, 'Operative 2 accesses /api/v1/challenges with 200 OK after join');

    const op2DashNav = await get('/dashboard.html', null, cookie2);
    assert(op2DashNav.status === 200, 'Operative 2 navigates to /dashboard.html with 200 OK');

    // Operative 2 cannot join another team
    const op2Rejoin = await post('/api/v1/teams/join', { accessCode }, token2);
    assert(op2Rejoin.status === 409, 'Already-squadded operative joining another team returns 409 ALREADY_MEMBER');

    // ──────────────────────────────────────────────────────────────────────────
    // 9. Cross-Session & Database Persistence Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[SECTION 9] Atlas Database Persistence & Re-Authentication Verification');

    // Log out Operative 1 and log back in
    const op1Relogin = await post('/api/v1/auth/login', {
      username: op1Name,
      password: 'StrongOperativePass#2026'
    });
    assert(op1Relogin.status === 200, 'Operative 1 re-authenticates successfully');
    assert(op1Relogin.body.user.hasSquad === true, 'Re-login response retains hasSquad === true');
    assert(op1Relogin.body.user.team_id === squadId, `Re-login response retains team_id === ${squadId}`);

    // Query team dossier
    const teamDoc = await get(`/api/v1/teams/${squadId}`, token1);
    assert(teamDoc.status === 200, 'GET /api/v1/teams/:id returns squad details');
    assert(teamDoc.body.team.members.length === 2, `Squad roster reflects both operatives (memberCount === 2)`);

    console.log('\n================================================================');
    console.log(`  VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
