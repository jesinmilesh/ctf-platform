/**
 * XPLOITX // CYBER BATTLEFIELD
 * Non-Destructive Clean State & Fresh Verification Diagnostic (scripts/verify-clean.js)
 *
 * Implements Section 46 of Master Cleanup Specification
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

const { MongoClient } = require('mongodb');

const RAW_URL = process.env.DATABASE_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'xploitx_ctf';
const STORAGE_DIR = path.join(__dirname, '..', 'challenge-storage', 'challenges');

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

async function verify() {
  console.log('================================================================');
  console.log('  XPLOITX // PRODUCTION CLEAN STATE DIAGNOSTIC VERIFICATION     ');
  console.log('================================================================');

  let passed = true;

  // 1. Storage Check
  const storageFiles = countStorageFiles();
  if (storageFiles === 0) {
    console.log('  ✓ Storage clean: zero test challenge files in challenge-storage');
  } else {
    console.log(`  ✗ Storage dirty: found ${storageFiles} files in challenge-storage`);
    passed = false;
  }

  // 2. Database Connection & Document Count Check
  if (!RAW_URL) {
    console.log('  ✗ Database URL missing');
    passed = false;
    return;
  }

  const client = new MongoClient(RAW_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const collections = [
    { name: 'challenges', label: 'No fake challenges', max: 0 },
    { name: 'teams', label: 'No fake teams', max: 0 },
    { name: 'submissions', label: 'No fake submissions', max: 0 },
    { name: 'solves', label: 'No fake solves', max: 0 },
    { name: 'first_bloods', label: 'No fake first bloods', max: 0 },
    { name: 'score_events', label: 'No fake leaderboard scores', max: 0 },
    { name: 'instances', label: 'No stale instances', max: 0 },
    { name: 'port_allocations', label: 'Port allocation clean (41000-41999)', max: 0 },
    { name: 'challenge_files', label: 'No orphaned challenge file records', max: 0 }
  ];

  for (const item of collections) {
    const count = await db.collection(item.name).countDocuments();
    if (count <= item.max) {
      console.log(`  ✓ ${item.label} (count = ${count})`);
    } else {
      console.log(`  ✗ ${item.label} FAILED: found ${count} documents in ${item.name}`);
      passed = false;
    }
  }

  // Users check: either 0 (completely empty) or 1 (authorized bootstrap admin)
  const userCount = await db.collection('users').countDocuments();
  if (userCount === 0) {
    console.log(`  ✓ User registry clean: 0 users (Ready for first real admin registration)`);
  } else if (userCount === 1) {
    const admin = await db.collection('users').findOne({});
    if (admin && admin.role === 'ADMIN') {
      console.log(`  ✓ Authorized bootstrap administrator present: ${admin.email} (Callsign: ${admin.callsign})`);
    } else {
      console.log(`  ✗ Unexpected user found in clean state: ${admin.username}`);
      passed = false;
    }
  } else {
    console.log(`  ✗ Found ${userCount} users in database (Expected 0 or 1 bootstrap admin)`);
    passed = false;
  }

  // Required Indexes Check
  const uIndexes = (await db.collection('users').indexes()).map(i => i.name);
  const cIndexes = (await db.collection('challenges').indexes()).map(i => i.name);
  const tIndexes = (await db.collection('teams').indexes()).map(i => i.name);

  if (uIndexes.includes('id_1') || uIndexes.includes('username_1')) {
    console.log('  ✓ User indexes verified');
  } else {
    console.log('  ✗ Missing user indexes');
    passed = false;
  }

  if (cIndexes.includes('id_1')) {
    console.log('  ✓ Challenge indexes verified');
  } else {
    console.log('  ✗ Missing challenge indexes');
    passed = false;
  }

  if (tIndexes.includes('id_1')) {
    console.log('  ✓ Team indexes verified');
  } else {
    console.log('  ✗ Missing team indexes');
    passed = false;
  }

  // Check categories & taxonomy
  const catCount = await db.collection('categories').countDocuments();
  if (catCount === 8) {
    console.log('  ✓ Core sector taxonomy verified (8 cybersecurity tracks)');
  } else {
    console.log(`  ⚠️ Core categories count is ${catCount} (Expected 8)`);
  }

  await client.close();

  console.log('----------------------------------------------------------------');
  if (passed) {
    console.log('  ALL CLEAN-STATE DIAGNOSTIC CRITERIA: 100% VERIFIED ✓');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.log('  CLEAN STATE VERIFICATION FAILED ✗');
    console.log('================================================================\n');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
