/**
 * XPLOITX // CYBER BATTLEFIELD
 * Flag Submission Engine & First Blood Detection (backend/services/submissionService.js)
 */

const crypto = require('crypto');
const db = require('../config/database');
const scoringService = require('./scoringService');
const realtimeService = require('./realtimeService');

class SubmissionService {
  constructor() {
    this.broadcastCallback = null;
  }

  setBroadcaster(fn) {
    this.broadcastCallback = fn;
  }

  broadcast(type, data) {
    if (typeof this.broadcastCallback === 'function') {
      this.broadcastCallback(type, data);
    }
  }

  submitFlag({ challengeId, submittedFlag, user, ip = '127.0.0.1' }) {
    const cleanFlag = (submittedFlag || '').trim();
    const settings = db.getSettings();

    // 0. Verify competition active status (Section 18)
    const comp = db.getCompetitions()[0];
    if (comp && comp.status && comp.status !== 'LIVE') {
      return {
        success: false,
        correct: false,
        status: 'COMPETITION_NOT_ACTIVE',
        message: `ENGAGEMENT SUSPENDED: Competition status is currently ${comp.status}. Flag submissions are offline.`
      };
    }

    // 1. Find challenge with flexible normalization (ch-01 <-> ch-001)
    const challenge = db.getChallenges().find(c =>
      c.id === challengeId ||
      c.slug === challengeId ||
      c.mission_id === challengeId ||
      c.id === challengeId.replace(/^ch-0*(\d+)$/, (m, p) => 'ch-' + (parseInt(p, 10) < 10 ? '0' + parseInt(p, 10) : p)) ||
      c.id.replace(/^ch-0*(\d+)$/, 'ch-$1') === challengeId
    );

    if (!challenge) {
      return { success: false, correct: false, status: 'NOT_FOUND', message: 'Mission dossier not found' };
    }

    const teamId = user.team_id || (user.team && user.team.id);
    const team = db.getTeams().find(t => t.id === teamId);

    // 2. Check if already solved
    const existingSolve = db.getSolves().find(s =>
      s.challenge_id === challenge.id &&
      ((teamId && s.team_id === teamId) || (user.id && s.user_id === user.id))
    );
    if (existingSolve) {
      return {
        success: false,
        status: 'ALREADY_SOLVED',
        correct: false,
        message: 'MISSION ALREADY SECURED: Flag has previously been captured by your operative squad.'
      };
    }

    // 3. Verify Flag Syntax Prefix & Suffix
    const prefix = settings.flagPrefix || 'XploitXβ{';
    const suffix = settings.flagSuffix || '}';
    if (!cleanFlag.startsWith(prefix) || !cleanFlag.endsWith(suffix)) {
      this.recordSubmission({
        challengeId: challenge.id,
        teamId,
        userId: user.id,
        flag: cleanFlag,
        status: 'MALFORMED',
        ip
      });
      return {
        success: false,
        correct: false,
        status: 'MALFORMED',
        message: `INVALID SYNTAX: Expected format ${prefix}...${suffix}`
      };
    }

    // 4. Match against stored flags for this challenge (Section 14)
    // Supports: STATIC, REGEX, DYNAMIC (HMAC), MULTIPLE_ACCEPTED_FLAGS
    const challengeFlags = db.getFlags().filter(f => f.challenge_id === challenge.id);
    let isCorrect = false;

    const hmacSecret = process.env.FLAG_HMAC_SECRET || 'xploitx_dynamic_flag_hmac_secret_key_2026';

    for (const fl of challengeFlags) {
      if (fl.flag_type === 'REGEX') {
        const regex = new RegExp(fl.flag_value, fl.case_sensitive ? '' : 'i');
        if (regex.test(cleanFlag)) {
          isCorrect = true;
          break;
        }
      } else if (fl.flag_type === 'DYNAMIC') {
        // Dynamic HMAC generation based on team ID or user ID
        const seedId = teamId || user.id || 'operative';
        const hmacHash = crypto.createHmac('sha256', hmacSecret).update(`${challenge.id}:${seedId}`).digest('hex').substring(0, 16);
        const expectedDynamicFlag = `${prefix}dyn_${hmacHash}${suffix}`;
        if (cleanFlag === expectedDynamicFlag) {
          isCorrect = true;
          break;
        }
      } else if (fl.flag_type === 'MULTIPLE_ACCEPTED_FLAGS') {
        // Comma or newline separated accepted flags
        const accepted = fl.flag_value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        if (accepted.some(a => fl.case_sensitive ? a === cleanFlag : a.toLowerCase() === cleanFlag.toLowerCase())) {
          isCorrect = true;
          break;
        }
      } else {
        // Standard STATIC match
        if (fl.case_sensitive) {
          if (cleanFlag === fl.flag_value) {
            isCorrect = true;
            break;
          }
        } else {
          if (cleanFlag.toLowerCase() === fl.flag_value.toLowerCase()) {
            isCorrect = true;
            break;
          }
        }
      }
    }

    // 5. Handle Incorrect Flag
    if (!isCorrect) {
      this.recordSubmission({
        challengeId: challenge.id,
        teamId,
        userId: user.id,
        flag: cleanFlag,
        status: 'INCORRECT',
        ip
      });
      return {
        success: false,
        correct: false,
        status: 'INCORRECT',
        message: 'FLAG REJECTED // CRYPTOGRAPHIC CHECKSUM MISMATCH'
      };
    }

    // 6. Handle Correct Flag Capture with Race-Safe First Blood (Section 16)
    // Synchronous execution block or transactional check prevents simultaneous first-blood claims
    const currentSolves = db.getSolves().filter(s => s.challenge_id === challenge.id);
    const isFirstBlood = currentSolves.length === 0;

    // Recalculate dynamic points
    challenge.solve_count = (challenge.solve_count || 0) + 1;
    const pointsAwarded = scoringService.recomputeChallengePoints(challenge, challenge.solve_count);

    // Save solve
    const solve = {
      id: crypto.randomUUID(),
      challenge_id: challenge.id,
      team_id: teamId,
      user_id: user.id,
      points_awarded: pointsAwarded,
      is_first_blood: isFirstBlood,
      solved_at: new Date().toISOString()
    };
    db.getSolves().push(solve);

    // If first blood, record first blood event
    if (isFirstBlood) {
      const fb = {
        id: crypto.randomUUID(),
        challenge_id: challenge.id,
        team_id: teamId,
        team_name: team ? team.name : user.username,
        user_id: user.id,
        user_callsign: user.callsign || user.username,
        captured_at: solve.solved_at
      };
      db.getFirstBloods().push(fb);

      if (team) {
        team.first_bloods = (team.first_bloods || 0) + 1;
      }

      // Broadcast First Blood
      this.broadcast('FIRST_BLOOD', {
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        teamName: team ? team.name : user.username,
        points: pointsAwarded,
        timestamp: solve.solved_at
      });

      realtimeService.broadcastFirstBlood({
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        teamName: team ? team.name : user.username,
        points: pointsAwarded,
        capturedAt: solve.solved_at
      }).catch(err => console.error('[SUBMISSION SERVICE] First blood broadcast error:', err));
    }

    // Update Team score and solve count
    if (team) {
      team.total_score = (team.total_score || 0) + pointsAwarded;
      team.solves_count = (team.solves_count || 0) + 1;
      team.last_score_update = solve.solved_at;
    }

    // Persist Score Event (Section 9 & 11)
    db.getScoreEvents().push({
      id: crypto.randomUUID(),
      team_id: teamId,
      delta: pointsAwarded,
      resulting_score: team ? team.total_score : pointsAwarded,
      reason: isFirstBlood ? 'FIRST_BLOOD_SOLVE' : 'FLAG_SOLVE',
      challenge_id: challenge.id,
      created_at: solve.solved_at
    });

    // Record submission
    this.recordSubmission({
      challengeId: challenge.id,
      teamId,
      userId: user.id,
      flag: cleanFlag,
      status: 'CORRECT',
      points: pointsAwarded,
      ip
    });

    // Broadcast live score update
    this.broadcast('SCORE_UPDATED', {
      teamId,
      teamName: team ? team.name : user.username,
      pointsAwarded,
      challengeTitle: challenge.title,
      isFirstBlood
    });

    realtimeService.broadcastScoreboardUpdated({
      teamId,
      teamName: team ? team.name : user.username,
      pointsAwarded,
      challengeTitle: challenge.title
    }).catch(err => console.error('[SUBMISSION SERVICE] Scoreboard broadcast error:', err));

    return {
      success: true,
      correct: true,
      status: 'CORRECT',
      pointsAwarded,
      isFirstBlood,
      message: isFirstBlood ? 'FIRST BLOOD CAPTURED! EXCELLENT EXECUTION!' : 'MISSION COMPLETE // FLAG CONFIRMED'
    };
  }

  recordSubmission({ challengeId, teamId, userId, flag, status, points = 0, ip }) {
    const sub = {
      id: crypto.randomUUID(),
      challenge_id: challengeId,
      team_id: teamId,
      user_id: userId,
      submitted_flag: flag,
      status,
      points_awarded: points,
      ip_address: ip,
      created_at: new Date().toISOString()
    };
    db.getSubmissions().push(sub);
  }
}

module.exports = new SubmissionService();
