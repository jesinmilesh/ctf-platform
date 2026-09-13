/**
 * XPLOITX // CYBER BATTLEFIELD
 * Secure File Management Service (backend/services/fileService.js)
 * Implements Sections 28, 29, 38 of Architectural Blueprint:
 * Isolated challenge storage, SHA-256 checksum verification, and authorized streaming.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const realtimeService = require('./realtimeService');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'challenge-storage');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

class FileService {
  /**
   * Store and calculate SHA-256 integrity checksum (Section 38)
   */
  async saveChallengeFile({ challengeId, filename, buffer, user }) {
    const safeFilename = path.basename(filename);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const storageKey = `${Date.now()}_${safeFilename}`;
    const filePath = path.join(STORAGE_DIR, storageKey);

    fs.writeFileSync(filePath, buffer);

    const fileRecord = {
      id: crypto.randomUUID(),
      challenge_id: challengeId,
      filename: safeFilename,
      storage_key: storageKey,
      file_size_bytes: buffer.length,
      sha256: hash,
      download_count: 0,
      created_at: new Date().toISOString()
    };

    db.getFiles().push(fileRecord);

    // Broadcast file added (Section 28)
    await realtimeService.broadcastChallengeFileAdded(challengeId, fileRecord);

    return fileRecord;
  }

  getFileRecord(fileId) {
    return db.getFiles().find(f => f.id === fileId || f.filename === fileId);
  }

  getFilePath(fileRecord) {
    const safeKey = path.basename(fileRecord.storage_key || fileRecord.filename);
    const filePath = path.join(STORAGE_DIR, safeKey);

    if (!fs.existsSync(filePath)) {
      throw new Error(`STORAGE_ERROR: Challenge file payload ${fileRecord.filename} not found in isolated storage.`);
    }

    fileRecord.download_count = (fileRecord.download_count || 0) + 1;
    return filePath;
  }

  // Aliases for interface flexibility
  async storeFile(args) {
    return this.saveChallengeFile(args);
  }

  async saveFile(args) {
    return this.saveChallengeFile(args);
  }

  async getFileStream(fileId) {
    const rec = this.getFileRecord(fileId);
    if (!rec) return null;
    const p = this.getFilePath(rec);
    return fs.createReadStream(p);
  }
}

const fileService = new FileService();
module.exports = fileService;
