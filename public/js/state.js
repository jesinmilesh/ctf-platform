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

const INITIAL_CHALLENGES = [
  {
    id: 'ch-crp-042',
    missionId: 'CRP-042',
    slug: 'the-last-digit',
    title: 'THE LAST DIGIT',
    category: 'CRYPTO',
    difficulty: 'MEDIUM',
    author: 'N0D3_ZERO',
    basePoints: 450,
    minimumPoints: 150,
    decayThreshold: 30,
    currentPoints: 450,
    solveCount: 17,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{l4st_d1g1t_lcg_br34k_9918}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 20,
    tags: ['prng', 'lcg', 'cryptoanalysis'],
    briefing: `The transmission was intercepted at 03:17 UTC along military channel 9.

A proprietary stream cipher was detected operating on high-frequency telemetry.
Our cryptographic unit determined that the keystream generator relies on a flawed Linear Congruential Generator (LCG) with an undersized state register.

Your task is to analyze the consecutive outputs, reconstruct the internal multiplier and seed, and recover the original plaintext message.`,
    evidenceFiles: [
      { name: 'evidence.dat', size: '14.2 KB', sha256: '4f8a91b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abc' },
      { name: 'transmission.txt', size: '1.2 KB', sha256: '8e12b34c56d78e90f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9012345678a' }
    ],
    hasInstance: false,
    hints: [
      { id: 'hint-crp-042-1', cost: 50, content: 'The pseudorandom generator uses an LCG with modulus 2^32. Look closely at consecutive outputs to cancel out the constant.' },
      { id: 'hint-crp-042-2', cost: 100, content: 'Use the difference between successive outputs to calculate the multiplier via modular arithmetic.' }
    ]
  },
  {
    id: 'ch-web-007',
    missionId: 'WEB-007',
    slug: 'black-mirror',
    title: 'BLACK MIRROR',
    category: 'WEB',
    difficulty: 'HARD',
    author: 'EXPLOIT_MAST3R',
    basePoints: 500,
    minimumPoints: 200,
    decayThreshold: 25,
    currentPoints: 500,
    solveCount: 4,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{pr0t0_p0llut10n_t0_jwt_byp4ss}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 15,
    tags: ['nodejs', 'prototype-pollution', 'jwt', 'privesc'],
    briefing: `An internal military intelligence dashboard was discovered on an unsecured subnet.

The authentication service validates JWTs signed by a central authority. However, an endpoint accepting user preference JSON merges inputs recursively without sanitation.

Can you trigger prototype pollution in the Node.js runtime and forge an administrative token to capture the classified flag?`,
    evidenceFiles: [
      { name: 'portal_source.zip', size: '320 KB', sha256: '2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f90123456789de' }
    ],
    hasInstance: true,
    instanceHost: '10.10.42.17',
    instancePort: 8080,
    hints: [
      { id: 'hint-web-007-1', cost: 75, content: 'Inspect the Object.assign recursive merge helper in auth-utils.js. Notice there is no check for __proto__.' }
    ]
  },
  {
    id: 'ch-pwn-101',
    missionId: 'PWN-101',
    slug: 'ghost-process',
    title: 'GHOST PROCESS',
    category: 'PWN',
    difficulty: 'INSANE',
    author: 'BYTE_REAPER',
    basePoints: 600,
    minimumPoints: 250,
    decayThreshold: 20,
    currentPoints: 600,
    solveCount: 1,
    firstBloodTeam: 'ROOT_ACCESS',
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{f0rm4t_str_t0_g0t_0ff_by_0n3}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 10,
    tags: ['x86_64', 'format-string', 'got-overwrite', 'rop'],
    briefing: `A covert telemetry monitoring daemon runs with elevated privileges on target systems.

The binary contains an uncontrolled format string in its log dispatch routine and an off-by-one boundary flaw during heap allocations.

Bypass ASLR and Canary, overwrite the Global Offset Table (GOT), and achieve remote code execution to extract the flag stored in /root/flag.txt.`,
    evidenceFiles: [
      { name: 'ghost_daemon', size: '48.5 KB', sha256: '99887766554433221100aabbccddeeff00112233445566778899aabbccddeeff' },
      { name: 'libc-2.35.so', size: '2.1 MB', sha256: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' }
    ],
    hasInstance: true,
    instanceHost: 'pwn.battlefield.xploitx.org',
    instancePort: 9001,
    hints: [
      { id: 'hint-pwn-101-1', cost: 100, content: 'Leak a libc address through printf(%p) before overwriting puts@got.' }
    ]
  },
  {
    id: 'ch-for-019',
    missionId: 'FOR-019',
    slug: 'memory-trace',
    title: 'MEMORY TRACE',
    category: 'FORENSICS',
    difficulty: 'MEDIUM',
    author: 'HEX_HAWK',
    basePoints: 400,
    minimumPoints: 120,
    decayThreshold: 30,
    currentPoints: 400,
    solveCount: 9,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{v0l4t1l1ty_dll_1nj3ct10n_tr4c3}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 20,
    tags: ['memory-dump', 'volatility', 'dll-injection'],
    briefing: `An operative detected unexpected outbound traffic during an active operation.
A volatile RAM dump was immediately captured.

Analyze the memory image using Volatility 3, identify the stealthily injected dynamic link library (DLL) residing in svchost.exe, and carve the exfiltration payload containing the capture flag.`,
    evidenceFiles: [
      { name: 'memdump.raw.zip', size: '64.2 MB', sha256: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899' }
    ],
    hasInstance: false,
    hints: [
      { id: 'hint-for-019-1', cost: 50, content: 'Run windows.malfind plugin to detect unmapped executable memory segments.' }
    ]
  },
  {
    id: 'ch-rev-033',
    missionId: 'REV-033',
    slug: 'neural-obfuscation',
    title: 'NEURAL OBFUSCATION',
    category: 'REVERSING',
    difficulty: 'HARD',
    author: 'ASM_GHOST',
    basePoints: 550,
    minimumPoints: 200,
    decayThreshold: 25,
    currentPoints: 550,
    solveCount: 3,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{rust_vm_by13c0d3_d3c0d3d_2026}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 15,
    tags: ['rust', 'virtual-machine', 'anti-debug'],
    briefing: `A foreign state-sponsored espionage group deployed this encrypted implant.
The executable is written in Rust and executes a custom stack-based Virtual Machine.

Disassemble the handler table, extract the bytecode stream, and determine the valid 32-byte key that unlocks the cryptographic verification gate.`,
    evidenceFiles: [
      { name: 'neural_vm.bin', size: '184 KB', sha256: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210' }
    ],
    hasInstance: false,
    hints: [
      { id: 'hint-rev-033-1', cost: 80, content: 'The VM opcode dispatch uses a jump table located at offset 0x4012A0. Trace the XOR encryption opcode.' }
    ]
  },
  {
    id: 'ch-osi-005',
    missionId: 'OSI-005',
    slug: 'shadow-transmitter',
    title: 'SHADOW TRANSMITTER',
    category: 'OSINT',
    difficulty: 'EASY',
    author: 'CROW_EYE',
    basePoints: 300,
    minimumPoints: 100,
    decayThreshold: 35,
    currentPoints: 300,
    solveCount: 28,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{lat_13.0827_long_80.2707_loc}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: false,
    maxAttempts: 25,
    tags: ['geolocation', 'imagery', 'metadata'],
    briefing: `A surveillance photo was recovered from a burner phone left in Chennai.
Visible in the background are specific cellular towers, architectural outlines, and a reflection in a window.

Determine the exact coordinates of the rooftop from which this photo was taken.
Format: XploitX{lat_XX.XXXX_long_YY.YYYY_loc}`,
    evidenceFiles: [
      { name: 'surveillance_recon.jpg', size: '3.1 MB', sha256: '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20' }
    ],
    hasInstance: false,
    hints: [
      { id: 'hint-osi-005-1', cost: 40, content: 'Cross-reference the visible bridge with satellite imagery of Chennai central harbor.' }
    ]
  },
  {
    id: 'ch-web-014',
    missionId: 'WEB-014',
    slug: 'jwt-bypass',
    title: 'GATEKEEPER JWT',
    category: 'WEB',
    difficulty: 'EASY',
    author: 'EXPLOIT_MAST3R',
    basePoints: 350,
    minimumPoints: 100,
    decayThreshold: 35,
    currentPoints: 350,
    solveCount: 22,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{jwt_n0n3_4lg_byp4ss_succ3ss}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 20,
    tags: ['jwt', 'alg-none', 'auth-bypass'],
    briefing: `The border control perimeter gate relies on a microservice for identity token validation.
An architectural flaw permits signatures to be omitted if the algorithm header is forged.

Forge an administrative token with role="COMMANDER" and present it to the gate endpoint.`,
    evidenceFiles: [],
    hasInstance: true,
    instanceHost: '10.10.42.33',
    instancePort: 5000,
    hints: []
  },
  {
    id: 'ch-crp-011',
    missionId: 'CRP-011',
    slug: 'dual-matrix',
    title: 'DUAL MATRIX',
    category: 'CRYPTO',
    difficulty: 'EASY',
    author: 'N0D3_ZERO',
    basePoints: 300,
    minimumPoints: 100,
    decayThreshold: 40,
    currentPoints: 300,
    solveCount: 31,
    status: 'LIVE',
    flagType: 'STATIC',
    flagValue: 'XploitX{m4tr1x_tr4nsp0s1t10n_d0n3}',
    flagPrefix: 'XploitX{',
    flagSuffix: '}',
    caseSensitive: true,
    maxAttempts: 20,
    tags: ['classical', 'transposition', 'matrix'],
    briefing: `Maritime intercept detected an encrypted coordinate grid transposed using an alternating 5x5 key matrix.
Recover the key and decode the flag.`,
    evidenceFiles: [
      { name: 'intercept.txt', size: '800 bytes', sha256: '5566778899aabbccddeeff00112233445566778899aabbccddeeff0011223344' }
    ],
    hasInstance: false,
    hints: []
  }
];

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
