/**
 * XPLOITX // CYBER BATTLEFIELD
 * Fresh Database Reset — Wipes all data and seeds ONLY the admin user.
 * Run: node scripts/fresh-reset.js
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const RAW_URL = process.env.DATABASE_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'xploitx_ctf';

// Admin credentials — strictly from environment variables
const ADMIN_USERNAME  = process.env.BOOTSTRAP_ADMIN_USERNAME;
const ADMIN_PASSWORD  = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const ADMIN_EMAIL     = process.env.BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_CALLSIGN  = process.env.BOOTSTRAP_ADMIN_CALLSIGN;

const COMP_ID = 'c0000000-0000-0000-0000-000000000001';

const DEFAULT_CATEGORIES = [
  { id: 'cat-01', competition_id: COMP_ID, name: 'PWN',              slug: 'pwn',      description: 'Binary exploitation, ROP chains, and heap overflow',    color_accent: '#ff3b5c', display_order: 1 },
  { id: 'cat-02', competition_id: COMP_ID, name: 'Misc',             slug: 'misc',     description: 'Miscellaneous tactical missions',                        color_accent: '#a3a3a3', display_order: 2 },
  { id: 'cat-03', competition_id: COMP_ID, name: 'Web',              slug: 'web',      description: 'Web application exploitation and API bypasses',           color_accent: '#00d8f6', display_order: 3 },
  { id: 'cat-04', competition_id: COMP_ID, name: 'Network',          slug: 'network',  description: 'Packet inspection and routing protocols',                 color_accent: '#f9c74f', display_order: 4 },
  { id: 'cat-05', competition_id: COMP_ID, name: 'Digital Forensic', slug: 'forensic', description: 'Memory dump analysis and artifact extraction',            color_accent: '#00ff9c', display_order: 5 },
  { id: 'cat-06', competition_id: COMP_ID, name: 'OSINT',            slug: 'osint',    description: 'Open source intelligence and asset tracing',              color_accent: '#4cc9f0', display_order: 6 },
  { id: 'cat-07', competition_id: COMP_ID, name: 'Cryptography',     slug: 'crypto',   description: 'Ciphers, discrete logarithms, and cryptanalysis',         color_accent: '#c77dff', display_order: 7 },
  { id: 'cat-08', competition_id: COMP_ID, name: 'Steganography',    slug: 'stegano',  description: 'Covert data channels and hidden payloads',                color_accent: '#ffb020', display_order: 8 },
];

const DEFAULT_COMPETITION = {
  id: COMP_ID,
  slug: 'xploitx-2026',
  name: 'XPLOITX 2.0 BETA',
  tagline: 'ENTER THE DIGITAL BATTLEFIELD',
  description: '24-Hour elite cybersecurity capture the flag competition.',
  status: 'LIVE',
  start_time: new Date(Date.now() - 3600 * 1000).toISOString(),
  end_time: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
  freeze_time: null,
  flag_prefix: process.env.FLAG_PREFIX || 'XploitX\u03b2{',
  flag_suffix: process.env.FLAG_SUFFIX || '}',
  max_team_size: 4,
  dynamic_scoring: true,
  scoring_decay: 30,
  created_at: new Date().toISOString()
};

// All collections to wipe completely
const COLLECTIONS_TO_PURGE = [
  'users', 'teams', 'team_members', 'challenges', 'flags',
  'challenge_files', 'challenge_hints', 'hint_reveals',
  'submissions', 'solves', 'first_bloods', 'score_events',
  'announcements', 'notifications', 'instances', 'port_allocations',
  'audit_logs', 'sessions'
];

async function run() {
  if (!RAW_URL) {
    console.error('FATAL: DATABASE_URL or MONGODB_URI not set in backend/.env');
    process.exit(1);
  }

  console.log('=============================================================');
  console.log('  XPLOITX // FRESH DATABASE RESET');
  console.log('=============================================================');
  console.log(`[DB]    Target: ${DB_NAME}`);
  console.log('-------------------------------------------------------------');

  const client = new MongoClient(RAW_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log('[DB] Connected to MongoDB Atlas.');

  // 1. Purge all operational collections
  console.log('[RESET] Purging all collections...');
  for (const col of COLLECTIONS_TO_PURGE) {
    const result = await db.collection(col).deleteMany({});
    if (result.deletedCount > 0) {
      console.log(`  - ${col}: deleted ${result.deletedCount} documents`);
    }
  }

  // 2. Seed competition
  await db.collection('competitions').deleteMany({});
  await db.collection('competitions').insertOne(DEFAULT_COMPETITION);
  console.log(`[SEED] Competition: "${DEFAULT_COMPETITION.name}" inserted.`);

  // 3. Seed categories
  await db.collection('categories').deleteMany({});
  await db.collection('categories').insertMany(DEFAULT_CATEGORIES);
  console.log(`[SEED] ${DEFAULT_CATEGORIES.length} categories inserted.`);

  // 4. Hash admin password with native crypto scrypt (salt:key)
  console.log('[ADMIN] Hashing password with scrypt (salt:key)...');
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminKey = crypto.scryptSync(ADMIN_PASSWORD, adminSalt, 64).toString('hex');
  const passwordHash = `${adminSalt}:${adminKey}`;

  // Verify the hash immediately
  const derivedKey = crypto.scryptSync(ADMIN_PASSWORD, adminSalt, 64);
  const keyBuffer = Buffer.from(adminKey, 'hex');
  if (!crypto.timingSafeEqual(keyBuffer, derivedKey)) {
    console.error('FATAL: Scrypt hash verification failed immediately after hashing!');
    process.exit(1);
  }
  console.log('[ADMIN] Hash verified successfully.');

  // 5. Insert admin user — exact credentials as specified
  const adminDoc = {
    id: 'u0000000-0000-0000-0000-000000000001',
    competition_id: COMP_ID,
    team_id: null,
    username: ADMIN_USERNAME,
    email: (ADMIN_EMAIL || '').trim().toLowerCase(),
    password_hash: passwordHash,
    role: 'ADMIN',
    callsign: ADMIN_CALLSIGN || 'ADMIN',
    affiliation: 'XploitX Operations Command',
    is_banned: false,
    created_at: new Date().toISOString()
  };

  await db.collection('users').insertOne(adminDoc);
  console.log(`[ADMIN] User inserted: username="${adminDoc.username}", role="${adminDoc.role}"`);

  // 6. Rebuild indexes
  console.log('[INDEX] Rebuilding indexes...');
  await db.collection('users').createIndex({ id: 1 }, { unique: true }).catch(() => {});
  await db.collection('users').createIndex({ username: 1 }, { unique: true }).catch(() => {});
  await db.collection('users').createIndex({ email: 1 }, { unique: true }).catch(() => {});
  await db.collection('teams').createIndex({ id: 1 }, { unique: true }).catch(() => {});
  await db.collection('challenges').createIndex({ id: 1 }, { unique: true, sparse: true }).catch(() => {});
  await db.collection('sessions').createIndex({ token: 1 }, { unique: true }).catch(() => {});

  // 7. Verify final state
  const userCount = await db.collection('users').countDocuments();
  const catCount  = await db.collection('categories').countDocuments();
  const compCount = await db.collection('competitions').countDocuments();

  console.log('=============================================================');
  console.log('  FRESH RESET COMPLETE');
  console.log('=============================================================');
  console.log(`  users:        ${userCount} (expected: 1)`);
  console.log(`  categories:   ${catCount} (expected: 8)`);
  console.log(`  competitions: ${compCount} (expected: 1)`);
  console.log('-------------------------------------------------------------');
  console.log('  Administrator seeded with role: ADMIN (salt:key scrypt)');
  console.log('=============================================================');

  await client.close();
}

run().catch(err => {
  console.error('[FATAL] Reset failed:', err);
  process.exit(1);
});
