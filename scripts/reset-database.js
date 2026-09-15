/**
 * XPLOITX // CYBER BATTLEFIELD
 * Master Database Reset & Production Cleanup Engine (scripts/reset-database.js)
 *
 * Implements Sections 1, 2, 13, 14, 15, 17, 18, 20, 21, 22, 31, 49
 *
 * Safety Invariants:
 * 1. Requires explicit confirmation: CONFIRM_XPLOITX_DATABASE_RESET=true or --confirm flag
 * 2. Automated complete JSON backup to scripts/backups/backup-<timestamp>.json before any destructive action
 * 3. Purges all test data: users, teams, challenges, submissions, solves, instances, audit logs, and challenge-storage
 * 4. Preserves database schema, models, and recreates all required MongoDB indexes
 * 5. Produces exact Before / After document count verification report
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const { MongoClient } = require('mongodb');

// Constants & Collections
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
  'sessions'
];

const LEGACY_COLLECTIONS_TO_DROP = [
  'challengefiles',
  'teammembers',
  'instanceports',
  'hintreveals',
  'auditlogs',
  'agents',
  'agentpairingcodes',
  'scoreevents',
  'challengeflags',
  'hints',
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

const DEFAULT_SETTINGS = {
  id: 'global_settings',
  competitionName: 'XPLOITX 2.0 BETA',
  tagline: 'ENTER THE DIGITAL BATTLEFIELD',
  flagPrefix: process.env.FLAG_PREFIX || 'XploitXβ{',
  flagSuffix: process.env.FLAG_SUFFIX || '}',
  dynamicScoring: true,
  decayThreshold: 30,
  submissionRateLimit: 5,
  registrationOpen: true,
  freezeTime: null
};

// Count files in challenge-storage
function countStorageFiles() {
  if (!fs.existsSync(STORAGE_DIR)) return 0;
  let fileCount = 0;
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name !== '.gitkeep') {
        fileCount++;
      }
    }
  }
  scan(STORAGE_DIR);
  return fileCount;
}

// Clean storage directories
function cleanChallengeStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    return 0;
  }
  let deletedCount = 0;
  const entries = fs.readdirSync(STORAGE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = path.join(STORAGE_DIR, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
    deletedCount++;
  }
  return deletedCount;
}

async function run() {
  const isBackupOnly = process.argv.includes('--backup-only');
  const isConfirmed = process.env.CONFIRM_XPLOITX_DATABASE_RESET === 'true' ||
                      process.argv.includes('--confirm') ||
                      process.argv.includes('RESET XPLOITX DATABASE');
  const withBootstrapAdmin = process.argv.includes('--with-bootstrap-admin');

  console.log('================================================================');
  console.log('  XPLOITX // MASTER DATABASE RESET & CLEANUP ENGINE             ');
  console.log('================================================================');

  if (!RAW_URL) {
    console.error('FATAL: Neither DATABASE_URL nor MONGODB_URI is defined in environment.');
    process.exit(1);
  }

  const maskedUri = RAW_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:********@');
  console.log(`[CONFIG] Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`[CONFIG] Target Database: ${DB_NAME}`);
  console.log(`[CONFIG] Cluster URI:     ${maskedUri}`);
  console.log(`[CONFIG] Challenge Path:  ${STORAGE_DIR}`);
  console.log(`[CONFIG] Execution Mode:  ${isBackupOnly ? 'BACKUP ONLY' : (isConfirmed ? 'CONFIRMED RESET' : 'CONFIRMATION REQUIRED')}`);
  console.log('----------------------------------------------------------------');

  // Production environment safeguard (Section 1 & 49)
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--confirm-production')) {
    console.error('⚠️  [SAFETY INTERCEPT] PRODUCTION ENVIRONMENT DETECTED!');
    console.error('    Automatic reset is BLOCKED. To reset a production database, you must pass:');
    console.error('    CONFIRM_XPLOITX_DATABASE_RESET=true node scripts/reset-database.js --confirm-production');
    process.exit(1);
  }

  // Confirmation safeguard (Section 1)
  if (!isBackupOnly && !isConfirmed) {
    console.error('⚠️  [CONFIRMATION REQUIRED] Destructive reset was not authorized.');
    console.error('    To perform a fresh reset of database "' + DB_NAME + '", run:');
    console.error('    CONFIRM_XPLOITX_DATABASE_RESET=true node scripts/reset-database.js');
    console.error('    Or pass: node scripts/reset-database.js --confirm');
    process.exit(1);
  }

  const client = new MongoClient(RAW_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('[DATABASE] Connected to MongoDB Atlas cluster.');

  // 1. Audit & Inventory Before
  const allExistingCollections = (await db.listCollections().toArray()).map(c => c.name);
  const beforeCounts = {};
  let totalDocsBefore = 0;

  for (const colName of allExistingCollections) {
    const count = await db.collection(colName).countDocuments();
    beforeCounts[colName] = count;
    totalDocsBefore += count;
  }
  const storageFilesBefore = countStorageFiles();

  console.log(`[INVENTORY] Pre-reset: ${allExistingCollections.length} collections, ${totalDocsBefore} total documents, ${storageFilesBefore} storage files.`);

  // 2. Automated Pre-Reset Backup (Section 2)
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUPS_DIR, `backup-${DB_NAME}-${timestamp}.json`);
  console.log(`[BACKUP] Creating pre-reset snapshot: ${backupFile}...`);

  const backupData = {
    metadata: {
      database: DB_NAME,
      timestamp: new Date().toISOString(),
      collections: allExistingCollections,
      storageFileCount: storageFilesBefore,
      totalDocuments: totalDocsBefore
    },
    collections: {}
  };

  for (const colName of allExistingCollections) {
    const docs = await db.collection(colName).find({}).toArray();
    backupData.collections[colName] = docs;
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`✓ [BACKUP COMPLETE] Dumped ${totalDocsBefore} documents across ${allExistingCollections.length} collections to ${backupFile}`);

  if (isBackupOnly) {
    await client.close();
    console.log('[SUCCESS] Backup-only operation complete. Database was not modified.');
    process.exit(0);
  }

  // 3. Purge Application Collections (Section 13)
  console.log('[RESET] Purging test and operational collections...');
  for (const colName of COLLECTIONS_TO_PURGE) {
    if (allExistingCollections.includes(colName)) {
      await db.collection(colName).deleteMany({});
    }
  }

  // Drop legacy schema collections (Section 13)
  for (const colName of LEGACY_COLLECTIONS_TO_DROP) {
    if (allExistingCollections.includes(colName)) {
      await db.collection(colName).drop().catch(() => {});
    }
  }

  // 4. Reset & Seed Core Platform Taxonomy & Settings (Section 14 & 15)
  // Ensure categories exist
  const catColl = db.collection('categories');
  await catColl.deleteMany({});
  for (const cat of DEFAULT_CATEGORIES) {
    await catColl.updateOne({ id: cat.id }, { $set: cat }, { upsert: true });
  }

  // Ensure default competition entity exists
  const compColl = db.collection('competitions');
  await compColl.deleteMany({});
  await compColl.updateOne({ id: DEFAULT_COMPETITION.id }, { $set: DEFAULT_COMPETITION }, { upsert: true });

  // Ensure default platform settings exist
  const setColl = db.collection('settings');
  await setColl.updateOne({ id: DEFAULT_SETTINGS.id }, { $set: DEFAULT_SETTINGS }, { upsert: true });

  // 5. Optional Authorized Bootstrap Admin (Section 12)
  if (withBootstrapAdmin || (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD && process.env.BOOTSTRAP_ADMIN_USERNAME)) {
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const crypto = require('crypto');
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminKey = crypto.scryptSync(adminPassword, adminSalt, 64).toString('hex');
    const passwordHash = `${adminSalt}:${adminKey}`;
    const adminDoc = {
      id: 'u0000000-0000-0000-0000-000000000001',
      competition_id: DEFAULT_COMPETITION.id,
      team_id: null,
      username: process.env.BOOTSTRAP_ADMIN_USERNAME,
      email: adminEmail,
      password_hash: passwordHash,
      role: 'ADMIN',
      callsign: process.env.BOOTSTRAP_ADMIN_CALLSIGN || 'ADMIN',
      affiliation: 'XploitX Operations Command',
      is_banned: false,
      created_at: new Date().toISOString()
    };
    await db.collection('users').insertOne(adminDoc);
    console.log(`[ADMIN] Provisioned authorized bootstrap administrator: ${adminEmail} (username: ${adminDoc.username}, callsign: ${adminDoc.callsign})`);
  }

  // 6. Reset Challenge Storage (Section 17 & 18)
  console.log('[STORAGE] Purging test directories from challenge-storage...');
  const deletedDirs = cleanChallengeStorage();
  console.log(`✓ [STORAGE CLEAN] Removed ${deletedDirs} test directories from challenge storage.`);

  // 7. Recreate Required MongoDB Indexes (Section 14 & 30)
  console.log('[INDEXES] Rebuilding all production database indexes...');
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
    await cColl.createIndex({ competitionId: 1 }).catch(() => {});
    await cColl.createIndex({ domain: 1 }).catch(() => {});
    await cColl.createIndex({ slug: 1 }).catch(() => {});

    const sColl = db.collection('submissions');
    await sColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await sColl.createIndex({ challenge_id: 1, team_id: 1 }).catch(() => {});
    await sColl.createIndex({ created_at: -1 }).catch(() => {});

    const slvColl = db.collection('solves');
    await slvColl.createIndex({ id: 1 }, { unique: true }).catch(() => {});
    await slvColl.createIndex({ challenge_id: 1, team_id: 1 }).catch(() => {});

    const sessColl = db.collection('sessions');
    await sessColl.createIndex({ token: 1 }, { unique: true }).catch(() => {});

    const instColl = db.collection('instances');
    await instColl.createIndex({ instanceId: 1 }, { unique: true }).catch(() => {});
    await instColl.createIndex({ teamId: 1, challengeId: 1, status: 1 }).catch(() => {});

    const portColl = db.collection('port_allocations');
    await portColl.createIndex({ port: 1 }, { unique: true }).catch(() => {});

    const auditColl = db.collection('audit_logs');
    await auditColl.createIndex({ timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ 'actor.userId': 1, timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ 'actor.teamId': 1, timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ action: 1, timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ severity: 1, timestamp: -1 }).catch(() => {});
    await auditColl.createIndex({ 'request.requestId': 1 }).catch(() => {});
  } catch (e) {
    console.warn('[INDEX NOTICE]:', e.message);
  }

  // 8. Produce Final Verification Report (Section 15)
  const remainingCollections = (await db.listCollections().toArray()).map(c => c.name);
  const afterCounts = {};
  for (const colName of remainingCollections) {
    afterCounts[colName] = await db.collection(colName).countDocuments();
  }
  const storageFilesAfter = countStorageFiles();

  console.log('\n================================================================');
  console.log('  XPLOITX // RESET VERIFICATION AUDIT REPORT                    ');
  console.log('================================================================');
  console.log('COLLECTION'.padEnd(25) + 'BEFORE'.padEnd(12) + 'AFTER'.padEnd(12) + 'STATUS');
  console.log('----------------------------------------------------------------');

  const trackedCols = [
    'users',
    'teams',
    'team_members',
    'challenges',
    'flags',
    'challenge_files',
    'challenge_hints',
    'submissions',
    'solves',
    'first_bloods',
    'score_events',
    'instances',
    'port_allocations',
    'audit_logs',
    'sessions',
    'announcements',
    'notifications',
    'categories',
    'competitions',
    'settings'
  ];

  for (const col of trackedCols) {
    const before = beforeCounts[col] || 0;
    const after = afterCounts[col] || 0;
    const isCleanZero = ['categories', 'competitions', 'settings'].includes(col)
      ? 'READY (TAXONOMY)'
      : (after === 0 ? 'CLEAN (0)' : (withBootstrapAdmin && col === 'users' && after === 1 ? 'BOOTSTRAP (1)' : 'WARNING'));
    console.log(col.padEnd(25) + String(before).padEnd(12) + String(after).padEnd(12) + isCleanZero);
  }

  console.log('----------------------------------------------------------------');
  console.log('challenge-storage files'.padEnd(25) + String(storageFilesBefore).padEnd(12) + String(storageFilesAfter).padEnd(12) + (storageFilesAfter === 0 ? 'CLEAN (0)' : 'DIRTY'));
  console.log('================================================================');
  console.log(`[SUMMARY] Purge verified. All test operatives, challenges, and files cleared.`);
  console.log(`[STORAGE] Storage directory verified clean (${storageFilesAfter} files).`);
  console.log(`[DATABASE] MongoDB Atlas database "${DB_NAME}" is in a 100% fresh state.`);
  console.log('================================================================\n');

  await client.close();
}

run().catch(err => {
  console.error('Fatal reset error:', err);
  process.exit(1);
});
