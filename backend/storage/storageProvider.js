/**
 * XPLOITX // CYBER BATTLEFIELD
 * Storage Provider Abstraction Interface (backend/storage/storageProvider.js)
 * Implements Section 4, 24, 25 of Architectural Specification:
 * - Decoupled storage backend (Local persistent storage vs Cloud Object Storage)
 * - Zero dependency on Windows developer machine paths
 * - Abstract storage keys (e.g. challenges/<challengeId>/<fileId>/<filename>)
 */

class BaseStorageProvider {
  /**
   * Store an object buffer
   * @param {string} storageKey 
   * @param {Buffer} buffer 
   * @param {string} mimeType 
   * @returns {Promise<{ storageKey: string, size: number }>}
   */
  async putObject(storageKey, buffer, mimeType) {
    throw new Error('putObject must be implemented by concrete StorageProvider');
  }

  /**
   * Retrieve an object buffer
   * @param {string} storageKey 
   * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
   */
  async getObject(storageKey) {
    throw new Error('getObject must be implemented by concrete StorageProvider');
  }

  /**
   * Retrieve readable stream for an object
   * @param {string} storageKey 
   * @returns {Promise<import('stream').Readable>}
   */
  async getObjectStream(storageKey) {
    throw new Error('getObjectStream must be implemented by concrete StorageProvider');
  }

  /**
   * Delete an object
   * @param {string} storageKey 
   * @returns {Promise<boolean>}
   */
  async deleteObject(storageKey) {
    throw new Error('deleteObject must be implemented by concrete StorageProvider');
  }

  /**
   * Check if object exists
   * @param {string} storageKey 
   * @returns {Promise<boolean>}
   */
  async exists(storageKey) {
    throw new Error('exists must be implemented by concrete StorageProvider');
  }

  /**
   * Retrieve object metadata
   * @param {string} storageKey 
   * @returns {Promise<{ size: number, mimeType?: string, modifiedAt?: Date }>}
   */
  async getObjectMetadata(storageKey) {
    throw new Error('getObjectMetadata must be implemented by concrete StorageProvider');
  }
}

let activeProviderInstance = null;

function getStorageProvider() {
  if (activeProviderInstance) return activeProviderInstance;

  const providerType = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

  if (providerType === 'object' || providerType === 's3') {
    const ObjectStorageProvider = require('./objectStorageProvider');
    activeProviderInstance = new ObjectStorageProvider();
  } else {
    const LocalStorageProvider = require('./localStorageProvider');
    activeProviderInstance = new LocalStorageProvider();
  }

  return activeProviderInstance;
}

module.exports = {
  BaseStorageProvider,
  getStorageProvider
};
