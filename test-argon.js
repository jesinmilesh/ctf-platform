const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const argon2 = require('argon2');
const authService = require('./backend/services/authService');
const db = require('./backend/config/database');

async function check() {
  await db.init();
  const u = db.data.users[0];
  console.log('User found in db:', {
    username: u.username,
    email: u.email,
    callsign: u.callsign,
    role: u.role,
    hash: u.password_hash
  });

  const testPasswords = [
    process.env.BOOTSTRAP_ADMIN_PASSWORD,
    'Commander@Xploitx!Admin',
    'admin123',
    'admin',
    'Commander@Xploitx'
  ];

  for (const pw of testPasswords) {
    if (!pw) continue;
    try {
      const match = await argon2.verify(u.password_hash, pw);
      console.log(`Password "${pw}": match = ${match}`);
    } catch (e) {
      console.log(`Password "${pw}": error = ${e.message}`);
    }
  }

  // Now test authService.login directly
  try {
    const res = await authService.login('Admin', 'Commander@Xploitx!Admin');
    console.log('authService.login with Admin:', !!res.token);
  } catch (e) {
    console.error('authService.login failed:', e.message);
  }

  if (typeof db.close === 'function') await db.close();
}

check().catch(console.error);
