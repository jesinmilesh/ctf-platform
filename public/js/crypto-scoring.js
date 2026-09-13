/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dynamic Scoring & Flag Validation Engine
 */

class ScoringEngine {
  /**
   * Quadratic point decay model
   * @param {number} basePoints - Starting points (default: 500)
   * @param {number} minPoints - Minimum floor (default: 100)
   * @param {number} decayThreshold - Number of solves to reach minPoints (default: 30)
   * @param {number} solveCount - Total valid solves recorded
   */
  static calculatePoints(basePoints = 500, minPoints = 100, decayThreshold = 30, solveCount = 0) {
    if (solveCount <= 1) return basePoints;
    if (solveCount >= decayThreshold) return minPoints;

    const progress = (solveCount - 1) / (decayThreshold - 1);
    const decay = (minPoints - basePoints) * Math.pow(progress, 2);
    return Math.round(basePoints + decay);
  }

  /**
   * Recalculate dynamic scores across all active challenges and teams
   */
  static recomputeLeaderboard(challenges, teams, solves, hintsUnlocked = []) {
    // 1. Calculate current points for each challenge based on its solve count
    const challengePointsMap = {};
    challenges.forEach(ch => {
      const chSolves = solves.filter(s => s.challengeId === ch.id);
      const points = this.calculatePoints(
        ch.basePoints || 500,
        ch.minimumPoints || 100,
        ch.decayThreshold || 30,
        chSolves.length
      );
      challengePointsMap[ch.id] = points;
      ch.currentPoints = points;
      ch.solveCount = chSolves.length;
    });

    // 2. Tally points per team (solves + first blood bonus - hints cost)
    const teamScores = {};
    teams.forEach(t => {
      teamScores[t.id] = {
        id: t.id,
        name: t.name,
        slug: t.slug,
        score: 0,
        solvesCount: 0,
        firstBloods: 0,
        lastSolveTime: t.createdAt || 0
      };
    });

    // Process Solves
    solves.forEach(solve => {
      if (teamScores[solve.teamId]) {
        const pts = challengePointsMap[solve.challengeId] || 500;
        teamScores[solve.teamId].score += pts;
        teamScores[solve.teamId].solvesCount += 1;
        if (solve.isFirstBlood) {
          teamScores[solve.teamId].firstBloods += 1;
        }
        if (solve.timestamp > teamScores[solve.teamId].lastSolveTime) {
          teamScores[solve.teamId].lastSolveTime = solve.timestamp;
        }
      }
    });

    // Deduct Hint Penalties
    hintsUnlocked.forEach(h => {
      if (teamScores[h.teamId]) {
        teamScores[h.teamId].score = Math.max(0, teamScores[h.teamId].score - (h.cost || 0));
      }
    });

    // 3. Rank teams (higher score first, tie-break by earlier lastSolveTime)
    const rankedTeams = Object.values(teamScores).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.lastSolveTime - b.lastSolveTime;
    });

    rankedTeams.forEach((t, idx) => {
      t.rank = idx + 1;
    });

    return { rankedTeams, challengePointsMap };
  }
}

class FlagValidator {
  /**
   * Validate submitted flag against challenge definition
   */
  static validate(submitted, challenge, teamId = 'team-nexus') {
    if (!submitted || typeof submitted !== 'string') {
      return { valid: false, reason: 'EMPTY_FLAG' };
    }

    const cleanInput = submitted.trim();

    // Verify prefix and suffix (e.g. XploitX{...})
    const prefix = challenge.flagPrefix || 'XploitX{';
    const suffix = challenge.flagSuffix || '}';

    if (!cleanInput.startsWith(prefix) || !cleanInput.endsWith(suffix)) {
      return { 
        valid: false, 
        reason: 'INVALID_FORMAT', 
        message: `Flag format must begin with ${prefix} and terminate with ${suffix}` 
      };
    }

    // Static Flag Matching
    if (challenge.flagType === 'STATIC') {
      const targetFlag = challenge.flagValue || '';
      const isMatch = challenge.caseSensitive 
        ? cleanInput === targetFlag 
        : cleanInput.toLowerCase() === targetFlag.toLowerCase();

      return { valid: isMatch, reason: isMatch ? 'SUCCESS' : 'INCORRECT' };
    }

    // Regex Flag Matching
    if (challenge.flagType === 'REGEX') {
      try {
        const regex = new RegExp(challenge.flagValue, challenge.caseSensitive ? '' : 'i');
        const isMatch = regex.test(cleanInput);
        return { valid: isMatch, reason: isMatch ? 'SUCCESS' : 'INCORRECT' };
      } catch (e) {
        return { valid: false, reason: 'REGEX_ERROR' };
      }
    }

    // Dynamic HMAC Flag
    if (challenge.flagType === 'DYNAMIC_HMAC') {
      const dynamicExpected = `XploitX{${challenge.slug}_${teamId.slice(-4)}_captured}`;
      const isMatch = cleanInput === dynamicExpected;
      return { valid: isMatch, reason: isMatch ? 'SUCCESS' : 'INCORRECT' };
    }

    return { valid: false, reason: 'UNKNOWN_TYPE' };
  }
}

window.ScoringEngine = ScoringEngine;
window.FlagValidator = FlagValidator;
