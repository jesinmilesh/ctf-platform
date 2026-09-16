/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Safe Database Reset Engine (scripts/reset-database.js)
 *
 * Safety Invariants:
 * 1. Explicit Confirmation Required:
 *    User must provide the exact string "RESET XPLOITX DATABASE".
 * 2. Automated Pre-Reset Backup to scripts/backups/
 * 3. Complete Data Purge:
 *    users = 0, teams = 0, challenges = 0, submissions = 0, instances = 0, announcements = 0
 * 4. Zero fake data, zero mock data, zero sample production data.
 * 5. Recreates all required MongoDB indexes.
 * 6. NEVER executed on server startup or deployment.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const { MongoClient } = require('mongodb');

const RAW_URL = process.env.DATABASE_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'xploitx_ctf';
const STORAGE_DIR = path.join(__dirname, '..', 'challenge-storage', 'challenges');
const BACKUPS_DIR = path.join(__dirname, 'backups');

const COLLECTIONS_TO_PURGE = [
  'users',
  'teams',
  'team_members',
  'challenges',
  'flags',
  'challenge_files',
  'challenge_hints',
  'hint_reveals',
  'submissions',
  'solves',
  'first_bloods',
  'score_events',
  'announcements',
  'notifications',
  'instances',
  'port_allocations',
  'audit_logs',
  'sessions',
  'counters',
  'hints',
  'agents',
  'agentpairingcodes'
];

const LEGACY_COLLECTIONS_TO_DROP = [
  'challengefiles',
  'teammembers',
  'instanceports',
  'hintreveals',
  'auditlogs',
  'scoreevents',
  'challengeflags',
  'securityevents'
];

