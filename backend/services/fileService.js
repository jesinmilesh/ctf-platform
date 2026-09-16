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
const auditService = require('./auditService');

class FileService {
  constructor() {
    this._storage = null;
  }

  get storage() {
    return getStorageProvider();
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
    const challenges = db.getChallenges ? db.getChallenges() : [];
    const ch = challenges.find(c =>
      c.id === challengeId ||
      (c._id && String(c._id) === challengeId) ||
      c.slug === challengeId ||
      c.mission_id === challengeId
    );
    const publicChallengeId = ch ? ch.id : challengeId;
    const internalChallengeObjectId = (ch && ch._id) ? String(ch._id) : null;

    const fileRecord = {
      id: fileId,
      challenge_id: publicChallengeId,
      challengeId: publicChallengeId,
      challengeObjectId: internalChallengeObjectId,
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

    // Link file directly to challenge files array
    if (ch) {
      ch.files = ch.files || [];
      if (!ch.files.some(f => (f.id || f.fileId) === fileId)) {
        ch.files.push({
          fileId,
          id: fileId,
          originalName: base,
          filename: safeFilename,
          name: safeFilename,
          size: buffer.length,
          file_size_bytes: buffer.length,
          mimeType: mimeType || 'application/octet-stream',
          sha256: hash
        });
      }
      if (db.isMongo && db.persistDoc) {
        db.persistDoc('challenges', ch).catch(() => {});
      }
    }

    if (db.isMongo && db.mongoDb) {
      await db.persistDoc('challengeFiles', fileRecord).catch(err => {
        console.error('[FILE SERVICE] Atlas persistDoc error:', err.message);
      });
    }

    // 7. Realtime Synchronization Event (Section 21)
    await realtimeService.broadcastChallengeFileAdded(publicChallengeId, fileRecord).catch(() => {});
    await realtimeService.broadcastChallengeUpdated(challengeId).catch(() => {});

    // 8. Audit Record (Prompt Section 16 & 38)
    auditService.record({
      action: 'CHALLENGE_FILE_UPLOADED',
      category: 'FILE',
      severity: 'INFO',
      actor: user || { type: 'USER', username: 'ADMIN', role: 'ADMIN' },
      resource: { type: 'FILE', id: fileId, challengeId },
      result: 'SUCCESS',
      description: `Challenge asset "${safeFilename}" uploaded (${buffer.length} bytes)`,
      metadata: {
        challengeId,
        fileId,
        filename: safeFilename,
        size: buffer.length,
        sha256: hash
      }
    }).catch(() => {});

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
   * Get all files belonging to a specific challenge.
   * Accepts the canonical challenge ID plus any number of alternate IDs (old UUIDs, slugs, etc.)
   * to handle files uploaded before the canonical ID fix.
   */
  getChallengeFiles(challengeId, ...altIds) {
    if (!challengeId) return [];
    // Build a comprehensive set of all possible IDs for this challenge
    const ids = new Set([challengeId, ...altIds].filter(Boolean).map(id => String(id).trim()));

    // Auto-discover legacy_id or alternate keys from the challenge in memory
    try {
      const chs = db.getChallenges ? db.getChallenges() : [];
      const ch = chs.find(c =>
        ids.has(String(c.id)) ||
        (c._id && ids.has(String(c._id))) ||
        (c.legacy_id && ids.has(String(c.legacy_id))) ||
        (c.mission_id && ids.has(String(c.mission_id))) ||
        (c.slug && ids.has(String(c.slug))) ||
        (c.challengeId && ids.has(String(c.challengeId))) ||
        (c.publicRouteId && ids.has(String(c.publicRouteId)))
      );
      if (ch) {
        if (ch.id) ids.add(String(ch.id).trim());
        if (ch._id) ids.add(String(ch._id).trim());
        if (ch.challengeId) ids.add(String(ch.challengeId).trim());
        if (ch.publicRouteId) ids.add(String(ch.publicRouteId).trim());
        if (ch.legacy_id) ids.add(String(ch.legacy_id).trim());
        if (ch.mission_id) ids.add(String(ch.mission_id).trim());
        if (ch.slug) ids.add(String(ch.slug).trim());
      }
    } catch (_) {}

    const files = db.getFiles ? db.getFiles() : [];
    return files.filter(f => {
      const fCId = f.challenge_id ? String(f.challenge_id).trim() : '';
      const fAltCId = f.challengeId ? String(f.challengeId).trim() : '';
      return ids.has(fCId) || ids.has(fAltCId);
    });
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

    // 3. Remove from challenge.files array
    const challenges = db.getChallenges ? db.getChallenges() : [];
    for (const c of challenges) {
      if (Array.isArray(c.files)) {
        const fIdx = c.files.findIndex(f => (f.id || f.fileId) === rec.id);
        if (fIdx !== -1) {
          c.files.splice(fIdx, 1);
          if (db.isMongo && db.persistDoc) {
            db.persistDoc('challenges', c).catch(() => {});
          }
        }
      }
    }

    // 4. Remove from MongoDB Atlas
    if (db.isMongo && db.mongoDb) {
      await db.mongoDb.collection('challenge_files').deleteOne({ id: rec.id }).catch(() => {});
    }

    // 5. Real-time notification & cache invalidation (Section 20 & 21)
    await realtimeService.broadcastChallengeFileDeleted(rec.challenge_id || rec.challengeId, rec.id).catch(() => {});
    await realtimeService.broadcastChallengeUpdated(rec.challenge_id || rec.challengeId).catch(() => {});

    // 6. Audit Record
    auditService.record({
      action: 'CHALLENGE_FILE_DELETED',
      category: 'FILE',
      severity: 'NOTICE',
      actor: { type: 'USER', username: 'ADMIN', role: 'ADMIN' },
      resource: { type: 'FILE', id: rec.id, challengeId: rec.challenge_id || rec.challengeId },
      result: 'SUCCESS',
      description: `Challenge asset "${rec.filename}" neutralized`,
      metadata: { challengeId: rec.challenge_id || rec.challengeId, fileId: rec.id, filename: rec.filename }
    }).catch(() => {});

    return true;
  }

  // Aliases for interface flexibility
  async storeFile(args) { return this.saveChallengeFile(args); }
  async saveFile(args) { return this.saveChallengeFile(args); }
}

const fileService = new FileService();
module.exports = fileService;
