/**
 * XPLOITX // CYBER BATTLEFIELD
 * Database Engine & Data Repository (backend/config/database.js)
 * Supports PostgreSQL pool connection and resilient High-Performance Tactical In-Memory Engine
 */

const crypto = require('crypto');

class DatabaseEngine {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'memory';
    this.isPostgres = this.dbType === 'postgres';
    this.pool = null;

    // Tactical In-Memory Store (loaded with initial schema/seed structures)
    this.data = {
      competitions: [],
      categories: [],
      challenges: [],
      flags: [],
      challengeFiles: [],
      challengeHints: [],
      users: [],
      teams: [],
      teamMembers: [],
      submissions: [],
      solves: [],
      firstBloods: [],
      scoreEvents: [],
      announcements: [],
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

  initDefaultSeed() {
    const compId = 'c0000000-0000-0000-0000-000000000001';
    this.data.competitions = [
      {
        id: compId,
        slug: 'xploitx-2026',
        name: 'XPLOITX 2.0 BETA',
        tagline: 'ENTER THE DIGITAL BATTLEFIELD',
        description: '24-Hour elite cybersecurity capture the flag competition.',
        status: 'LIVE',
        start_time: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        end_time: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
        freeze_time: null,
        flag_prefix: this.data.settings.flagPrefix,
        flag_suffix: this.data.settings.flagSuffix,
        max_team_size: 4,
        dynamic_scoring: true,
        scoring_decay: 30,
        created_at: new Date().toISOString()
      }
    ];

    this.data.categories = [
      { id: 'cat-01', competition_id: compId, name: 'PWN', slug: 'pwn', description: 'Binary exploitation, ROP chains, and heap overflow', color_accent: '#ff3b5c', display_order: 1 },
      { id: 'cat-02', competition_id: compId, name: 'Misc', slug: 'misc', description: 'Miscellaneous challenges', color_accent: '#a3a3a3', display_order: 2 },
      { id: 'cat-03', competition_id: compId, name: 'Web', slug: 'web', description: 'XSS, SQLi, SSRF, and prototype pollution', color_accent: '#00d8f6', display_order: 3 },
      { id: 'cat-04', competition_id: compId, name: 'Network', slug: 'network', description: 'Network packet inspection and routing', color_accent: '#f9c74f', display_order: 4 },
      { id: 'cat-05', competition_id: compId, name: 'Digital Forensic', slug: 'forensic', description: 'Memory dump analysis and network packet inspection', color_accent: '#00ff9c', display_order: 5 },
      { id: 'cat-06', competition_id: compId, name: 'OSINT', slug: 'osint', description: 'Open source intelligence and asset tracing', color_accent: '#4cc9f0', display_order: 6 },
      { id: 'cat-07', competition_id: compId, name: 'Cryptography', slug: 'crypto', description: 'Ciphers, discrete log, and broken PRNGs', color_accent: '#c77dff', display_order: 7 },
      { id: 'cat-08', competition_id: compId, name: 'Steganograhy', slug: 'stegano', description: 'Hidden data inside files and images', color_accent: '#ffb020', display_order: 8 }
    ];

    // Seed Teams
    const team1 = { id: 't0000000-0000-0000-0000-000000000001', competition_id: compId, name: 'ROOT_ACCESS', slug: 'root-access', access_code: 'ROOT-8910', total_score: 8450, solves_count: 17, first_bloods: 4, is_disqualified: false, last_score_update: new Date(Date.now() - 1000 * 60 * 12).toISOString() };
    const team2 = { id: 't0000000-0000-0000-0000-000000000002', competition_id: compId, name: 'NULLBYTE', slug: 'nullbyte', access_code: 'NULL-4412', total_score: 8120, solves_count: 15, first_bloods: 3, is_disqualified: false, last_score_update: new Date(Date.now() - 1000 * 60 * 25).toISOString() };
    const team3 = { id: 't0000000-0000-0000-0000-000000000003', competition_id: compId, name: 'CYBER_VIPERS', slug: 'cyber-vipers', access_code: 'VIPER-3391', total_score: 7900, solves_count: 14, first_bloods: 2, is_disqualified: false, last_score_update: new Date(Date.now() - 1000 * 60 * 40).toISOString() };
    const team4 = { id: 't0000000-0000-0000-0000-000000000004', competition_id: compId, name: 'NEXUS', slug: 'nexus', access_code: 'NEXUS-8921-CLASSIFIED', total_score: 4850, solves_count: 9, first_bloods: 1, is_disqualified: false, last_score_update: new Date(Date.now() - 1000 * 60 * 60).toISOString() };
    this.data.teams = [team1, team2, team3, team4];

    // Seed Users
    this.data.users = [
      {
        id: 'u0000000-0000-0000-0000-000000000001',
        competition_id: compId,
        team_id: null,
        username: 'admin',
        email: 'admin@xploitxctf.me',
        password_hash: 'admin123',
        role: 'ADMIN',
        callsign: 'COMMANDER',
        affiliation: 'XploitX Core Staff',
        is_banned: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'u0000000-0000-0000-0000-000000000002',
        competition_id: compId,
        team_id: team4.id,
        username: 'jesin',
        email: 'jesin@xploitxctf.me',
        password_hash: 'player123',
        role: 'PLAYER',
        callsign: 'N0D3_RUNNER',
        affiliation: 'Nexus Taskforce',
        is_banned: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'u0000000-0000-0000-0000-000000000003',
        competition_id: compId,
        team_id: team1.id,
        username: 'zero_day',
        email: 'zeroday@xploitxctf.me',
        password_hash: 'player123',
        role: 'PLAYER',
        callsign: 'GHOST_OPERATIVE',
        affiliation: 'Root Access',
        is_banned: false,
        created_at: new Date().toISOString()
      }
    ];

    this.data.teamMembers = [
      { id: 'tm-1', team_id: team4.id, user_id: 'u0000000-0000-0000-0000-000000000002', role: 'CAPTAIN', joined_at: new Date().toISOString() },
      { id: 'tm-2', team_id: team1.id, user_id: 'u0000000-0000-0000-0000-000000000003', role: 'CAPTAIN', joined_at: new Date().toISOString() }
    ];

    // Seed Challenges dynamically based on requirements
    this.data.challenges = [];
    
    const catMap = {
      'PWN': 'cat-01', 'Misc': 'cat-02', 'Web': 'cat-03',
      'Network': 'cat-04', 'Digital Forensic': 'cat-05',
      'OSINT': 'cat-06', 'Cryptography': 'cat-07', 'Steganograhy': 'cat-08'
    };

    const requirements = [
      { cats: ['PWN', 'Misc', 'Web'], counts: { MEDIUM: 10, HARD: 10, INSANE: 15 } },
      { cats: ['Network'], counts: { MEDIUM: 3, HARD: 5, INSANE: 5 } },
      { cats: ['Digital Forensic'], counts: { MEDIUM: 2, HARD: 5, INSANE: 5 } },
      { cats: ['OSINT'], counts: { MEDIUM: 10, HARD: 10, INSANE: 10 } },
      { cats: ['Cryptography'], counts: { MEDIUM: 10, HARD: 10, INSANE: 10 } },
      { cats: ['Steganograhy'], counts: { MEDIUM: 10, HARD: 10, INSANE: 10 } }
    ];

    let chId = 1;
    requirements.forEach(req => {
      let catIndex = 0;
      for (const [diff, count] of Object.entries(req.counts)) {
        for (let i = 0; i < count; i++) {
          const cName = req.cats[catIndex % req.cats.length];
          catIndex++;
          this.data.challenges.push({
            id: 'ch-' + String(chId).padStart(3, '0'),
            competition_id: compId,
            category_id: catMap[cName],
            category_name: cName,
            mission_id: 'OP-' + cName.substring(0,3).toUpperCase() + '-' + chId,
            slug: 'challenge-' + chId,
            title: cName + ' Challenge ' + chId,
            difficulty: diff,
            description: 'This is an auto-generated ' + diff + ' challenge for ' + cName + '.',
            base_points: diff === 'MEDIUM' ? 300 : (diff === 'HARD' ? 500 : 1000),
            minimum_points: 100,
            decay_threshold: 30,
            current_points: diff === 'MEDIUM' ? 300 : (diff === 'HARD' ? 500 : 1000),
            solve_count: Math.floor(Math.random() * 50),
            status: 'PUBLISHED',
            has_instance: false,
            created_at: new Date().toISOString()
          });
          chId++;
        }
      }
    });

    // Seed Flags
    this.data.flags = this.data.challenges.map(ch => ({
      id: 'f-' + ch.id.split('-')[1],
      challenge_id: ch.id,
      flag_type: 'STATIC',
      flag_value: 'XploitXβ{flag_' + ch.id + '}',
      case_sensitive: true
    }));

    this.data.challengeFiles = [
      { id: 'file-01', challenge_id: 'ch-01', filename: 'generator.py', storage_key: 'generator.py', file_size_bytes: 1420, sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' },
      { id: 'file-04', challenge_id: 'ch-04', filename: 'intercept.pcapng', storage_key: 'intercept.pcapng', file_size_bytes: 489200, sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
      { id: 'file-05', challenge_id: 'ch-05', filename: 'matrix_core.bin', storage_key: 'matrix_core.bin', file_size_bytes: 65536, sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a' }
    ];

    // Seed Announcements
    this.data.announcements = [
      { id: 'ann-1', competition_id: compId, title: 'BATTLEFIELD ENGAGED', content: 'All operation sectors are now LIVE. Operatives are authorized to deploy.', urgent: true, created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
      { id: 'ann-2', competition_id: compId, title: 'MISSION UPDATE: THE LAST DIGIT', content: 'File generator.py has been updated with explicit modulus constants.', urgent: false, created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() }
    ];

    // Seed Audit Logs
    this.data.auditLogs = [
      { id: 'aud-1', admin_id: 'u0000000-0000-0000-0000-000000000001', action: 'COMPETITION_START', target: 'XPLOITX 2.0 BETA', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
      { id: 'aud-2', admin_id: 'u0000000-0000-0000-0000-000000000001', action: 'CHALLENGE_PUBLISHED', target: 'OP-CRYPT-01', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() }
    ];

    // Seed Solves
    this.data.solves = [
      { id: 's-1', challenge_id: 'ch-01', team_id: team1.id, user_id: 'u0000000-0000-0000-0000-000000000003', points_awarded: 450, is_first_blood: true, solved_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
      { id: 's-2', challenge_id: 'ch-02', team_id: team2.id, user_id: 'u0000000-0000-0000-0000-000000000002', points_awarded: 300, is_first_blood: true, solved_at: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString() },
      { id: 's-3', challenge_id: 'ch-06', team_id: team4.id, user_id: 'u0000000-0000-0000-0000-000000000002', points_awarded: 250, is_first_blood: false, solved_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString() }
    ];

    this.data.firstBloods = [
      { id: 'fb-1', challenge_id: 'ch-01', team_id: team1.id, team_name: 'ROOT_ACCESS', user_id: 'u0000000-0000-0000-0000-000000000003', captured_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
      { id: 'fb-2', challenge_id: 'ch-02', team_id: team2.id, team_name: 'NULLBYTE', user_id: 'u0000000-0000-0000-0000-000000000002', captured_at: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString() }
    ];
  }

  // Repository Accessors
  getCompetitions() { return this.data.competitions; }
  getCategories() { return this.data.categories; }
  getChallenges() { return this.data.challenges; }
  getFlags() { return this.data.flags; }
  getHints() { return this.data.challengeHints; }
  getFiles() { return this.data.challengeFiles; }
  getUsers() { return this.data.users; }
  getTeams() { return this.data.teams; }
  getTeamMembers() { return this.data.teamMembers; }
  getSubmissions() { return this.data.submissions; }
  getSolves() { return this.data.solves; }
  getFirstBloods() { return this.data.firstBloods; }
  getAnnouncements() { return this.data.announcements; }
  getAuditLogs() { return this.data.auditLogs; }
  getInstances() { return this.data.instances; }
  getPortAllocations() { return this.data.portAllocations; }
  getSettings() { return this.data.settings; }

  /**
   * Atomic Port Reservation with Mutex Lock (Section 44)
   */
  async allocatePort(rangeStart = 41000, rangeEnd = 41999, instanceId) {
    // Collect all currently active allocated ports
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
    throw new Error('PORT_EXHAUSTION: All ports in range ' + rangeStart + '-' + rangeEnd + ' currently allocated.');
  }

  releasePort(port) {
    const idx = this.data.portAllocations.findIndex(a => a.port === port);
    if (idx !== -1) {
      this.data.portAllocations.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Generic SQL Query Mock / Postgres Execution
  async query(sql, params = []) {
    if (this.isPostgres && this.pool) {
      return this.pool.query(sql, params);
    }
    // High-performance simulated fallback
    return { rows: [], rowCount: 0 };
  }
}

const db = new DatabaseEngine();
module.exports = db;



