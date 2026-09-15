/**
 * Verify admin login works end-to-end through authService.
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const db = require('./backend/config/database');
const authService = require('./backend/services/authService');

async function verify() {
  await db.init();

  const users = db.getUsers();
  console.log(`[DB] Users in memory: ${users.length}`);
  if (users.length > 0) {
    const u = users[0];
    console.log(`[DB] User: username="${u.username}", role="${u.role}", callsign="${u.callsign}"`);
    console.log(`[DB] Hash starts with: ${u.password_hash.slice(0, 20)}...`);
  }

  console.log('\n[TEST] Testing admin login...');

  const testCases = [
    { user: 'Admin',              pass: 'Commander@Xploitx!Admin', expect: 'PASS' },
    { user: 'admin',              pass: 'Commander@Xploitx!Admin', expect: 'PASS (case-insensitive)' },
    { user: 'COMMANDER',          pass: 'Commander@Xploitx!Admin', expect: 'PASS (callsign)' },
    { user: 'jesinmilesh@gmail.com', pass: 'Commander@Xploitx!Admin', expect: 'PASS (email)' },
    { user: 'Admin',              pass: 'wrong',                   expect: 'FAIL' },
    { user: 'Admin',              pass: 'admin123',                expect: 'FAIL (blocked)' },
  ];

  for (const tc of testCases) {
    try {
      const res = await authService.login(tc.user, tc.pass);
      const role = res.user?.role;
      console.log(`  [${tc.expect}] login("${tc.user}", "***") -> OK, role=${role}, token=${res.token ? 'present' : 'MISSING'}`);
    } catch (err) {
      console.log(`  [${tc.expect}] login("${tc.user}", "***") -> ERROR: ${err.message}`);
    }
  }

  await db.close();
  console.log('\n[DONE] Verification complete.');
  process.exit(0);
}

verify().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
