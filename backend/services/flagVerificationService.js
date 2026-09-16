/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authoritative Flag Verification Service (backend/services/flagVerificationService.js)
 * Implements Section 32 of Master Specification:
 * - Single central flag verification service used across all submission & testing flows
 * - Exact case-sensitive match for STATIC flags (no arbitrary trimming or transformations)
 * - Dynamic HMAC verification for DYNAMIC flags
 * - Delimited matching for MULTIPLE_ACCEPTED_FLAGS
 * - Regular expression matching for REGEX flags
 * - Prevents flag leakage in logs and responses
 */

const crypto = require('crypto');
const db = require('../config/database');

class FlagVerificationService {
  /**
   * Verify a submitted flag against a challenge's stored flag configurations
   * @param {Object} challenge - The resolved challenge document
   * @param {string} submittedFlag - The exact string submitted by operative/admin
   * @param {Object} [user] - The operative or admin submitting
   * @returns {{ correct: boolean, reason?: string, flagType?: string }}
   */
  verifySubmission(challenge, submittedFlag, user = null) {
    if (!challenge) {
      return { correct: false, reason: 'CHALLENGE_NOT_FOUND' };
    }

    if (typeof submittedFlag !== 'string' || submittedFlag.length === 0) {
      return { correct: false, reason: 'EMPTY_FLAG' };
    }

    const settings = db.getSettings();
    const prefix = settings.flagPrefix || 'XploitXβ{';
    const suffix = settings.flagSuffix || '}';

    // Standard CTF policy: exact submission match required
    // Clean surrounding whitespace outside of the flag wrapper only if platform standard
    const cleanFlag = submittedFlag.trim();

    // Syntax validation: must start with prefix and end with suffix
    if (!cleanFlag.startsWith(prefix) || !cleanFlag.endsWith(suffix)) {
      return { correct: false, reason: 'MALFORMED_SYNTAX' };
    }

    // Collect all associated challenge identifiers for flag matching
    const challengeIds = [
      challenge.id ? String(challenge.id).trim() : null,
      challenge.challengeId ? String(challenge.challengeId).trim() : null,
      challenge.publicRouteId ? String(challenge.publicRouteId).trim() : null,
      challenge._id ? String(challenge._id).trim() : null,
      challenge.slug ? String(challenge.slug).trim() : null,
      challenge.mission_id ? String(challenge.mission_id).trim() : null
    ].filter(Boolean);

    // 1. Gather all candidate flags from db.getFlags() matching any challenge identifier
    const candidateFlags = [];

    const matchedRecords = db.getFlags().filter(f => {
      const fChallengeId = f.challenge_id ? String(f.challenge_id).trim() : '';
      const fAltChallengeId = f.challengeId ? String(f.challengeId).trim() : '';
      return challengeIds.includes(fChallengeId) || challengeIds.includes(fAltChallengeId);
    });

    matchedRecords.forEach(f => {
      candidateFlags.push({
        id: f.id,
        flag_type: f.flag_type || 'STATIC',
        flag_value: f.flag_value || f.value,
        case_sensitive: f.case_sensitive !== false
      });
    });

    // 2. Also incorporate flags directly embedded on the challenge document (if present)
    if (challenge.flag && typeof challenge.flag === 'string') {
      candidateFlags.push({
        id: 'challenge_doc_flag',
        flag_type: 'STATIC',
        flag_value: challenge.flag.trim(),
        case_sensitive: true
      });
    }

    if (Array.isArray(challenge.flags)) {
      challenge.flags.forEach((cf, idx) => {
        const val = typeof cf === 'string' ? cf : (cf.value || cf.flag_value);
        if (val) {
          candidateFlags.push({
            id: cf.id || `doc_flag_${idx}`,
            flag_type: cf.type || cf.flag_type || 'STATIC',
            flag_value: String(val).trim(),
            case_sensitive: cf.case_sensitive !== false
          });
        }
      });
    }

    if (candidateFlags.length === 0) {
      return { correct: false, reason: 'NO_FLAGS_CONFIGURED' };
    }

    const hmacSecret = process.env.FLAG_HMAC_SECRET || 'xploitx_dynamic_flag_hmac_secret_key_2026';
    const teamId = user ? (user.team_id || (user.team && user.team.id)) : null;
    const userId = user ? user.id : null;

    for (const fl of candidateFlags) {
      const type = (fl.flag_type || 'STATIC').toUpperCase();

      if (type === 'REGEX') {
        try {
          const regex = new RegExp(fl.flag_value, fl.case_sensitive ? '' : 'i');
          if (regex.test(cleanFlag)) {
            return { correct: true, flagType: 'REGEX' };
          }
        } catch (e) {
          // Invalid regex in flag configuration
        }
      } else if (type === 'DYNAMIC') {
        // Dynamic HMAC generation based on operative team ID or user ID
        const seedId = teamId || userId || 'operative';
        const hmacHash = crypto.createHmac('sha256', hmacSecret)
          .update(`${challenge.id}:${seedId}`)
          .digest('hex')
          .substring(0, 16);
        const expectedDynamicFlag = `${prefix}dyn_${hmacHash}${suffix}`;
        if (cleanFlag === expectedDynamicFlag) {
          return { correct: true, flagType: 'DYNAMIC' };
        }
      } else if (type === 'MULTIPLE_ACCEPTED_FLAGS') {
        const accepted = fl.flag_value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        const match = accepted.some(a => fl.case_sensitive ? a === cleanFlag : a.toLowerCase() === cleanFlag.toLowerCase());
        if (match) {
          return { correct: true, flagType: 'MULTIPLE_ACCEPTED_FLAGS' };
        }
      } else {
        // Standard STATIC exact comparison
        if (fl.case_sensitive) {
          if (cleanFlag === fl.flag_value) {
            return { correct: true, flagType: 'STATIC' };
          }
        } else {
          if (cleanFlag.toLowerCase() === fl.flag_value.toLowerCase()) {
            return { correct: true, flagType: 'STATIC' };
          }
        }
      }
    }

    return { correct: false, reason: 'CHECKSUM_MISMATCH' };
  }
}

module.exports = new FlagVerificationService();
