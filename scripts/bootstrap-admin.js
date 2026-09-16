/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Admin Account Bootstrap Engine (scripts/bootstrap-admin.js)
 *
 * Implements:
 * 1. Reads Admin credentials securely from environment configuration.
 * 2. Hashes password ONCE with standard bcryptjs (cost factor 10).
 * 3. Immediately tests and verifies the generated hash before persisting.
 * 4. Inserts ONLY the single authoritative Administrator document into users collection.
 * 5. Zero fake/mock data, zero test teams/challenges.
 * 6. Prints safe diagnostic telemetry only (never passwords or hashes).
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const RAW_URL = process.env.DATABASE_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'xploitx_ctf';

const ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const ADMIN_EMAIL = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@xploitx.local').trim().toLowerCase();
const ADMIN_CALLSIGN = process.env.BOOTSTRAP_ADMIN_CALLSIGN || 'COMMANDER';
const COMP_ID = 'c0000000-0000-0000-0000-000000000001';

async function bootstrapAdmin() {
  console.log('================================================================');
  console.log('  XPLOITX // ADMINISTRATOR BOOTSTRAP PROTOCOL');
  console.log('================================================================\n');

  if (!RAW_URL) {
    console.error('FATAL: Neither DATABASE_URL nor MONGODB_URI is defined in environment.');
    process.exit(1);
  }

  if (!ADMIN_PASSWORD) {
    console.error('FATAL: BOOTSTRAP_ADMIN_PASSWORD is not set in environment.');
    console.error('       Please provide BOOTSTRAP_ADMIN_PASSWORD in backend/.env or execution environment.');
    process.exit(1);
  }

  console.log(`[CONFIG] Target Database: ${DB_NAME}`);
  console.log(`[CONFIG] Admin Username:  ${ADMIN_USERNAME}`);
  console.log(`[CONFIG] Admin Callsign:  ${ADMIN_CALLSIGN}`);
  console.log(`[CONFIG] Admin Email:     ${ADMIN_EMAIL}`);
  console.log('----------------------------------------------------------------');

  // 1. Hash password with bcryptjs (cost factor 10)
  console.log('[CRYPTO] Generating secure bcrypt hash (cost factor: 10)...');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // 2. Verify hash immediately
  const isValid = await bcrypt.compare(ADMIN_PASSWORD, passwordHash);
  if (!isValid) {
    console.error('FATAL: Immediate bcrypt verification failed!');
    process.exit(1);
  }
  console.log('✓ [CRYPTO] Bcrypt hash generated and self-verified successfully.');

  // 3. Connect to MongoDB Atlas
  console.log('[DATABASE] Connecting to MongoDB Atlas cluster...');
  const client = new MongoClient(RAW_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log('[DATABASE] Connected successfully.');

  // 4. Provision single Admin account document
  const adminDoc = {
    id: 'u0000000-0000-0000-0000-000000000001',
    competition_id: COMP_ID,
    team_id: null,
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    password_hash: passwordHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    callsign: ADMIN_CALLSIGN,
    affiliation: 'XploitX Operations Command',
    is_banned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const usersColl = db.collection('users');

  // Upsert on exact username to prevent duplicates
  const existingUser = await usersColl.findOne({ username: ADMIN_USERNAME });
  if (existingUser) {
    await usersColl.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          password_hash: passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          email: ADMIN_EMAIL,
          callsign: ADMIN_CALLSIGN,
          is_banned: false,
          updated_at: new Date().toISOString()
        }
      }
    );
    console.log(`✓ [ADMIN] Updated existing Admin account (Username: "${ADMIN_USERNAME}", Role: "ADMIN").`);
  } else {
    await usersColl.insertOne(adminDoc);
    console.log(`✓ [ADMIN] Provisioned new Admin account (Username: "${ADMIN_USERNAME}", Role: "ADMIN").`);
  }

  // 5. Ensure unique indexes on users collection
  await usersColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
  await usersColl.createIndex({ username: 1 }, { unique: true }).catch(() => {});
  await usersColl.createIndex({ email: 1 }, { unique: true }).catch(() => {});

  // 6. Safe telemetry report
  const totalUsers = await usersColl.countDocuments();
  const adminFound = await usersColl.findOne({ username: ADMIN_USERNAME, role: 'ADMIN' });

  console.log('\n================================================================');
  console.log('  BOOTSTRAP VERIFICATION AUDIT');
  console.log('================================================================');
  console.log(`Database connected:     YES`);
  console.log(`Database name:          ${DB_NAME}`);
  console.log(`Admin account found:    ${adminFound ? 'YES' : 'NO'}`);
  console.log(`Total users in system:  ${totalUsers}`);
  console.log(`Admin username:         ${ADMIN_USERNAME}`);
  console.log(`Admin clearance role:   ${adminFound?.role || 'NONE'}`);
  console.log('================================================================\n');

  await client.close();
  process.exit(0);
}

bootstrapAdmin().catch(err => {
  console.error('Fatal bootstrap error:', err.message);
  process.exit(1);
});
