/**
 * XPLOITX // CYBER BATTLEFIELD
 * Flag Submission Engine & First Blood Detection (backend/services/submissionService.js)
 */

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

    // 1. Find challenge
    const challenge = db.getChallenges().find(c => c.id === challengeId || c.slug === challengeId || c.mission_id === challengeId);
    if (!challenge) {
      return { success: false, status: 'NOT_FOUND', message: 'Mission dossier not found' };
    }

    const teamId = user.team_id || (user.team && user.team.id);
    const team = db.getTeams().find(t => t.id === teamId);

    // 2. Check if already solved
    const existingSolve = db.getSolves().find(s => s.challenge_id === challenge.id && (s.team_id === teamId || s.user_id === user.id));
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

    // 4. Match against stored flags for this challenge
    const challengeFlags = db.getFlags().filter(f => f.challenge_id === challenge.id);
    let isCorrect = false;

    for (const fl of challengeFlags) {
      if (fl.flag_type === 'REGEX') {
        const regex = new RegExp(fl.flag_value, fl.case_sensitive ? '' : 'i');
        if (regex.test(cleanFlag)) {
          isCorrect = true;
          break;
        }
      } else {
        // Static match
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

    // 6. Handle Correct Flag Capture
    const currentSolves = db.getSolves().filter(s => s.challenge_id === challenge.id);
    const isFirstBlood = currentSolves.length === 0;

    // Recalculate dynamic points
    challenge.solve_count = (challenge.solve_count || 0) + 1;
    const pointsAwarded = scoringService.recomputeChallengePoints(challenge, challenge.solve_count);

    // Save solve
    const solve = {
      id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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
        id: `fb-${Date.now()}`,
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
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
