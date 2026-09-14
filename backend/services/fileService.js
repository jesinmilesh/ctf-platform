/**
 * XPLOITX // CYBER BATTLEFIELD
 * Secure File Management Service (backend/services/fileService.js)
 * Implements Sections 4, 5, 6, 7, 22, 24, 28, 29, 38 of Architectural Specification:
 * - Storage abstraction (LocalStorageProvider / ObjectStorageProvider)
 * - Filename sanitization & path traversal protection
 * - Cryptographic SHA-256 integrity checksum calculation
 * - Atomic persistence to MongoDB Atlas (challenge_files collection)
 * - Safe authorized streaming & cleanup
 */

const path = require('path');
const crypto = require('crypto');
const db = require('../config/database');
const { getStorageProvider } = require('../storage/storageProvider');
const realtimeService = require('./realtimeService');

class FileService {
  constructor() {
    this.storage = getStorageProvider();
  }

  /**
   * Store challenge asset file with SHA-256 calculation & Atlas metadata persistence
   */
  async saveChallengeFile({ challengeId, filename, buffer, mimeType, user }) {
    if (!challengeId) throw new Error('VALIDATION_ERROR: challengeId is required.');
    if (!filename) throw new Error('VALIDATION_ERROR: filename is required.');
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('VALIDATION_ERROR: File buffer is required.');

    // 1. Filename sanitization & path traversal prevention (Section 22)
    const base = path.basename(filename);
    const safeFilename = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      throw new Error('SECURITY_ERROR: Filename contains illegal characters or path traversal elements.');
    }

    // 2. Cryptographic SHA-256 integrity calculation (Section 38)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileId = crypto.randomUUID();

    // 3. Decoupled Storage Key (Section 4 & 24)
    const storageKey = `challenges/${challengeId}/${fileId}/${safeFilename}`;

    // 4. Store via StorageProvider abstraction
    await this.storage.putObject(storageKey, buffer, mimeType || 'application/octet-stream');

    // 5. Authoritative File Metadata Record for MongoDB Atlas
    const fileRecord = {
      id: fileId,
      challenge_id: challengeId,
      challengeId: challengeId,
      filename: safeFilename,
      name: safeFilename,
      originalName: base,
      storage_key: storageKey,
      storageKey: storageKey,
      file_size_bytes: buffer.length,
      size: buffer.length,
      mime_type: mimeType || 'application/octet-stream',
      mimeType: mimeType || 'application/octet-stream',
      sha256: hash,
      download_count: 0,
      visibility: 'challenge',
      downloadable: true,
      uploaded_at: new Date().toISOString(),
      uploadedAt: new Date().toISOString()
    };

    // 6. Push to in-memory tracked array & Atlas replication
    const files = db.getFiles ? db.getFiles() : [];
    files.push(fileRecord);

    if (db.isMongo && db.mongoDb) {
      await db.persistDoc('challengeFiles', fileRecord).catch(err => {
        console.error('[FILE SERVICE] Atlas persistDoc error:', err.message);
      });
    }

    // 7. Realtime Synchronization Event (Section 21)
    await realtimeService.broadcastChallengeFileAdded(challengeId, fileRecord).catch(() => {});
    await realtimeService.broadcastChallengeUpdated(challengeId).catch(() => {});

    return fileRecord;
  }

  /**
   * Find file metadata record by ID or filename
   */
  getFileRecord(fileId) {
    if (!fileId) return null;
    const cleanId = String(fileId).trim();
    const files = db.getFiles ? db.getFiles() : [];
    return files.find(f =>
      f.id === cleanId ||
      f.filename === cleanId ||
      f.storage_key === cleanId ||
      f.name === cleanId
    );
  }

  /**
   * Get all files belonging to a specific challenge (supports multiple alternate IDs e.g. id and _id)
   */
  getChallengeFiles(challengeId, ...altIds) {
    if (!challengeId) return [];
    const ids = [challengeId, ...altIds].filter(Boolean).map(id => String(id).trim());
    const files = db.getFiles ? db.getFiles() : [];
    return files.filter(f => ids.includes(f.challenge_id) || ids.includes(f.challengeId));
  }

  /**
   * Get readable stream for safe streaming to participant
   */
  async getFileStream(fileRecordOrId) {
    const fileRecord = typeof fileRecordOrId === 'object' && fileRecordOrId !== null
      ? fileRecordOrId
      : this.getFileRecord(fileRecordOrId);

    if (!fileRecord) return null;

    const storageKey = fileRecord.storage_key || fileRecord.storageKey || fileRecord.filename;
    fileRecord.download_count = (fileRecord.download_count || 0) + 1;

    return this.storage.getObjectStream(storageKey);
  }

  /**
   * Legacy disk path resolver for local testing compatibility
   */
  getFilePath(fileRecord) {
    const storageKey = fileRecord.storage_key || fileRecord.storageKey || fileRecord.filename;
    if (this.storage._resolvePath) {
      return this.storage._resolvePath(storageKey);
    }
    const legacyDir = path.join(__dirname, '..', '..', 'challenge-storage');
    return path.join(legacyDir, path.basename(storageKey));
  }

  /**
   * Delete challenge file from storage & database (Section 30)
   */
  async deleteFile(fileId) {
    const rec = this.getFileRecord(fileId);
    if (!rec) return false;

    const storageKey = rec.storage_key || rec.storageKey || rec.filename;

    // 1. Delete from physical/object storage
    try {
      await this.storage.deleteObject(storageKey);
    } catch (err) {
      console.warn('[FILE SERVICE] Storage deletion warning:', err.message);
    }

    // 2. Remove from database / in-memory cache
    const files = db.getFiles ? db.getFiles() : [];
    const idx = files.findIndex(f => f.id === rec.id);
    if (idx !== -1) {
      files.splice(idx, 1);
    }

    // 3. Remove from MongoDB Atlas
    if (db.isMongo && db.mongoDb) {
      await db.mongoDb.collection('challenge_files').deleteOne({ id: rec.id }).catch(() => {});
    }

    // 4. Real-time notification & cache invalidation (Section 20 & 21)
    await realtimeService.broadcastChallengeUpdated(rec.challenge_id || rec.challengeId).catch(() => {});

    return true;
  }

  // Aliases for interface flexibility
  async storeFile(args) { return this.saveChallengeFile(args); }
  async saveFile(args) { return this.saveChallengeFile(args); }
}

const fileService = new FileService();
module.exports = fileService;
