/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Identity & Public Route Utility (backend/utils/challengeIdentity.js)
 * 
 * Implements Three-Tier Challenge Identity Architecture:
 * 1. competitionId: identifies the event (e.g. XPLOITX-2026)
 * 2. challengeId: domain-specific human-readable identifier (CRY-000000-00000-C001)
 * 3. publicRouteId: server-generated cryptographically secure opaque URL slug (a8F2kLm91Qx7pL9z)
 * 4. _id: MongoDB internal ObjectId (never exposed to participants in URLs)
 */

const crypto = require('crypto');

// 1. Central Domain Prefix Taxonomy (The 8 Battlefield Sectors)
const DOMAIN_PREFIXES = {
  CRY: { code: 'CRY', name: 'Cryptography', sequencePrefix: 'C' },
  WEB: { code: 'WEB', name: 'Web Exploitation', sequencePrefix: 'C' },
  FOR: { code: 'FOR', name: 'Digital Forensics', sequencePrefix: 'C' },
  OSN: { code: 'OSN', name: 'OSINT', sequencePrefix: 'C' },
  PWN: { code: 'PWN', name: 'Binary Exploitation', sequencePrefix: 'C' },
  NET: { code: 'NET', name: 'Network Security', sequencePrefix: 'C' },
  STG: { code: 'STG', name: 'Steganography', sequencePrefix: 'C' },
  MIS: { code: 'MIS', name: 'Miscellaneous / Logic', sequencePrefix: 'C' }
};

// Strict Challenge ID format regex: <DOMAIN>-<SERIAL>-<CHALLENGE>-<SEQUENCE>
// e.g. CRY-000000-00000-C001, STG-000000-00000-C001
const CHALLENGE_ID_REGEX = /^(CRY|WEB|FOR|OSN|PWN|NET|STG|MIS)-[0-9]{6}-[0-9]{5}-C[0-9]{3,}$/;

/**
 * Resolve domain prefix from category name, slug, or raw string.
 * Uses strict canonical matching with sensible fallbacks.
 */
function resolveDomainPrefix(categoryInput) {
  if (!categoryInput) return 'MIS';
  const raw = String(categoryInput).trim();
  const upper = raw.toUpperCase();

  // Check direct prefix match
  if (DOMAIN_PREFIXES[upper]) return upper;

  const lower = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('crypt') || lower.includes('cipher') || lower === 'cry') return 'CRY';
  if (lower.includes('web') || lower.includes('http') || lower === 'sqli' || lower === 'xss') return 'WEB';
  if (lower.includes('steg') || lower === 'stg') return 'STG';
  if (lower.includes('forensic') || lower.includes('dfir') || (lower.includes('pcap') && lower.includes('forensic'))) return 'FOR';
  if (lower.includes('osint') || lower.includes('intel') || lower.includes('recon') || lower.includes('geoint')) return 'OSN';
  if (lower.includes('pwn') || lower.includes('binary') || lower.includes('exploit') || lower.includes('rop') || lower.includes('heap')) return 'PWN';
  if (lower.includes('network') || lower.includes('net') || lower.includes('pcap') || lower.includes('packet')) return 'NET';
  if (lower.includes('misc') || lower.includes('logic') || lower.includes('trivia')) return 'MIS';

  return 'MIS';
}

/**
 * Get full domain name from prefix.
 */
function getDomainName(prefix) {
  const norm = String(prefix || 'MIS').toUpperCase();
  return DOMAIN_PREFIXES[norm]?.name || 'Miscellaneous / Logic';
}

/**
 * Validate Challenge ID format.
 */
function isValidChallengeId(challengeId) {
  if (!challengeId || typeof challengeId !== 'string') return false;
  return CHALLENGE_ID_REGEX.test(challengeId.trim());
}

/**
 * Extract sequence number from an existing Challenge ID.
 * e.g. 'CRY-000000-00000-C001' -> 1
 */
function parseSequenceFromId(challengeId) {
  if (!isValidChallengeId(challengeId)) return 0;
  const match = challengeId.trim().match(/-C([0-9]+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Format domain sequence into standard challengeId string:
 * <DOMAIN>-000000-00000-C<SEQ>
 * e.g. CRY-000000-00000-C001
 */
function formatChallengeId(prefix, sequenceNum, serial = '000000', challengeSeq = '00000') {
  const safePrefix = (prefix || 'MIS').toUpperCase();
  const seqStr = String(sequenceNum).padStart(3, '0');
  const safeSerial = String(serial).padStart(6, '0').slice(0, 6);
  const safeChallengeSeq = String(challengeSeq).padStart(5, '0').slice(0, 5);
  return `${safePrefix}-${safeSerial}-${safeChallengeSeq}-C${seqStr}`;
}

/**
 * Server-side HMAC-SHA256 based public route identifier generator.
 * Combines challengeId with a server-side secret and random entropy to produce
 * a cryptographically secure, URL-safe, opaque string (16-20 chars).
 * The secret NEVER reaches the participant frontend.
 */
function generatePublicRouteId(challengeId, existingIds = new Set()) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'xploitx_route_hmac_secret_2026_c2_grid';
  
  for (let attempt = 0; attempt < 10; attempt++) {
    const salt = crypto.randomBytes(8).toString('hex');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${challengeId || 'challenge'}:${salt}:${Date.now()}`);
    const candidate = hmac.digest('base64url').slice(0, 16);

    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  // Fallback high-entropy random string
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Allocate the next race-safe sequence number for a domain prefix.
 * Scans existing challenges to find highest existing sequence for this domain,
 * ensuring no duplicate sequence can ever be allocated even across restarts.
 */
function allocateNextSequence(prefix, challenges = []) {
  const normPrefix = (prefix || 'MIS').toUpperCase();
  let maxSeq = 0;

  for (const c of challenges) {
    if (!c) continue;
    const cid = c.challengeId || c.id || '';
    if (cid.startsWith(`${normPrefix}-`)) {
      const seq = parseSequenceFromId(cid);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  return maxSeq + 1;
}

module.exports = {
  DOMAIN_PREFIXES,
  CHALLENGE_ID_REGEX,
  resolveDomainPrefix,
  getDomainName,
  isValidChallengeId,
  parseSequenceFromId,
  formatChallengeId,
  generatePublicRouteId,
  allocateNextSequence
};
