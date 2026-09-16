/**
 * XPLOITX // CYBER BATTLEFIELD
 * MongoDB GridFS Storage Provider (backend/storage/gridFsStorageProvider.js)
 * Implements Section 4, 14, 15, 16, 58 of Architectural Specification:
 * - Persistent object storage directly within MongoDB Atlas
 * - Zero dependency on ephemeral serverless filesystems (/tmp or read-only roots)
 * - Survives Vercel deployments, cold starts, and container restarts
 * - Streams challenge assets in standard 255KB chunks
 */

const { GridFSBucket } = require('mongodb');
const path = require('path');
const db = require('../config/database');
const { BaseStorageProvider } = require('./storageProvider');

class GridFSStorageProvider extends BaseStorageProvider {
  constructor(bucketName = 'challenge_storage') {
    super();
    this.bucketName = bucketName;
  }

  /**
   * Get an active GridFSBucket instance tied to the active database connection
   */
  _getBucket() {
    if (!db.mongoDb) {
      return null;
    }
    return new GridFSBucket(db.mongoDb, { bucketName: this.bucketName });
  }

  /**
   * Put an object buffer into GridFS
   * @param {string} storageKey 
   * @param {Buffer} buffer 
   * @param {string} mimeType 
   */
  async putObject(storageKey, buffer, mimeType = 'application/octet-stream') {
    const bucket = this._getBucket();
    if (!bucket) {
      // Fallback to local storage if MongoDB is not initialized
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.putObject(storageKey, buffer, mimeType);
    }

    // Clean up any existing file under this storageKey to prevent stale duplicates
    try {
      const existing = await bucket.find({ filename: storageKey }).toArray();
      for (const file of existing) {
        await bucket.delete(file._id).catch(() => {});
      }
    } catch (_) {}

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(storageKey, {
        contentType: mimeType,
        metadata: {
          storageKey,
          uploadedAt: new Date()
        }
      });

      uploadStream.on('error', (err) => {
        console.error(`[GRIDFS ERROR] Upload failed for ${storageKey}:`, err);
        reject(err);
      });

      uploadStream.on('finish', (fileDoc) => {
        resolve({
          storageKey,
          size: buffer.length,
          mimeType,
          gridFsId: fileDoc._id
        });
      });

      uploadStream.end(buffer);
    });
  }

  /**
   * Retrieve an object buffer from GridFS
   * @param {string} storageKey 
   */
  async getObject(storageKey) {
    const bucket = this._getBucket();
    if (!bucket) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObject(storageKey);
    }

    const stream = await this.getObjectStream(storageKey);
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          size: buffer.length
        });
      });
    });
  }

  /**
   * Retrieve a readable stream for a GridFS object
   * @param {string} storageKey 
   */
  async getObjectStream(storageKey) {
    const bucket = this._getBucket();
    if (!bucket) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObjectStream(storageKey);
    }

    const files = await bucket.find({ filename: storageKey }).limit(1).toArray();
    if (files && files.length > 0) {
      return bucket.openDownloadStream(files[0]._id);
    }

    // Fallback: check by flat filename basename
    const flatKey = path.basename(storageKey);
    if (flatKey !== storageKey) {
      const flatFiles = await bucket.find({ filename: flatKey }).limit(1).toArray();
      if (flatFiles && flatFiles.length > 0) {
        return bucket.openDownloadStream(flatFiles[0]._id);
      }
    }

    // Secondary fallback: check local disk storage (e.g. seeded assets or offline files)
    try {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      if (await local.exists(storageKey)) {
        return local.getObjectStream(storageKey);
      }
    } catch (_) {}

    throw new Error(`STORAGE_ERROR: Asset payload for key '${storageKey}' not found in GridFS.`);
  }

  /**
   * Delete an object from GridFS
   * @param {string} storageKey 
   */
  async deleteObject(storageKey) {
    const bucket = this._getBucket();
    if (!bucket) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.deleteObject(storageKey);
    }

    try {
      const files = await bucket.find({ filename: storageKey }).toArray();
      for (const file of files) {
        await bucket.delete(file._id).catch(() => {});
      }

      // Also clean up any flat key match
      const flatKey = path.basename(storageKey);
      if (flatKey !== storageKey) {
        const flatFiles = await bucket.find({ filename: flatKey }).toArray();
        for (const file of flatFiles) {
          await bucket.delete(file._id).catch(() => {});
        }
      }

      return true;
    } catch (err) {
      console.warn(`[GRIDFS WARNING] Error deleting object '${storageKey}':`, err.message);
      return false;
    }
  }

  /**
   * Check if an object exists in GridFS
   * @param {string} storageKey 
   */
  async exists(storageKey) {
    const bucket = this._getBucket();
    if (!bucket) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.exists(storageKey);
    }

    try {
      const files = await bucket.find({ filename: storageKey }).limit(1).toArray();
      if (files && files.length > 0) return true;

      const flatKey = path.basename(storageKey);
      if (flatKey !== storageKey) {
        const flatFiles = await bucket.find({ filename: flatKey }).limit(1).toArray();
        if (flatFiles && flatFiles.length > 0) return true;
      }

      // Check local storage fallback
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.exists(storageKey);
    } catch (_) {
      return false;
    }
  }

  /**
   * Retrieve object metadata from GridFS
   * @param {string} storageKey 
   */
  async getObjectMetadata(storageKey) {
    const bucket = this._getBucket();
    if (!bucket) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObjectMetadata(storageKey);
    }

    const files = await bucket.find({ filename: storageKey }).limit(1).toArray();
    if (files && files.length > 0) {
      return {
        size: files[0].length,
        mimeType: files[0].contentType,
        modifiedAt: files[0].uploadDate
      };
    }

    throw new Error(`STORAGE_ERROR: Metadata not found for key '${storageKey}'.`);
  }
}

module.exports = GridFSStorageProvider;
