/**
 * XPLOITX // CYBER BATTLEFIELD
 * Leaderboard & Scoring Telemetry Service (backend/services/leaderboardService.js)
 */

const db = require('../config/database');

class LeaderboardService {
  getLeaderboard() {
    const teams = db.getTeams().filter(t => !t.is_disqualified);

    // Sort by score DESC, then by earliest last_score_update timestamp ASC
    const sorted = [...teams].sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      const timeA = new Date(a.last_score_update || 0).getTime();
      const timeB = new Date(b.last_score_update || 0).getTime();
      return timeA - timeB;
    });

    const ranked = sorted.map((t, idx) => ({
      rank: idx + 1,
      id: t.id,
      name: t.name,
      slug: t.slug,
      score: t.total_score,
      solves: t.solves_count || 0,
      solvesCount: t.solves_count || 0,
      firstBloods: t.first_bloods || 0,
      first_bloods: t.first_bloods || 0,
      lastScoreUpdate: t.last_score_update
    }));

    const top3 = ranked.slice(0, 3);

    return {
      teams: ranked,
      leaderboard: ranked,
      podium: {
        first: top3[0] || null,
        second: top3[1] || null,
        third: top3[2] || null
      },
      totalOperatives: db.getUsers().length,
      totalTeams: teams.length,
      updatedAt: new Date().toISOString()
    };
  }

  getScoreHistory() {
    const solves = db.getSolves();
    const teams = db.getTeams();

    // Group solves chronologically by team
    const timeline = [];
    for (const solve of solves) {
      const team = teams.find(t => t.id === solve.team_id);
      timeline.push({
        teamId: solve.team_id,
        teamName: team ? team.name : 'Unknown',
        points: solve.points_awarded,
        timestamp: solve.solved_at
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return { timeline };
  }
}

module.exports = new LeaderboardService();
