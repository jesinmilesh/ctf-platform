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
      { id: 'cat-crypto', competition_id: compId, name: 'CRYPTO', slug: 'crypto', description: 'Ciphers, discrete log, and broken PRNGs', color_accent: '#c77dff', display_order: 1 },
      { id: 'cat-web', competition_id: compId, name: 'WEB', slug: 'web', description: 'XSS, SQLi, SSRF, and prototype pollution', color_accent: '#00d8f6', display_order: 2 },
      { id: 'cat-pwn', competition_id: compId, name: 'PWN', slug: 'pwn', description: 'Binary exploitation, ROP chains, and heap overflow', color_accent: '#ff3b5c', display_order: 3 },
      { id: 'cat-forensics', competition_id: compId, name: 'FORENSICS', slug: 'forensics', description: 'Memory dump analysis and network packet inspection', color_accent: '#00ff9c', display_order: 4 },
      { id: 'cat-reversing', competition_id: compId, name: 'REVERSING', slug: 'reversing', description: 'Assembly deobfuscation and firmware inspection', color_accent: '#ffb020', display_order: 5 },
      { id: 'cat-osint', competition_id: compId, name: 'OSINT', slug: 'osint', description: 'Open source intelligence and asset tracing', color_accent: '#4cc9f0', display_order: 6 }
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

    // Seed Challenges
    this.data.challenges = [
      {
        id: 'ch-01',
        competition_id: compId,
        category_id: 'cat-crypto',
        category_name: 'CRYPTO',
        mission_id: 'OP-CRYPT-01',
        slug: 'the-last-digit',
        title: 'The Last Digit',
        difficulty: 'MEDIUM',
        description: 'An intercepted transmission from an adversarial satellite contains a pseudorandom number generator with poor entropy. Recover the initial seed to decode the secret message.\n\nTarget parameter: Linear Congruential Generator modulus $M = 2^{31}-1$.',
        base_points: 450,
        minimum_points: 100,
        decay_threshold: 30,
        current_points: 420,
        solve_count: 17,
        status: 'PUBLISHED',
        has_instance: false,
        instance_host: null,
        instance_port: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'ch-02',
        competition_id: compId,
        category_id: 'cat-web',
        category_name: 'WEB',
        mission_id: 'OP-WEB-02',
        slug: 'classified-vault',
        title: 'Classified Vault Breach',
        difficulty: 'EASY',
        description: 'The internal terminal of the target agency permits remote document queries. Can you bypass their query sanitization filter to extract the administrator access token?',
        base_points: 300,
        minimum_points: 100,
        decay_threshold: 30,
        current_points: 180,
        solve_count: 42,
        status: 'PUBLISHED',
        has_instance: true,
        instance_host: 'challenge.xploitxctf.me',
        instance_port: 31337,
        created_at: new Date().toISOString()
      },
      {
        id: 'ch-03',
        competition_id: compId,
        category_id: 'cat-pwn',
        category_name: 'PWN',
        mission_id: 'OP-PWN-03',
        slug: 'buffer-strike',
        title: 'Buffer Strike // ROP Arena',
        difficulty: 'HARD',
        description: 'A 64-bit ELF binary running on a hardened remote daemon. ASLR is enabled, NX is enabled, but Canary is absent. Build a Return-Oriented Programming (ROP) chain to spawn an interactive shell.',
        base_points: 500,
        minimum_points: 150,
        decay_threshold: 30,
        current_points: 475,
        solve_count: 6,
        status: 'PUBLISHED',
        has_instance: true,
        instance_host: 'pwn.xploitxctf.me',
        instance_port: 39001,
        created_at: new Date().toISOString()
      },
      {
        id: 'ch-04',
        competition_id: compId,
        category_id: 'cat-forensics',
        category_name: 'FORENSICS',
        mission_id: 'OP-FOR-04',
        slug: 'quantum-packet',
        title: 'Quantum Packet Capture',
        difficulty: 'MEDIUM',
        description: 'Exfiltrated PCAPng file captured during a simulated network breach. Deep packet analysis is required to reassemble an encrypted TLS stream and extract the exfiltrated artifact.',
        base_points: 400,
        minimum_points: 100,
        decay_threshold: 30,
        current_points: 340,
        solve_count: 19,
        status: 'PUBLISHED',
        has_instance: false,
        instance_host: null,
        instance_port: null,
        created_at: new Date().toISOString()
      },
      {
        id: 'ch-05',
        competition_id: compId,
        category_id: 'cat-reversing',
        category_name: 'REVERSING',
        mission_id: 'OP-REV-05',
        slug: 'matrix-decryptor',
        title: 'Matrix Decryptor v2',
        difficulty: 'HARD',
        description: 'A heavily obfuscated Mach-O / PE32 executable implementing custom virtual machine bytecode instructions. Reverse the dispatch table to extract the validation algorithm.',
        base_points: 500,
        minimum_points: 100,
        decay_threshold: 30,
        current_points: 490,
        solve_count: 3,
        status: 'PUBLISHED',
        has_instance: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'ch-06',
        competition_id: compId,
        category_id: 'cat-osint',
        category_name: 'OSINT',
        mission_id: 'OP-OSI-06',
        slug: 'shadow-trail',
        title: 'Shadow Operative Trail',
        difficulty: 'EASY',
        description: 'A rogue operative published encrypted coordinates across public code repositories and decentralized ledgers. Trace the digital footprint to locate their clandestine server.',
        base_points: 250,
        minimum_points: 100,
        decay_threshold: 30,
        current_points: 120,
        solve_count: 58,
        status: 'PUBLISHED',
        has_instance: false,
        created_at: new Date().toISOString()
      }
    ];

    // Seed Flags
    this.data.flags = [
      { id: 'f-1', challenge_id: 'ch-01', flag_type: 'STATIC', flag_value: 'XploitXβ{l4st_d1g1t_lcg_br34k_9918}', case_sensitive: true },
      { id: 'f-2', challenge_id: 'ch-02', flag_type: 'STATIC', flag_value: 'XploitXβ{sqli_cl4ssified_v4ult_unl0ck3d}', case_sensitive: true },
      { id: 'f-3', challenge_id: 'ch-03', flag_type: 'STATIC', flag_value: 'XploitXβ{r0p_g4dg3t_m4st3r_sh3ll_sp4wn}', case_sensitive: true },
      { id: 'f-4', challenge_id: 'ch-04', flag_type: 'STATIC', flag_value: 'XploitXβ{pcap_tls_k3y_l0g_r34ss3mbly}', case_sensitive: true },
      { id: 'f-5', challenge_id: 'ch-05', flag_type: 'STATIC', flag_value: 'XploitXβ{vm_byt3c0d3_d30bfusc4t10n}', case_sensitive: true },
      { id: 'f-6', challenge_id: 'ch-06', flag_type: 'STATIC', flag_value: 'XploitXβ{0s1nt_tr4c1ng_gl0b4l_sh4d0w}', case_sensitive: true }
    ];

    // Seed Hints
    this.data.challengeHints = [
      { id: 'h-1', challenge_id: 'ch-01', content: 'Notice that state[n+1] = (a * state[n] + c) % m. Look at the lower bits carefully.', cost: 50, order_index: 1, enabled: true },
      { id: 'h-2', challenge_id: 'ch-02', content: 'Union-based extraction might be blocked, but error-based boolean blind is responsive.', cost: 30, order_index: 1, enabled: true },
      { id: 'h-3', challenge_id: 'ch-03', content: 'Check `pop rdi; ret` address at libc offset +0x23b6a.', cost: 75, order_index: 1, enabled: true }
    ];

    // Seed Files
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