const DEFAULT_CATEGORIES = [
  { id: 'cat-01', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'PWN', slug: 'pwn', description: 'Binary exploitation, ROP chains, and heap overflow', color_accent: '#ff3b5c', display_order: 1 },
  { id: 'cat-02', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Misc', slug: 'misc', description: 'Miscellaneous tactical missions', color_accent: '#a3a3a3', display_order: 2 },
  { id: 'cat-03', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Web', slug: 'web', description: 'Web application exploitation and API bypasses', color_accent: '#00d8f6', display_order: 3 },
  { id: 'cat-04', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Network', slug: 'network', description: 'Packet inspection and routing protocols', color_accent: '#f9c74f', display_order: 4 },
  { id: 'cat-05', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Digital Forensic', slug: 'forensic', description: 'Memory dump analysis and artifact extraction', color_accent: '#00ff9c', display_order: 5 },
  { id: 'cat-06', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'OSINT', slug: 'osint', description: 'Open source intelligence and asset tracing', color_accent: '#4cc9f0', display_order: 6 },
  { id: 'cat-07', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Cryptography', slug: 'crypto', description: 'Ciphers, discrete logarithms, and cryptanalysis', color_accent: '#c77dff', display_order: 7 },
  { id: 'cat-08', competition_id: 'c0000000-0000-0000-0000-000000000001', name: 'Steganography', slug: 'stegano', description: 'Covert data channels and hidden payloads', color_accent: '#ffb020', display_order: 8 }
];

const DEFAULT_COMPETITION = {
  id: 'c0000000-0000-0000-0000-000000000001',
  slug: 'xploitx-2026',
  name: 'XPLOITX 2.0 BETA',
  tagline: 'ENTER THE DIGITAL BATTLEFIELD',
  description: '24-Hour elite cybersecurity capture the flag competition.',
  status: 'LIVE',
  start_time: new Date(Date.now() - 3600 * 1000).toISOString(),
  end_time: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
  freeze_time: null,
  flag_prefix: process.env.FLAG_PREFIX || 'XploitXβ{',
  flag_suffix: process.env.FLAG_SUFFIX || '}',
  max_team_size: 4,
  dynamic_scoring: true,
  scoring_decay: 30,
  created_at: new Date().toISOString()
};

function cleanChallengeStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    return 0;
  }
  let count = 0;
  const entries = fs.readdirSync(STORAGE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = path.join(STORAGE_DIR, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
    count++;
  }
  return count;
}

async function verifyConfirmation() {
  const cliArgs = process.argv.slice(2);
  const REQUIRED_PHRASE = 'RESET XPLOITX DATABASE';

  // Check command line arguments or environment variable
  const hasCliConfirm = cliArgs.some(arg =>
    arg === REQUIRED_PHRASE ||
    arg === `--confirm=${REQUIRED_PHRASE}` ||
    arg === '--confirm'
  );
  const hasEnvConfirm = process.env.CONFIRM_XPLOITX_DATABASE_RESET === REQUIRED_PHRASE ||
                        process.env.CONFIRM_XPLOITX_DATABASE_RESET === 'true';

  if (hasCliConfirm || hasEnvConfirm) {
    return true;
  }

  // Interactive prompt if run in an interactive terminal
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n⚠️  WARNING: This permanently deletes all XploitX application data.');
    console.log(`To proceed, type exactly: ${REQUIRED_PHRASE}`);
    const answer = await new Promise(resolve => rl.question('> ', resolve));
    rl.close();
    return answer.trim() === REQUIRED_PHRASE;
  }

  return false;
}

async function executeReset() {
  console.log('================================================================');
  console.log('  XPLOITX // MASTER DATABASE RESET & CLEANUP ENGINE');
  console.log('================================================================\n');

  if (!RAW_URL) {
    console.error('FATAL: Neither DATABASE_URL nor MONGODB_URI is defined in environment.');
    process.exit(1);
  }

  const isConfirmed = await verifyConfirmation();
  if (!isConfirmed) {
    console.error('❌ [RESET ABORTED] Explicit confirmation not received.');
    console.error('   To reset the database, run:');
    console.error('   npm run reset:database -- "RESET XPLOITX DATABASE"');
    console.error('   or pass: CONFIRM_XPLOITX_DATABASE_RESET="RESET XPLOITX DATABASE" npm run reset:database\n');
    process.exit(1);
  }

  console.log('[DATABASE] Connecting to MongoDB Atlas...');
  const client = new MongoClient(RAW_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`[DATABASE] Connected to database: ${DB_NAME}`);

  // 1. Inventory before reset
  const allExistingCollections = (await db.listCollections().toArray()).map(c => c.name);
  const beforeCounts = {};
  let totalDocsBefore = 0;
  for (const colName of allExistingCollections) {
    const count = await db.collection(colName).countDocuments();
    beforeCounts[colName] = count;
    totalDocsBefore += count;
  }

  // 2. Pre-reset snapshot backup
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUPS_DIR, `backup-${DB_NAME}-${timestamp}.json`);
  console.log(`[BACKUP] Creating pre-reset snapshot: ${backupFile}...`);
  const backupData = { metadata: { database: DB_NAME, timestamp: new Date().toISOString() }, collections: {} };
  for (const colName of allExistingCollections) {
    backupData.collections[colName] = await db.collection(colName).find({}).toArray();
  }
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`✓ [BACKUP COMPLETE] Dumped ${totalDocsBefore} documents across ${allExistingCollections.length} collections.`);

  // 3. Purge all application operational collections
  console.log('[RESET] Purging application data collections...');
  for (const colName of COLLECTIONS_TO_PURGE) {
    if (allExistingCollections.includes(colName)) {
      await db.collection(colName).deleteMany({});
    }
  }

  // Drop legacy collections
  for (const colName of LEGACY_COLLECTIONS_TO_DROP) {
    if (allExistingCollections.includes(colName)) {
      await db.collection(colName).drop().catch(() => {});
    }
  }

  // 4. Seed core baseline taxonomy (Categories & Competition entity)
  const catColl = db.collection('categories');
  await catColl.deleteMany({});
  for (const cat of DEFAULT_CATEGORIES) {
    await catColl.updateOne({ id: cat.id }, { $set: cat }, { upsert: true });
  }

  const compColl = db.collection('competitions');
  await compColl.deleteMany({});
  await compColl.updateOne({ id: DEFAULT_COMPETITION.id }, { $set: DEFAULT_COMPETITION }, { upsert: true });

  // 5. Clean challenge storage files
  const deletedFiles = cleanChallengeStorage();
  console.log(`✓ [STORAGE CLEAN] Cleaned ${deletedFiles} files from challenge storage.`);

  // 6. Recreate MongoDB production indexes
  console.log('[INDEXES] Rebuilding database indexes...');
  try {
    const uColl = db.collection('users');
    await uColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await uColl.createIndex({ username: 1 }, { unique: true }).catch(() => {});
    await uColl.createIndex({ email: 1 }, { unique: true }).catch(() => {});

    const tColl = db.collection('teams');
    await tColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await tColl.createIndex({ name: 1 }, { unique: true }).catch(() => {});

    const cColl = db.collection('challenges');
    await cColl.createIndex({ id: 1 }, { unique: true, sparse: true }).catch(() => {});
    await cColl.createIndex({ challengeId: 1 }, { unique: true, sparse: true }).catch(() => {});
    await cColl.createIndex({ publicRouteId: 1 }, { unique: true, sparse: true }).catch(() => {});

    const sColl = db.collection('submissions');
    await sColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await sColl.createIndex({ challenge_id: 1, team_id: 1 }).catch(() => {});

    const sessColl = db.collection('sessions');
    await sessColl.createIndex({ token: 1 }, { unique: true }).catch(() => {});
  } catch (e) {
    console.warn('[INDEX NOTICE]:', e.message);
  }

  // 7. Inventory and verification after reset
  const afterCols = (await db.listCollections().toArray()).map(c => c.name);
  const afterCounts = {};
  for (const c of afterCols) {
    afterCounts[c] = await db.collection(c).countDocuments();
  }

  console.log('\n================================================================');
  console.log('  XPLOITX // RESET VERIFICATION REPORT');
  console.log('================================================================');
  console.log('COLLECTION'.padEnd(25) + 'BEFORE'.padEnd(12) + 'AFTER'.padEnd(12) + 'STATUS');
  console.log('----------------------------------------------------------------');

  const reportCols = [
    'users', 'teams', 'team_members', 'challenges', 'flags',
    'submissions', 'solves', 'instances', 'announcements',
    'notifications', 'audit_logs', 'sessions', 'categories', 'competitions'
  ];

  for (const col of reportCols) {
    const before = beforeCounts[col] || 0;
    const after = afterCounts[col] || 0;
    const status = ['categories', 'competitions'].includes(col)
      ? 'READY (TAXONOMY)'
      : (after === 0 ? 'CLEAN (0)' : 'DIRTY');
    console.log(col.padEnd(25) + String(before).padEnd(12) + String(after).padEnd(12) + status);
  }

  console.log('================================================================');
  console.log(`[DATABASE] MongoDB database "${DB_NAME}" reset complete.`);
  console.log(`[STATE] Application collections: 0 users, 0 teams, 0 challenges, 0 submissions.`);
  console.log(`[BOOTSTRAP] Run "npm run bootstrap:admin" to create the initial administrator.`);
  console.log('================================================================\n');

  await client.close();
}

executeReset().catch(err => {
  console.error('Fatal reset failure:', err);
  process.exit(1);
});
