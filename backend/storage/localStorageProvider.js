/**
 * XPLOITX // CYBER BATTLEFIELD
 * Local Storage Provider (backend/storage/localStorageProvider.js)
 * Implements Section 4, 22, 24, 25 of Architectural Specification:
 * - Persistent local directory outside web root
 * - Path traversal prevention & filename sanitization
 * - Safe file streaming & deletion
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BaseStorageProvider } = require('./storageProvider');

class LocalStorageProvider extends BaseStorageProvider {
  constructor(customRoot) {
    super();
    const envRoot = process.env.STORAGE_LOCAL_ROOT;
    let targetDir = path.resolve(customRoot || envRoot || path.join(__dirname, '..', '..', 'challenge-storage'));

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (e) {
      // In serverless / read-only filesystem environments (e.g. Vercel, AWS Lambda),
      // fallback to the OS temporary directory
      targetDir = path.join(os.tmpdir(), 'xploitx-challenge-storage');
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      } catch (_) {}
    }
    this.rootDir = targetDir;
  }

  /**
   * Resolve storage key to an absolute filesystem path within rootDir
   * Prevents path traversal vulnerabilities
   */
  _resolvePath(storageKey) {
    if (!storageKey) throw new Error('STORAGE_ERROR: Missing storageKey.');

    // Normalize slashes
    const normalizedKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');

    // Resolve against root directory
    const resolvedPath = path.resolve(this.rootDir, normalizedKey);

    // Enforce that path cannot escape rootDir (Path Traversal Protection - Section 22)
    const relative = path.relative(this.rootDir, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`SECURITY_VIOLATION: Path traversal detected for key '${storageKey}'.`);
    }

    return resolvedPath;
  }

  async putObject(storageKey, buffer, mimeType = 'application/octet-stream') {
    const fullPath = this._resolvePath(storageKey);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, buffer);

    return {
      storageKey,
      size: buffer.length,
      mimeType
    };
  }

  async getObject(storageKey) {
    const fullPath = this._resolvePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`STORAGE_ERROR: Object not found for key: ${storageKey}`);
    }

    const buffer = await fs.promises.readFile(fullPath);
    return {
      buffer,
      size: buffer.length
    };
  }

  async getObjectStream(storageKey) {
    let fullPath = this._resolvePath(storageKey);

    // Fallback: check if stored as flat file in rootDir if nested path not found
    if (!fs.existsSync(fullPath)) {
      const flatKey = path.basename(storageKey);
      const flatPath = path.join(this.rootDir, flatKey);
      if (fs.existsSync(flatPath)) {
        fullPath = flatPath;
      } else {
        throw new Error(`STORAGE_ERROR: File payload for key '${storageKey}' not found in storage.`);
      }
    }

    return fs.createReadStream(fullPath);
  }

  async deleteObject(storageKey) {
    try {
      const fullPath = this._resolvePath(storageKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      // Check legacy flat key
      const flatKey = path.basename(storageKey);
      const flatPath = path.join(this.rootDir, flatKey);
      if (fs.existsSync(flatPath)) {
        await fs.promises.unlink(flatPath);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[LOCAL STORAGE] Error deleting object '${storageKey}':`, err.message);
      return false;
    }
  }

  async exists(storageKey) {
    try {
      const fullPath = this._resolvePath(storageKey);
      if (fs.existsSync(fullPath)) return true;

      const flatKey = path.basename(storageKey);
      return fs.existsSync(path.join(this.rootDir, flatKey));
    } catch (e) {
      return false;
    }
  }

  async getObjectMetadata(storageKey) {
    const fullPath = this._resolvePath(storageKey);
    const stats = await fs.promises.stat(fullPath);
    return {
      size: stats.size,
      modifiedAt: stats.mtime
    };
  }
}

module.exports = LocalStorageProvider;
