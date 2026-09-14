/**
 * XPLOITX // CYBER BATTLEFIELD
 * Object Storage Provider (backend/storage/objectStorageProvider.js)
 * Implements Section 4, 25, 26 of Architectural Specification:
 * - S3 / MinIO / Cloud Object Storage provider
 * - Production cloud deployment ready
 */

const { BaseStorageProvider } = require('./storageProvider');

class ObjectStorageProvider extends BaseStorageProvider {
  constructor() {
    super();
    this.bucket = process.env.STORAGE_BUCKET || 'xploitx-challenges';
    this.endpoint = process.env.STORAGE_ENDPOINT;
    this.region = process.env.STORAGE_REGION || 'us-east-1';
    this.accessKeyId = process.env.STORAGE_ACCESS_KEY;
    this.secretAccessKey = process.env.STORAGE_SECRET_KEY;
    this.client = null;

    this._initClient();
  }

  _initClient() {
    try {
      // Optional dynamically loaded AWS SDK v3 if installed
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey
        },
        forcePathStyle: !!this.endpoint
      });
    } catch (err) {
      console.warn('[OBJECT STORAGE] @aws-sdk/client-s3 not loaded; using local fallback for development.');
    }
  }

  async putObject(storageKey, buffer, mimeType = 'application/octet-stream') {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.putObject(storageKey, buffer, mimeType);
    }

    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType
    });

    await this.client.send(command);
    return {
      storageKey,
      size: buffer.length,
      mimeType
    };
  }

  async getObject(storageKey) {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObject(storageKey);
    }

    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey
    });

    const response = await this.client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return {
      buffer,
      size: buffer.length,
      mimeType: response.ContentType
    };
  }

  async getObjectStream(storageKey) {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObjectStream(storageKey);
    }

    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey
    });

    const response = await this.client.send(command);
    return response.Body;
  }

  async deleteObject(storageKey) {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.deleteObject(storageKey);
    }

    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey
    });

    await this.client.send(command);
    return true;
  }

  async exists(storageKey) {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.exists(storageKey);
    }

    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return true;
    } catch (e) {
      return false;
    }
  }

  async getObjectMetadata(storageKey) {
    if (!this.client) {
      const LocalStorageProvider = require('./localStorageProvider');
      const local = new LocalStorageProvider();
      return local.getObjectMetadata(storageKey);
    }

    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    return {
      size: res.ContentLength,
      mimeType: res.ContentType,
      modifiedAt: res.LastModified
    };
  }
}

module.exports = ObjectStorageProvider;
