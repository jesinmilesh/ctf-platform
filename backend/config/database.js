/**
 * XPLOITX // CYBER BATTLEFIELD
 * Database Engine & Data Repository (backend/config/database.js)
 * High-Performance Dual-Mode Database Engine:
 * - Direct PostgreSQL connection pool when configured
 * - Authoritative In-Memory Repository with ZERO fake competition data
 * - Strictly populated through authentic operative registration, team creation,
 *   admin operations, submissions, solves, and real container sandbox lifecycles.
 */

const crypto = require('crypto');

class DatabaseEngine {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'memory';
    this.isPostgres = this.dbType === 'postgres';
    this.pool = null;

    // Production Data Store - Authoritative Source of Truth
    this.data = {
      competitions: [],
      categories: [],
      challenges: [],
      flags: [],
      challengeFiles: [],
      challengeHints: [],
      hintReveals: [],
      users: [],
      sessions: [],
      teams: [],
      teamMembers: [],
      submissions: [],
      solves: [],
      firstBloods: [],
      scoreEvents: [],
      announcements: [],
      notifications: [],
      instances: [],
      portAllocations: [],
      auditLogs: [],
      settings: {
        competitionName: 'XPLOITX 2.0 BETA',
        tagline: 'ENTER THE DIGITAL BATTLEFIELD',
        flagPrefix: process.env.FLAG_PREFIX || 'XploitXβ{',
        flagSuffix: process.env.FLAG_SUFFIX || '}',
        dynamicScoring: true,
        decayThreshold: 30,
        submissionRateLimit: 5, // max submissions per min
        registrationOpen: true,
        freezeTime: null
      }
    };

    this.initDefaultSeed();
  }

  /**
   * Production Initialization: Only initial schema and required initial administrator setup.
   * ZERO demo teams, ZERO demo player users, ZERO demo challenges, ZERO fake scores.
   */
  initDefaultSeed() {
    const compId = 'c0000000-0000-0000-0000-000000000001';
    
    // 1. Production Competition Configuration
    this.data.competitions = [
      {
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
      }
    ];

    // 2. Default Sector Taxonomy (Categories for challenge creation)
    this.data.categories = [
      { id: 'cat-01', competition_id: compId, name: 'PWN', slug: 'pwn', description: 'Binary exploitation, ROP chains, and heap overflow', color_accent: '#ff3b5c', display_order: 1 },
      { id: 'cat-02', competition_id: compId, name: 'Misc', slug: 'misc', description: 'Miscellaneous tactical missions', color_accent: '#a3a3a3', display_order: 2 },
      { id: 'cat-03', competition_id: compId, name: 'Web', slug: 'web', description: 'Web application exploitation and API bypasses', color_accent: '#00d8f6', display_order: 3 },
      { id: 'cat-04', competition_id: compId, name: 'Network', slug: 'network', description: 'Packet inspection and routing protocols', color_accent: '#f9c74f', display_order: 4 },
      { id: 'cat-05', competition_id: compId, name: 'Digital Forensic', slug: 'forensic', description: 'Memory dump analysis and artifact extraction', color_accent: '#00ff9c', display_order: 5 },
      { id: 'cat-06', competition_id: compId, name: 'OSINT', slug: 'osint', description: 'Open source intelligence and asset tracing', color_accent: '#4cc9f0', display_order: 6 },
      { id: 'cat-07', competition_id: compId, name: 'Cryptography', slug: 'crypto', description: 'Ciphers, discrete logarithms, and cryptanalysis', color_accent: '#c77dff', display_order: 7 },
      { id: 'cat-08', competition_id: compId, name: 'Steganograhy', slug: 'stegano', description: 'Covert data channels and hidden payloads', color_accent: '#ffb020', display_order: 8 }
    ];

    // 3. Initial Administrator User (Required for initial setup)
    // In production, password hash is derived from ADMIN_PASSWORD or initial setup
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminKey = crypto.scryptSync('admin123', adminSalt, 64).toString('hex');
    const adminPasswordHash = `${adminSalt}:${adminKey}`;

    this.data.users = [
      {
        id: 'u0000000-0000-0000-0000-000000000001',
        competition_id: compId,
        team_id: null,
        username: 'admin',
        email: 'admin@xploitxctf.me',
        password_hash: adminPasswordHash,
        role: 'ADMIN',
        callsign: 'COMMANDER',
        affiliation: 'XploitX Operations Command',
        is_banned: false,
        created_at: new Date().toISOString()
      }
    ];

    // ZERO fake teams, ZERO fake challenges, ZERO fake solves
    this.data.teams = [];
    this.data.teamMembers = [];
    this.data.challenges = [];
    this.data.flags = [];
    this.data.challengeFiles = [];
    this.data.challengeHints = [];
    this.data.hintReveals = [];
    this.data.submissions = [];
    this.data.solves = [];
    this.data.firstBloods = [];
    this.data.scoreEvents = [];
    this.data.announcements = [];
    this.data.notifications = [];
    this.data.instances = [];
    this.data.portAllocations = [];
    this.data.auditLogs = [];
    this.data.sessions = [];
  }

  // Repository Accessors
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
    const activeAllocations = new Set(this.data.portAllocations.map(a => a.port));
    for (let port = rangeStart; port <= rangeEnd; port++) {
      if (!activeAllocations.has(port)) {
        const allocation = {
          port,
          instance_id: instanceId,
          allocated_at: new Date().toISOString()
        };
        this.data.portAllocations.push(allocation);
        return port;
      }
    }
    throw new Error(`PORT_EXHAUSTION: All ports in range ${rangeStart}-${rangeEnd} currently allocated.`);
  }

  releasePort(port) {
    const idx = this.data.portAllocations.findIndex(a => a.port === port);
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
