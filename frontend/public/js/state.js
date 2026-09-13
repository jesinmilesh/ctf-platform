/**
 * XPLOITX // CYBER BATTLEFIELD
 * Central Reactive State & Seed Dataset
 */

const INITIAL_TEAMS = [
  { id: 'team-nexus', name: 'NEXUS', slug: 'nexus', score: 4850, solvesCount: 21, firstBloods: 3, rank: 7, members: ['Alice', 'Bob', 'Charlie', 'Jesin'] },
  { id: 'team-root', name: 'ROOT_ACCESS', slug: 'root-access', score: 8450, solvesCount: 31, firstBloods: 8, rank: 1, members: ['Viper', 'Zero', 'Hex', 'Null'] },
  { id: 'team-null', name: 'NULLBYTE', slug: 'nullbyte', score: 8120, solvesCount: 29, firstBloods: 5, rank: 2, members: ['Krypt', 'C0de', 'Glitch', 'Shadow'] },
  { id: 'team-vipers', name: 'CYBER_VIPERS', slug: 'cyber-vipers', score: 7900, solvesCount: 27, firstBloods: 4, rank: 3, members: ['Ghost', 'Spectre', 'Wraith', 'Phantom'] },
  { id: 'team-buffer', name: 'BUFFER_OVERFLOW', slug: 'buffer-overflow', score: 6840, solvesCount: 24, firstBloods: 2, rank: 4, members: ['Stack', 'Heap', 'Rop', 'Shell'] },
  { id: 'team-zero', name: 'ZERO_DAY_SOCIETY', slug: 'zero-day', score: 6200, solvesCount: 22, firstBloods: 2, rank: 5, members: ['Axiom', 'Nexus', 'Pulse', 'Cipher'] },
  { id: 'team-dark', name: 'DARK_SYNAPSE', slug: 'dark-synapse', score: 5410, solvesCount: 20, firstBloods: 1, rank: 6, members: ['Synapse', 'Cortex', 'Axon', 'Dendrite'] },
  { id: 'team-phantom', name: 'PHANTOM_CORP', slug: 'phantom-corp', score: 4320, solvesCount: 16, firstBloods: 0, rank: 8, members: ['Echo', 'Delta', 'Zulu', 'Foxtrot'] }
];

const INITIAL_CHALLENGES = (function() {
  const challenges = [];
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
        
        const basePoints = diff === 'MEDIUM' ? 300 : (diff === 'HARD' ? 500 : 1000);
        challenges.push({
          id: 'ch-' + String(chId).padStart(3, '0'),
          missionId: 'OP-' + cName.substring(0,3).toUpperCase() + '-' + chId,
          slug: 'challenge-' + chId,
          title: cName.toUpperCase() + ' ' + diff + ' ' + chId,
          category: cName,
          difficulty: diff,
          author: 'SYSTEM',
          basePoints: basePoints,
          minimumPoints: 100,
          decayThreshold: 30,
          currentPoints: basePoints,
          solveCount: 0,
          status: 'LIVE',
          hasInstance: false,
          instanceHost: null,
          instancePort: null,
          description: 'Auto-generated ' + diff + ' challenge for ' + cName + '.<br><br>Find the flag.',
          files: [],
          hints: []
        });
        chId++;
      }
    }
  });
  return challenges;
})();

class StateManager {
  constructor() {
    this.storageKey = 'xploitx_battlefield_state_v1';
    this.state = this.loadState();
  }

  loadState() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }

    // Default Fresh State
    return {
      competition: {
        name: 'XPLOITX 2.0 BETA',
        tagline: 'ENTER THE DIGITAL BATTLEFIELD',
        status: 'LIVE',
        scoreboardFrozen: false,
        durationHours: 24,
        startTime: Date.now() - 6 * 3600 * 1000, // 6 hours into CTF
        endTime: Date.now() + 18 * 3600 * 1000,
        flagPrefix: 'XploitX{',
        flagSuffix: '}',
        dynamicScoring: true
      },
      currentUser: {
        id: 'usr-jesin-01',
        username: 'Jesin',
        callsign: 'N0D3_RUNNER',
        role: 'PLAYER', // Toggleable to 'ADMIN'
        teamId: 'team-nexus',
        xp: 2850,
        accuracy: 91,
        firstBloods: 3,
        solvedChallenges: ['ch-crp-011', 'ch-web-014']
      },
      myTeam: {
        id: 'team-nexus',
        name: 'NEXUS',
        slug: 'nexus',
        accessCode: 'NEXUS-8921-CLASSIFIED',
        captain: 'Alice',
        members: ['Alice', 'Bob', 'Charlie', 'Jesin']
      },
      teams: INITIAL_TEAMS,
      challenges: INITIAL_CHALLENGES,
      solves: [
        { id: 's-1', challengeId: 'ch-crp-011', teamId: 'team-nexus', userId: 'usr-jesin-01', timestamp: Date.now() - 14000000, isFirstBlood: false },
        { id: 's-2', challengeId: 'ch-web-014', teamId: 'team-nexus', userId: 'usr-jesin-01', timestamp: Date.now() - 9000000, isFirstBlood: false },
        { id: 's-3', challengeId: 'ch-pwn-101', teamId: 'team-root', userId: 'usr-viper', timestamp: Date.now() - 20000000, isFirstBlood: true }
      ],
      unlockedHints: [],
      submissionsLog: [
        { id: 'sub-1', challengeMissionId: 'CRP-011', teamName: 'NEXUS', submittedFlag: 'XploitX{m4tr1x_tr4nsp0s1t10n_d0n3}', status: 'CORRECT', ip: '10.8.0.4', time: '11:24:02' },
        { id: 'sub-2', challengeMissionId: 'PWN-101', teamName: 'DARK_SYNAPSE', submittedFlag: 'XploitX{wrong_buffer_addr}', status: 'INCORRECT', ip: '10.8.0.12', time: '11:32:15' },
        { id: 'sub-3', challengeMissionId: 'WEB-007', teamName: 'NULLBYTE', submittedFlag: 'XploitX{test_payload}', status: 'INCORRECT', ip: '10.8.0.9', time: '11:41:09' }
      ],
      announcements: [
        { id: 'ann-1', title: 'SYSTEM BROADCAST // CTF ENGAGED', content: 'The battlefield is live for 24 hours. Dynamic scoring is active.', urgent: true, time: '06:00:00 UTC' },
        { id: 'ann-2', title: 'CRYPTO-042 TELEMETRY UPDATE', content: 'Evidence checksum verified: SHA256 matches intercept manifest.', urgent: false, time: '08:15:30 UTC' }
      ],
      activityFeed: [
        { id: 'act-1', type: 'first-blood', text: 'ROOT_ACCESS captured FIRST BLOOD on GHOST PROCESS (PWN-101) [+600 XP]', time: '11:42:17' },
        { id: 'act-2', type: 'solve', text: 'NULLBYTE captured GATEKEEPER JWT (WEB-014) [+350 XP]', time: '11:41:02' },
        { id: 'act-3', type: 'solve', text: 'Team NEXUS captured DUAL MATRIX (CRP-011) [+300 XP]', time: '11:39:41' }
      ],
      activeInstances: {}
    };
  }

  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  resetToDefault() {
    localStorage.removeItem(this.storageKey);
    this.state = this.loadState();
    this.saveState();
  }
}

window.stateManager = new StateManager();
