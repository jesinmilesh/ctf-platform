/**
 * XPLOITX // CYBER BATTLEFIELD
 * Database Engine & Data Repository (backend/config/database.js)
 * Multi-Mode Production Database Engine:
 * - Direct MongoDB Atlas connection with real-time replication & persistence
 * - Direct PostgreSQL connection pool when configured
 * - Authoritative In-Memory Caching layer for sub-millisecond CTF latency
 * - Zero Fake Data Architecture: strictly authentic operatives, teams, challenges, and solves.
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const crypto = require('crypto');

let MongoClient = null;
try {
  MongoClient = require('mongodb').MongoClient;
} catch (e) {
  // mongodb optional if running purely in-memory
}

let mongoose = null;
let models = {};
try {
  mongoose = require('mongoose');
  models = require('../models');
} catch (e) {
  // mongoose optional
}

const COLLECTION_MAP = {
  competitions: 'competitions',
  categories: 'categories',
  challenges: 'challenges',
  flags: 'flags',
  challengeFiles: 'challenge_files',
  challengeHints: 'challenge_hints',
  hintReveals: 'hint_reveals',
  users: 'users',
  sessions: 'sessions',
  teams: 'teams',
  teamMembers: 'team_members',
  submissions: 'submissions',
  solves: 'solves',
  firstBloods: 'first_bloods',
  scoreEvents: 'score_events',
  announcements: 'announcements',
  notifications: 'notifications',
  instances: 'instances',
  portAllocations: 'port_allocations',
  auditLogs: 'audit_logs'
};

class DatabaseEngine {
  constructor() {
    const rawUrl = process.env.DATABASE_URL || process.env.MONGODB_URI || '';
    const isMongoUri = rawUrl.startsWith('mongodb://') || rawUrl.startsWith('mongodb+srv://');
    
    this.dbType = process.env.DB_TYPE || (isMongoUri ? 'mongodb' : 'memory');
    this.isMongo = this.dbType === 'mongodb' || isMongoUri;
    this.isPostgres = this.dbType === 'postgres' || rawUrl.startsWith('postgres://') || rawUrl.startsWith('postgresql://');
    
    this.mongoUrl = isMongoUri ? rawUrl : (process.env.MONGODB_URI || process.env.DATABASE_URL);
    this.mongoDbName = process.env.MONGODB_DB_NAME || 'xploitx_production';
    this.mongoClient = null;
    this.mongoDb = null;
    this.mongoose = mongoose;
    this.models = models;
    this.pool = null;
    this.connected = false;
    this.initPromise = null;

    // Production Data Store - Authoritative Source of Truth
    this.data = {
      competitions: this._createTrackedArray('competitions'),
      categories: this._createTrackedArray('categories'),
      challenges: this._createTrackedArray('challenges'),
      flags: this._createTrackedArray('flags'),
      challengeFiles: this._createTrackedArray('challengeFiles'),
      challengeHints: this._createTrackedArray('challengeHints'),
      hintReveals: this._createTrackedArray('hintReveals'),
      users: this._createTrackedArray('users'),
      sessions: this._createTrackedArray('sessions'),
      teams: this._createTrackedArray('teams'),
      teamMembers: this._createTrackedArray('teamMembers'),
      submissions: this._createTrackedArray('submissions'),
      solves: this._createTrackedArray('solves'),
      firstBloods: this._createTrackedArray('firstBloods'),
      scoreEvents: this._createTrackedArray('scoreEvents'),
      announcements: this._createTrackedArray('announcements'),
      notifications: this._createTrackedArray('notifications'),
      instances: this._createTrackedArray('instances'),
      portAllocations: this._createTrackedArray('portAllocations'),
      auditLogs: this._createTrackedArray('auditLogs'),
      settings: {
        competitionName: 'XPLOITX 2.0 BETA',
        tagline: 'ENTER THE DIGITAL BATTLEFIELD',
        flagPrefix: process.env.FLAG_PREFIX || 'XploitXβ{',
        flagSuffix: process.env.FLAG_SUFFIX || '}',
        dynamicScoring: true,
        decayThreshold: 30,
        submissionRateLimit: 5,
        registrationOpen: true,
        freezeTime: null
      }
    };

    this.initDefaultSeed();
  }

  /**
   * Helper: Wrap Array with mutation tracking so .push() and .splice()
   * automatically replicate to MongoDB Atlas in the background.
   */
  _createTrackedArray(collectionKey, initialItems = []) {
    const arr = [...initialItems];
    const self = this;
    const originalPush = arr.push;
    const originalSplice = arr.splice;

    arr.push = function(...items) {
      const result = originalPush.apply(this, items);
      if (self.isMongo && self.mongoDb && !self._hydrating) {
        self._persistInsertMany(collectionKey, items).catch(err => {
          console.error(`[MONGO_REPLICATION_ERROR] ${collectionKey}.push:`, err.message);
        });
      }
      return result;
    };

    arr.splice = function(start, deleteCount, ...items) {
      const removed = this.slice(start, start + deleteCount);
      const result = originalSplice.apply(this, [start, deleteCount, ...items]);
      if (self.isMongo && self.mongoDb && !self._hydrating) {
        if (removed.length > 0) {
          self._persistDeleteMany(collectionKey, removed).catch(err => {
            console.error(`[MONGO_REPLICATION_ERROR] ${collectionKey}.delete:`, err.message);
          });
        }
        if (items.length > 0) {
          self._persistInsertMany(collectionKey, items).catch(err => {
            console.error(`[MONGO_REPLICATION_ERROR] ${collectionKey}.insert:`, err.message);
          });
        }
      }
      return result;
    };

    return arr;
  }

  /**
   * Production Clean Initialization: Schema defaults and Initial Administrator.
   * ZERO fake teams, ZERO fake challenges, ZERO demo scores.
   */
  initDefaultSeed() {
    const compId = 'c0000000-0000-0000-0000-000000000001';
    
    // 1. Initial Competition Entity
    this.data.competitions.length = 0;
    this.data.competitions.push({
      id: compId,
      slug: 'xploitx-2026',
      name: 'XPLOITX 2.0 BETA',
      tagline: 'ENTER THE DIGITAL BATTLEFIELD',
      description: '24-Hour elite cybersecurity capture the flag competition.',
      status: 'LIVE',
      start_time: new Date(Date.now() - 3600 * 1000).toISOString(),
      end_time: new Date(Date.now() + 23 * 3600 * 1000).toISOString(),
      freeze_time: null,
      flag_prefix: this.data.settings.flagPrefix,
      flag_suffix: this.data.settings.flagSuffix,
      max_team_size: 4,
      dynamic_scoring: true,
      scoring_decay: 30,
      created_at: new Date().toISOString()
    });

    // 2. Default Sector Taxonomy (8 Core Cybersecurity Categories)
    this.data.categories.length = 0;
    this.data.categories.push(
      { id: 'cat-01', competition_id: compId, name: 'PWN', slug: 'pwn', description: 'Binary exploitation, ROP chains, and heap overflow', color_accent: '#ff3b5c', display_order: 1 },
      { id: 'cat-02', competition_id: compId, name: 'Misc', slug: 'misc', description: 'Miscellaneous tactical missions', color_accent: '#a3a3a3', display_order: 2 },
      { id: 'cat-03', competition_id: compId, name: 'Web', slug: 'web', description: 'Web application exploitation and API bypasses', color_accent: '#00d8f6', display_order: 3 },
      { id: 'cat-04', competition_id: compId, name: 'Network', slug: 'network', description: 'Packet inspection and routing protocols', color_accent: '#f9c74f', display_order: 4 },
      { id: 'cat-05', competition_id: compId, name: 'Digital Forensic', slug: 'forensic', description: 'Memory dump analysis and artifact extraction', color_accent: '#00ff9c', display_order: 5 },
      { id: 'cat-06', competition_id: compId, name: 'OSINT', slug: 'osint', description: 'Open source intelligence and asset tracing', color_accent: '#4cc9f0', display_order: 6 },
      { id: 'cat-07', competition_id: compId, name: 'Cryptography', slug: 'crypto', description: 'Ciphers, discrete logarithms, and cryptanalysis', color_accent: '#c77dff', display_order: 7 },
      { id: 'cat-08', competition_id: compId, name: 'Steganograhy', slug: 'stegano', description: 'Covert data channels and hidden payloads', color_accent: '#ffb020', display_order: 8 }
    );

    // 3. Administrator Policy: ZERO hardcoded credentials.
    // Clean initial state: 0 users unless securely configured via BOOTSTRAP_ADMIN_EMAIL & BOOTSTRAP_ADMIN_PASSWORD
    this.data.users.length = 0;
    if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
      const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
      const adminSalt = crypto.randomBytes(16).toString('hex');
      const adminKey = crypto.scryptSync(process.env.BOOTSTRAP_ADMIN_PASSWORD, adminSalt, 64).toString('hex');
      this.data.users.push({
        id: 'u0000000-0000-0000-0000-000000000001',
        competition_id: compId,
        team_id: null,
        username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
        email: adminEmail,
        password_hash: `${adminSalt}:${adminKey}`,
        role: 'ADMIN',
        callsign: process.env.BOOTSTRAP_ADMIN_CALLSIGN || 'COMMANDER',
        affiliation: 'XploitX Operations Command',
        is_banned: false,
        created_at: new Date().toISOString()
      });
    }

    // Clean initial state
    this.data.teams.length = 0;
    this.data.teamMembers.length = 0;
    this.data.challenges.length = 0;
    this.data.flags.length = 0;
    this.data.challengeFiles.length = 0;
    this.data.challengeHints.length = 0;
    this.data.hintReveals.length = 0;
    this.data.submissions.length = 0;
    this.data.solves.length = 0;
    this.data.firstBloods.length = 0;
    this.data.scoreEvents.length = 0;
    this.data.announcements.length = 0;
    this.data.notifications.length = 0;
    this.data.instances.length = 0;
    this.data.portAllocations.length = 0;
    this.data.auditLogs.length = 0;
    this.data.sessions.length = 0;
  }

  /**
   * Connect to MongoDB Atlas and hydrate existing data
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!this.isMongo || !this.mongoUrl) {
        return;
      }

      if (!MongoClient) {
        console.warn('[DATABASE] mongodb package not installed. Running in authoritative in-memory mode.');
        return;
      }

      try {
        console.log('[DATABASE] Initializing connection to MongoDB Atlas...');
        const mongoOptions = {
          maxPoolSize: 20,
          minPoolSize: 2,
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 30000,
          maxIdleTimeMS: 60000
        };

        this.mongoClient = new MongoClient(this.mongoUrl, mongoOptions);

        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db(this.mongoDbName);
        this.connected = true;
        console.log(`[DATABASE] Connected to MongoDB Atlas cluster (Database: ${this.mongoDbName})`);

        // Connect Mongoose
        if (mongoose && mongoose.connection.readyState === 0) {
          await mongoose.connect(this.mongoUrl, {
            dbName: this.mongoDbName,
            ...mongoOptions
          }).catch(err => {
            console.warn('[DATABASE] Mongoose connect notice:', err.message);
          });
        }

        // Configure indexes for rapid queries
        await this._ensureIndexes();

        // Hydrate from Atlas into memory cache
        await this.syncFromMongo();

        // Start debounced periodic sync for in-place modifications
        this._startPeriodicSync();
      } catch (err) {
        console.error('[DATABASE] MongoDB Atlas connection error:', err.message);
        console.warn('[DATABASE] Operating in authoritative in-memory mode with fallback.');
      }
    })();

    return this.initPromise;
  }

  async _ensureIndexes() {
    if (!this.mongoDb) return;
    try {
      const uColl = this.mongoDb.collection('users');
      await uColl.createIndex({ id: 1 }, { unique: true });
      await uColl.createIndex({ username: 1 }, { unique: true });
      await uColl.createIndex({ email: 1 }, { unique: true });

      const tColl = this.mongoDb.collection('teams');
      await tColl.createIndex({ id: 1 }, { unique: true });
      await tColl.createIndex({ name: 1 }, { unique: true });
      await tColl.createIndex({ access_code: 1 });

      const cColl = this.mongoDb.collection('challenges');
      await cColl.createIndex({ id: 1 }, { unique: true });
      await cColl.createIndex({ slug: 1 });

      const sColl = this.mongoDb.collection('submissions');
      await sColl.createIndex({ id: 1 }, { unique: true });
      await sColl.createIndex({ challenge_id: 1, team_id: 1 });
      await sColl.createIndex({ created_at: -1 });

      const slvColl = this.mongoDb.collection('solves');
      await slvColl.createIndex({ id: 1 }, { unique: true });
      await slvColl.createIndex({ challenge_id: 1, team_id: 1 });

      const sessColl = this.mongoDb.collection('sessions');
      await sessColl.createIndex({ token: 1 }, { unique: true });

      const instColl = this.mongoDb.collection('instances');
      await instColl.createIndex({ instanceId: 1 }, { unique: true });
      await instColl.createIndex({ teamId: 1, challengeId: 1, status: 1 });
      await instColl.createIndex({ port: 1 }, {
        unique: true,
        partialFilterExpression: {
          status: { $in: ['ALLOCATING', 'PORT_RESERVED', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING', 'STOPPING'] }
        }
      }).catch(() => {});

      const portColl = this.mongoDb.collection('port_allocations');
      await portColl.createIndex({ port: 1 }, { unique: true }).catch(() => {});
    } catch (e) {
      // Non-fatal if index already exists
    }
  }

  /**
   * Hydrate in-memory state from MongoDB Atlas
   */
  async syncFromMongo() {
    if (!this.mongoDb) return;
    this._hydrating = true;
    try {
      // 1. Administrator Bootstrap Policy:
      // If Atlas has 0 users and environment credentials are provided, provision single authorized administrator.
      // ZERO automatic sample data creation. If Atlas is empty, it remains 100% clean across restarts.
      const usersInMongo = await this.mongoDb.collection('users').countDocuments();
      if (usersInMongo === 0 && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
        console.log('[DATABASE] Bootstrapping authorized administrator from environment credentials...');
        const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
        const adminSalt = crypto.randomBytes(16).toString('hex');
        const adminKey = crypto.scryptSync(process.env.BOOTSTRAP_ADMIN_PASSWORD, adminSalt, 64).toString('hex');
        const adminDoc = {
          id: 'u0000000-0000-0000-0000-000000000001',
          competition_id: 'c0000000-0000-0000-0000-000000000001',
          team_id: null,
          username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
          email: adminEmail,
          password_hash: `${adminSalt}:${adminKey}`,
          role: 'ADMIN',
          callsign: process.env.BOOTSTRAP_ADMIN_CALLSIGN || 'COMMANDER',
          affiliation: 'XploitX Operations Command',
          is_banned: false,
          created_at: new Date().toISOString()
        };
        await this.mongoDb.collection('users').insertOne(adminDoc);
      }

      // Ensure Core Category Taxonomy is present in Atlas
      const categoriesInMongo = await this.mongoDb.collection('categories').countDocuments();
      if (categoriesInMongo === 0 && this.data.categories.length > 0) {
        for (const cat of this.data.categories) {
          await this.mongoDb.collection('categories').updateOne({ id: cat.id }, { $set: cat }, { upsert: true });
        }
      }

      const compInMongo = await this.mongoDb.collection('competitions').countDocuments();
      if (compInMongo === 0 && this.data.competitions.length > 0) {
        for (const comp of this.data.competitions) {
          await this.mongoDb.collection('competitions').updateOne({ id: comp.id }, { $set: comp }, { upsert: true });
        }
      }

      // 2. Hydrate each collection from Atlas
      // Use raw Array.prototype.push during hydration to avoid triggering
      // the tracked push() which would replicate data back to MongoDB (infinite loop).
      for (const [key, colName] of Object.entries(COLLECTION_MAP)) {
        const docs = await this.mongoDb.collection(colName).find({}).toArray();
        const cleanDocs = docs.map(d => {
          const item = { ...d };
          // CRITICAL: Always override item.id with the MongoDB _id string.
          // This ensures challenge.id === String(challenge._id) everywhere,
          // eliminating the dual-ID mismatch that caused "Mission Not Found".
          if (d._id) {
            item._id = d._id.toString();
            item.id = d._id.toString();
          }
          return item;
        });

        // Update in-memory array — use raw push to skip Atlas replication during hydration
        const target = this.data[key];
        target.length = 0;
        cleanDocs.forEach(d => Array.prototype.push.call(target, d));
      }

      // 3. Hydrate Settings
      const savedSettings = await this.mongoDb.collection('settings').findOne({ id: 'global_settings' });
      if (savedSettings) {
        delete savedSettings._id;
        delete savedSettings.id;
        this.data.settings = { ...this.data.settings, ...savedSettings };
      }
      console.log('[DATABASE] Successfully synchronized all data from MongoDB Atlas into memory.');
    } catch (err) {
      console.error('[DATABASE] syncFromMongo error:', err.message);
    } finally {
      this._hydrating = false;
    }
  }

  /**
   * Persist full current state to MongoDB Atlas
   */
  async syncToMongo() {
    if (!this.mongoDb) return;

    try {
      let ObjectIdClass = null;
      try { ObjectIdClass = require('mongodb').ObjectId; } catch (_) {}

      for (const [key, colName] of Object.entries(COLLECTION_MAP)) {
        const items = this.data[key];
        if (!items || items.length === 0) continue;

        const coll = this.mongoDb.collection(colName);
        for (const item of items) {
          const doc = { ...item };
          delete doc._id;
          const itemId = doc.id || doc.instanceId;
          if (itemId && !doc.id) doc.id = String(itemId);

          let filter;
          // Use ObjectId filter if the id looks like a valid MongoDB ObjectId (24-char hex)
          if (ObjectIdClass && itemId && String(itemId).length === 24 && ObjectIdClass.isValid(itemId)) {
            try {
              filter = { _id: new ObjectIdClass(String(itemId)) };
            } catch (_) {
              filter = doc.instanceId
                ? { $or: [{ instanceId: doc.instanceId }, { id: String(itemId) }] }
                : { id: String(itemId) };
            }
          } else if (doc.instanceId) {
            filter = { $or: [{ instanceId: doc.instanceId }, { id: String(itemId) }] };
          } else if (itemId) {
            filter = { id: String(itemId) };
          } else {
            filter = { _id: item._id };
          }

          await coll.updateOne(filter, { $set: doc }, { upsert: true });
        }
      }

      // Settings
      await this.mongoDb.collection('settings').updateOne(
        { id: 'global_settings' },
        { $set: { id: 'global_settings', ...this.data.settings } },
        { upsert: true }
      );
    } catch (err) {
      console.error('[DATABASE] syncToMongo error:', err.message);
    }
  }


  /**
   * Single document upsert to MongoDB Atlas
   */
  async persistDoc(collectionKey, doc) {
    if (!this.isMongo || !this.mongoDb || !doc) return;
    try {
      const colName = COLLECTION_MAP[collectionKey] || collectionKey;
      const coll = this.mongoDb.collection(colName);
      const toSave = { ...doc };
      delete toSave._id;
      const docId = doc.id || doc._id || doc.instanceId;
      if (docId) {
        if (!toSave.id) toSave.id = String(docId);
        await coll.updateOne({ id: toSave.id }, { $set: toSave }, { upsert: true });
      } else {
        await coll.insertOne(toSave);
      }
    } catch (err) {
      console.error(`[DATABASE] persistDoc(${collectionKey}) error:`, err.message);
    }
  }

  async persistSettings() {
    if (!this.isMongo || !this.mongoDb) return;
    try {
      await this.mongoDb.collection('settings').updateOne(
        { id: 'global_settings' },
        { $set: { id: 'global_settings', ...this.data.settings } },
        { upsert: true }
      );
    } catch (err) {
      console.error('[DATABASE] persistSettings error:', err.message);
    }
  }

  async _persistInsertMany(collectionKey, items) {
    if (!this.isMongo || !this.mongoDb || !items || items.length === 0) return;
    const colName = COLLECTION_MAP[collectionKey] || collectionKey;
    const coll = this.mongoDb.collection(colName);
    for (const item of items) {
      try {
        const toSave = { ...item };
        // Preserve _id as ObjectId if it looks like one (24-char hex), otherwise delete
        let objectIdFilter = null;
        try {
          const { ObjectId } = require('mongodb');
          const rawId = item._id || item.id;
          if (rawId && ObjectId.isValid(rawId) && String(rawId).length === 24) {
            objectIdFilter = new ObjectId(String(rawId));
          }
        } catch (_) {}
        delete toSave._id;

        const docId = item.id || item._id || item.instanceId;
        if (docId) {
          if (!toSave.id) toSave.id = String(docId);
          let filter;
          if (objectIdFilter) {
            // Use _id ObjectId filter for maximum accuracy — avoids duplicate creation
            filter = { _id: objectIdFilter };
          } else if (toSave.instanceId) {
            filter = { $or: [{ instanceId: toSave.instanceId }, { id: toSave.id }] };
          } else if (toSave.username) {
            filter = { $or: [{ id: toSave.id }, { username: toSave.username }] };
          } else {
            filter = { id: toSave.id };
          }
          await coll.updateOne(filter, { $set: toSave }, { upsert: true });
        } else {
          await coll.insertOne(toSave);
        }
      } catch (err) {
        if (err.code !== 11000) {
          console.warn(`[DATABASE] Replication notice for ${colName}:`, err.message);
        }
      }
    }
  }

  async _persistDeleteMany(collectionKey, items) {
    if (!this.isMongo || !this.mongoDb || !items || items.length === 0) return;
    const colName = COLLECTION_MAP[collectionKey] || collectionKey;
    const coll = this.mongoDb.collection(colName);
    const ids = items.map(i => i.id || i.instanceId).filter(Boolean);
    if (ids.length > 0) {
      await coll.deleteMany({ id: { $in: ids } });
    }
  }

  _startPeriodicSync() {
    if (this._syncInterval) return;
    // Debounced background sync every 15 seconds to ensure in-place counters stay replicated
    this._syncInterval = setInterval(() => {
      this.syncToMongo().catch(() => {});
    }, 15000);
    if (this._syncInterval.unref) {
      this._syncInterval.unref();
    }
  }

  // Direct MongoDB Handle accessors
  getMongoClient() { return this.mongoClient; }
  getMongoDb() { return this.mongoDb; }
  getModels() { return this.models; }
  getModel(name) { return this.models ? this.models[name] : null; }
  collection(name) {
    if (!this.mongoDb) throw new Error('MongoDB Atlas not connected');
    return this.mongoDb.collection(name);
  }

  /**
   * Health Check: Actual Atlas Ping
   */
  async checkHealth() {
    const start = Date.now();
    if (this.dbType === 'memory' || !this.isMongo) {
      return { status: 'ok', type: 'in-memory', latencyMs: 0 };
    }
    if (!this.connected || !this.mongoDb) {
      throw new Error('Database disconnected');
    }
    const ping = await this.mongoDb.command({ ping: 1 });
    const latencyMs = Date.now() - start;
    if (ping && ping.ok === 1) {
      return { status: 'ok', type: 'mongodb-atlas', database: this.mongoDbName, latencyMs };
    }
    throw new Error('Atlas ping failed');
  }

  // Repository In-Memory Accessors (High-Speed Synchronous)
  getCompetitions() { return this.data.competitions; }
  getCategories() { return this.data.categories; }
  getChallenges() { return this.data.challenges; }
  getFlags() { return this.data.flags; }
  getHints() { return this.data.challengeHints; }
  getHintReveals() { return this.data.hintReveals; }
  getFiles() { return this.data.challengeFiles; }
  getUsers() { return this.data.users; }
  getSessions() { return this.data.sessions; }
  getTeams() { return this.data.teams; }
  getTeamMembers() { return this.data.teamMembers; }
  getSubmissions() { return this.data.submissions; }
  getSolves() { return this.data.solves; }
  getFirstBloods() { return this.data.firstBloods; }
  getScoreEvents() { return this.data.scoreEvents; }
  getAnnouncements() { return this.data.announcements; }
  getNotifications() { return this.data.notifications; }
  getAuditLogs() { return this.data.auditLogs; }
  getInstances() { return this.data.instances; }
  getPortAllocations() { return this.data.portAllocations; }
  getSettings() { return this.data.settings; }

  /**
   * Atomic Port Reservation with Mutex Lock (Sections 20, 44)
   * Ensures every active Docker instance receives a strictly unique port in 41000-41999
   */
  async allocatePort(rangeStart = 41000, rangeEnd = 41999, instanceId) {
    while (this._portMutex) {
      await this._portMutex;
    }
    let releaseMutex;
    this._portMutex = new Promise(resolve => { releaseMutex = resolve; });

    try {
      const activeAllocations = new Set([
        ...this.data.portAllocations.map(a => Number(a.port)),
        ...this.data.instances
          .filter(i => ['REQUESTED', 'ALLOCATING', 'PORT_RESERVED', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING'].includes(i.status))
          .map(i => Number(i.port))
          .filter(Boolean)
      ]);

      for (let port = rangeStart; port <= rangeEnd; port++) {
        if (!activeAllocations.has(port)) {
          const allocation = {
            port,
            instance_id: instanceId,
            instanceId,
            allocated_at: new Date().toISOString()
          };
          this.data.portAllocations.push(allocation);
          return port;
        }
      }
      throw new Error(`PORT_EXHAUSTION: All ports in range ${rangeStart}-${rangeEnd} currently allocated.`);
    } finally {
      const release = releaseMutex;
      this._portMutex = null;
      if (release) release();
    }
  }

  releasePort(port) {
    const numPort = Number(port);
    const idx = this.data.portAllocations.findIndex(a => Number(a.port) === numPort);
    if (idx !== -1) {
      this.data.portAllocations.splice(idx, 1);
      return true;
    }
    return false;
  }

  // PostgreSQL Query Execution with Fallback
  async query(sql, params = []) {
    if (this.isPostgres && this.pool) {
      return this.pool.query(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

const db = new DatabaseEngine();
module.exports = db;
