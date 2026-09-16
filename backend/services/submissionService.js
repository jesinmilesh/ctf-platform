/**
 * XPLOITX // CYBER BATTLEFIELD
 * Flag Submission Engine & First Blood Detection (backend/services/submissionService.js)
 */

const crypto = require('crypto');
const db = require('../config/database');
const scoringService = require('./scoringService');
const realtimeService = require('./realtimeService');
const auditService = require('./auditService');
const flagVerificationService = require('./flagVerificationService');
const challengeService = require('./challengeService');

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

    // 1. Authoritative Challenge Resolution (Sections 3, 4, 23, 24)
    const challenge = challengeService.resolveChallenge(challengeId);
    if (!challenge) {
      return { success: false, correct: false, status: 'NOT_FOUND', message: 'Mission dossier not found' };
    }

    // Verify challenge publication status
    const isAdmin = user && user.role === 'ADMIN';
    if (challenge.status !== 'PUBLISHED' && challenge.status !== 'LIVE' && !isAdmin) {
      return { success: false, correct: false, status: 'FORBIDDEN', message: 'Mission dossier classified or in draft status' };
    }

    const teamId = user.team_id || (user.team && user.team.id);
    const team = db.getTeams().find(t => t.id === teamId);
    const canonicalChallengeId = challenge.id;
    const challengeIds = challengeService.getChallengeAltIds(challenge);

    // 2. Check if already solved (Sections 35, 36)
    const existingSolve = db.getSolves().find(s =>
      challengeIds.includes(String(s.challenge_id).trim()) &&
      ((teamId && s.team_id === teamId) || (user.id && s.user_id === user.id))
    );
    if (existingSolve) {
      auditService.record({
        action: 'SUBMISSION.ALREADY_SOLVED',
        category: 'SUBMISSION',
        severity: 'NOTICE',
        actor: user,
        resource: { type: 'CHALLENGE', id: canonicalChallengeId, challengeId: canonicalChallengeId },
        result: 'DENIED',
        description: `Duplicate flag submission by ${user.username} for mission "${challenge.title}"`,
        network: { ip },
        metadata: { challengeId: canonicalChallengeId, teamId, status: 'ALREADY_SOLVED' }
      }).catch(() => {});

      return {
        success: false,
        status: 'ALREADY_SOLVED',
        correct: false,
        message: 'MISSION ALREADY SECURED: Flag has previously been captured by your operative squad.'
      };
    }

    // 3. Verify Flag using central FlagVerificationService (Sections 25, 26, 27, 28, 32)
    const verification = flagVerificationService.verifySubmission(challenge, cleanFlag, user);

    if (!verification.correct) {
      const isMalformed = verification.reason === 'MALFORMED_SYNTAX';
      this.recordSubmission({
        challengeId: canonicalChallengeId,
        teamId,
        userId: user.id,
        status: isMalformed ? 'MALFORMED' : 'INCORRECT',
        ip
      });

      auditService.record({
        action: 'SUBMISSION.FLAG_REJECTED',
        category: 'SUBMISSION',
        severity: 'WARNING',
        actor: user,
        resource: { type: 'CHALLENGE', id: canonicalChallengeId, challengeId: canonicalChallengeId },
        result: 'FAILURE',
        description: `${isMalformed ? 'Malformed' : 'Incorrect'} flag rejected for mission "${challenge.title}"`,
        network: { ip },
        metadata: { challengeId: canonicalChallengeId, teamId, reason: verification.reason || 'INCORRECT' }
      }).catch(() => {});

      return {
        success: false,
        correct: false,
        status: isMalformed ? 'MALFORMED' : 'INCORRECT',
        message: 'FLAG REJECTED // CRYPTOGRAPHIC CHECKSUM MISMATCH'
      };
    }

    const isCorrect = true;

    // 5. Handle Incorrect Flag
    if (!isCorrect) {
      this.recordSubmission({
        challengeId: challenge.id,
        teamId,
        userId: user.id,
        status: 'INCORRECT',
        ip
      });

      auditService.record({
        action: 'SUBMISSION.FLAG_REJECTED',
        category: 'SUBMISSION',
        severity: 'WARNING',
        actor: user,
        resource: { type: 'CHALLENGE', id: canonicalChallengeId, challengeId: canonicalChallengeId },
        result: 'FAILURE',
        description: `Incorrect flag rejected for mission "${challenge.title}"`,
        network: { ip },
        metadata: { challengeId: canonicalChallengeId, teamId, status: 'INCORRECT' }
      }).catch(() => {});

      return {
        success: false,
        correct: false,
        status: 'INCORRECT',
        message: 'FLAG REJECTED // CRYPTOGRAPHIC CHECKSUM MISMATCH'
      };
    }

    // 6. Handle Correct Flag Capture with Race-Safe First Blood (Section 16)
    // Synchronous execution block or transactional check prevents simultaneous first-blood claims
    const currentSolves = db.getSolves().filter(s => challengeIds.includes(String(s.challenge_id).trim()));
    const isFirstBlood = currentSolves.length === 0;

    // Recalculate dynamic points
    challenge.solve_count = (challenge.solve_count || 0) + 1;
    const pointsAwarded = scoringService.recomputeChallengePoints(challenge, challenge.solve_count);

    // Save solve
    const solve = {
      id: crypto.randomUUID(),
      challenge_id: canonicalChallengeId,
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
        challenge_id: canonicalChallengeId,
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

    // Record submission (zero plaintext flag stored)
    this.recordSubmission({
      challengeId: challenge.id,
      teamId,
      userId: user.id,
      status: 'CORRECT',
      points: pointsAwarded,
      ip
    });

    auditService.record({
      action: isFirstBlood ? 'SUBMISSION.FIRST_BLOOD' : 'SUBMISSION.FLAG_ACCEPTED',
      category: 'SUBMISSION',
      severity: isFirstBlood ? 'CRITICAL' : 'INFO',
      actor: user,
      resource: { type: 'CHALLENGE', id: canonicalChallengeId, challengeId: canonicalChallengeId },
      result: 'SUCCESS',
      description: `${isFirstBlood ? 'FIRST BLOOD! ' : ''}Flag accepted for "${challenge.title}" (+${pointsAwarded} XP)`,
      network: { ip },
      metadata: { challengeId: canonicalChallengeId, teamId, isFirstBlood, pointsAwarded }
    }).catch(() => {});

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
      points: pointsAwarded,
      pointsAwarded,
      points_awarded: pointsAwarded,
      isFirstBlood,
      is_first_blood: isFirstBlood,
      message: isFirstBlood ? 'FIRST BLOOD CAPTURED! EXCELLENT EXECUTION!' : 'MISSION COMPLETE // FLAG CONFIRMED'
    };
  }

  recordSubmission({ challengeId, teamId, userId, status, points = 0, ip }) {
    const sub = {
      id: crypto.randomUUID(),
      challenge_id: challengeId,
      team_id: teamId,
      user_id: userId,
      status,
      points_awarded: points,
      ip_address: ip,
      created_at: new Date().toISOString()
    };
    db.getSubmissions().push(sub);
  }
}

module.exports = new SubmissionService();
