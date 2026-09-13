/**
 * XPLOITX // CYBER BATTLEFIELD
 * Scoring Engine & Decay Algorithm (backend/services/scoringService.js)
 */

class ScoringService {
  /**
   * Quadratic / Exponential Dynamic Scoring Decay
   * points = Math.max(min, Math.round(min + (base - min) * (((decay - 1) / (decay - 1 + solves - 1)) ** 2)))
   */
  calculatePoints(basePoints, minimumPoints, decayThreshold, solveCount) {
    if (!solveCount || solveCount <= 1) {
      return basePoints;
    }
    if (solveCount >= decayThreshold) {
      return minimumPoints;
    }

    const d = decayThreshold - 1;
    const s = solveCount - 1;
    const ratio = d / (d + s);
    const decayed = minimumPoints + (basePoints - minimumPoints) * Math.pow(ratio, 2);

    return Math.max(minimumPoints, Math.round(decayed));
  }

  /**
   * Recompute points for all challenges and update team scores accordingly
   */
  recomputeChallengePoints(challenge, solvesCount) {
    const newPoints = this.calculatePoints(
      challenge.base_points || 500,
      challenge.minimum_points || 100,
      challenge.decay_threshold || 30,
      solvesCount
    );
    challenge.current_points = newPoints;
    challenge.solve_count = solvesCount;
    return newPoints;
  }
}

module.exports = new ScoringService();
