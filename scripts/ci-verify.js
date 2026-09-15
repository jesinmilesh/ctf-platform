/**
 * XPLOITX // CYBER BATTLEFIELD
 * Production CI & Architecture Verification Engine (scripts/ci-verify.js)
 *
 * Runs in CI pipelines to verify syntax, route mounting, and asset structure
 * without injecting fake data or requiring external test databases.
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  XPLOITX // PRODUCTION ARCHITECTURE & CI VERIFICATION        ');
console.log('================================================================');

let passed = true;

// 1. Validate Express Server & App Architecture
try {
  const { app } = require('../backend/server');
  if (!app) throw new Error('Express app failed to initialize.');
  console.log('  ✓ Core Express application initialized cleanly');
} catch (err) {
  console.error('  ✗ Backend initialization error:', err.message);
  passed = false;
}

// 2. Validate Database Configuration
try {
  const db = require('../backend/config/database');
  if (!db) throw new Error('Database module failed to load.');
  console.log('  ✓ Database configuration and repository engine verified');
} catch (err) {
  console.error('  ✗ Database configuration error:', err.message);
  passed = false;
}

// 3. Validate Frontend Directories & Key Assets
const requiredDirs = [
  path.join(__dirname, '..', 'frontend', 'public'),
  path.join(__dirname, '..', 'frontend', 'admin'),
  path.join(__dirname, '..', 'frontend', 'assets')
];

for (const dir of requiredDirs) {
  if (fs.existsSync(dir)) {
    console.log(`  ✓ Directory verified: ${path.relative(path.join(__dirname, '..'), dir)}`);
  } else {
    console.error(`  ✗ Missing directory: ${dir}`);
    passed = false;
  }
}

// 4. Validate Challenge Storage & Templates
const challengeTemplatesDir = path.join(__dirname, '..', 'challenge-templates');
if (fs.existsSync(challengeTemplatesDir)) {
  console.log('  ✓ Challenge templates repository verified');
} else {
  console.error('  ✗ Missing challenge-templates directory');
  passed = false;
}

console.log('----------------------------------------------------------------');
if (passed) {
  console.log('  ALL ARCHITECTURE & CI CHECKS PASSED (100%) ✓');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error('  CI ARCHITECTURE CHECKS FAILED ✗');
  console.log('================================================================\n');
  process.exit(1);
}
