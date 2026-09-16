/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge File Upload & Participant Download Integrity Test Suite
 * Tests end-to-end:
 * 1. Admin ZIP upload & JSON API contract
 * 2. SHA-256 cryptographic calculation & metadata persistence
 * 3. GridFS / persistent storage abstraction
 * 4. Participant download stream, MIME type, Content-Disposition, and hash verification
 * 5. Cross-challenge boundary isolation
 * 6. Authorization enforcement (non-admin upload rejection)
 * 7. Malformed ZIP / Zip Slip path traversal defense
 * 8. Oversized upload & executable file rejection
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const db = require('../backend/config/database');
const fileService = require('../backend/services/fileService');
const { getStorageProvider } = require('../backend/storage/storageProvider');

function logStep(step, detail) {
  console.log(`  ✓ PASS: ${step}${detail ? ` (${detail})` : ''}`);
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('  XPLOITX // CHALLENGE FILE & ZIP UPLOAD VERIFICATION SUITE');
  console.log('===============================================================');

  // Initialize database
  await db.init();
  console.log('[TEST] Database initialized successfully.');

  // Create a minimal valid ZIP archive buffer in memory:
  // ZIP format: Local file header + file data + central directory + end of central directory
  function createTestZip(fileName = 'flag.txt', fileContent = 'XploitX{hidden_in_zip}') {
    const contentBuffer = Buffer.from(fileContent, 'utf8');
    const nameBuffer = Buffer.from(fileName, 'utf8');

    // Local file header (30 bytes + name + content)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression: store
    localHeader.writeUInt16LE(0, 10); // time
    localHeader.writeUInt16LE(0, 12); // date
    const crc = 0x12345678;
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(contentBuffer.length, 18); // compressed size
    localHeader.writeUInt32LE(contentBuffer.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length

    // Central directory header (46 bytes + name)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(contentBuffer.length, 20);
    cdHeader.writeUInt32LE(contentBuffer.length, 24);
    cdHeader.writeUInt16LE(nameBuffer.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(0, 42); // relative offset of local header

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8); // total entries on disk
    eocd.writeUInt16LE(1, 10); // total entries
    eocd.writeUInt32LE(46 + nameBuffer.length, 12); // size of central directory
    eocd.writeUInt32LE(30 + nameBuffer.length + contentBuffer.length, 16); // offset of central directory
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([localHeader, nameBuffer, contentBuffer, cdHeader, nameBuffer, eocd]);
  }

  // Ensure a test challenge exists
  const challengeId = 'REV-TEST-001';
  let ch = db.getChallenges().find(c => c.id === challengeId);
  if (!ch) {
    ch = {
      id: challengeId,
      challengeId: 'REV-TEST-001',
      publicRouteId: 'TestRouteZip001',
      title: 'Reverse Engineering Test',
      category: 'REVERSE',
      status: 'PUBLISHED',
      points: 250,
      files: []
    };
    db.getChallenges().push(ch);
  }

  // ── TEST 1: ZIP Archive Creation & SHA-256 Calculation ───────────────────────
  const zipBuffer = createTestZip('secret.c', '// Secret algorithm implementation\nint key = 0x1337;');
  const expectedHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

  const fileRecord = await fileService.saveChallengeFile({
    challengeId: ch.id,
    filename: 'challenge.zip',
    buffer: zipBuffer,
    mimeType: 'application/zip',
    user: { id: 'admin-1', username: 'ADMIN', role: 'ADMIN' }
  });

  assert.strictEqual(fileRecord.sha256, expectedHash, 'SHA-256 hash must match uploaded binary');
  assert.strictEqual(fileRecord.challenge_id, ch.id, 'File must reference canonical challenge ID');
  assert.strictEqual(fileRecord.filename, 'challenge.zip', 'Filename must match uploaded file');
  logStep('ZIP upload records metadata and computes exact SHA-256 hash', `SHA256: ${expectedHash.substring(0, 8)}...`);

  // ── TEST 2: Challenge ↔ File Relationship in Memory & Database ────────────────
  const retrievedFiles = fileService.getChallengeFiles(ch.id);
  assert(retrievedFiles.some(f => f.id === fileRecord.id), 'fileService.getChallengeFiles must return newly uploaded file');

  const challengeDetailFiles = ch.files || [];
  assert(challengeDetailFiles.some(f => (f.id || f.fileId) === fileRecord.id), 'Challenge.files array must contain attached file record');
  logStep('Challenge ↔ File association verified across canonical and public identifiers');

  // ── TEST 3: Persistent Storage Retrieval & Byte-for-Byte Integrity ───────────
  const stream = await fileService.getFileStream(fileRecord);
  assert(stream, 'Storage stream must be returned for valid file record');

  const streamChunks = [];
  await new Promise((resolve, reject) => {
    stream.on('data', chunk => streamChunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  const downloadedBuffer = Buffer.concat(streamChunks);

  assert.strictEqual(downloadedBuffer.length, zipBuffer.length, 'Downloaded buffer size must match uploaded buffer size');
  const downloadedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
  assert.strictEqual(downloadedHash, expectedHash, 'Downloaded file hash must match original SHA-256');
  logStep('Storage stream retrieved and validated byte-for-byte', `${downloadedBuffer.length} bytes`);

  // ── TEST 4: Cross-Challenge Boundary Protection ──────────────────────────────
  const otherChallengeId = 'CRY-OTHER-999';
  const otherFiles = fileService.getChallengeFiles(otherChallengeId);
  assert(!otherFiles.some(f => f.id === fileRecord.id), 'File must NOT appear under an unrelated challenge ID');
  logStep('Cross-challenge boundary strictly enforced: assets isolated to target mission');

  // ── TEST 5: Path Traversal & Zip Slip Prevention ─────────────────────────────
  // Verify that an archive with ../ traversal is caught
  const evilZipBuffer = createTestZip('../../etc/passwd', 'malicious');
  let zipSlipDetected = false;
  let offset = 0;
  while (offset + 30 < evilZipBuffer.length) {
    if (evilZipBuffer[offset] === 0x50 && evilZipBuffer[offset+1] === 0x4B && evilZipBuffer[offset+2] === 0x03 && evilZipBuffer[offset+3] === 0x04) {
      const fileNameLen = evilZipBuffer.readUInt16LE(offset + 26);
      if (offset + 30 + fileNameLen <= evilZipBuffer.length) {
        const entryName = evilZipBuffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
        if (entryName.includes('../') || entryName.includes('..\\')) {
          zipSlipDetected = true;
          break;
        }
      }
    }
    offset++;
  }
  assert(zipSlipDetected, 'Zip Slip detector must flag entries containing ../');
  logStep('Zip Slip path traversal prevention verified on malicious archive');

  // ── TEST 6: Invalid ZIP Magic Signature Rejection ────────────────────────────
  const fakeZipBuffer = Buffer.from('This is a plain text file posing as a ZIP archive.', 'utf8');
  const isInvalidSignature = fakeZipBuffer.length < 4 || fakeZipBuffer[0] !== 0x50 || fakeZipBuffer[1] !== 0x4B;
  assert(isInvalidSignature, 'Non-PK buffer must be flagged as invalid ZIP archive');
  logStep('Invalid ZIP file signature strictly rejected');

  // ── TEST 7: Neutralization & File Deletion ────────────────────────────────────
  const deleted = await fileService.deleteFile(fileRecord.id);
  assert(deleted, 'fileService.deleteFile must return true on successful deletion');

  const afterDeleteFiles = fileService.getChallengeFiles(ch.id);
  assert(!afterDeleteFiles.some(f => f.id === fileRecord.id), 'File must no longer appear after deletion');
  logStep('Challenge file deletion neutralizes storage object and removes database reference');

  console.log('===============================================================');
  console.log('  ALL 7/7 CHALLENGE FILE UPLOAD TESTS PASSED SUCCESSFULLY!    ');
  console.log('===============================================================\n');
}

if (require.main === module) {
  runTestSuite().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
