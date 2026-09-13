/**
 * XPLOITX // CYBER BATTLEFIELD
 * Home Page Logic (assets/js/public/home.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'home');

  try {
    // 1. Fetch telemetry & leaderboard
    const [statusRes, compRes, lbRes, chRes] = await Promise.all([
      window.api.getStatus().catch(() => null),
      window.api.getCompetition().catch(() => null),
      window.api.getScoreboard().catch(() => null),
      window.api.getChallenges().catch(() => ({ challenges: [] }))
    ]);

    // Update Telemetry Grid
    if (statusRes) {
      const liveOps = document.getElementById('statLiveOperatives');
      if (liveOps) liveOps.textContent = statusRes.liveOperativesConnected || 1;
    }

    if (lbRes) {
      const activeOps = document.getElementById('statTotalOperatives');
      if (activeOps) activeOps.textContent = lbRes.totalOperatives || 342;

      const totalSquads = document.getElementById('statTotalSquads');
      if (totalSquads) totalSquads.textContent = lbRes.totalTeams || 4;

      // Render Mini Leaderboard Preview
      const lbPreview = document.getElementById('homeLeaderboardPreview');
      if (lbPreview && lbRes.teams) {
        lbPreview.innerHTML = Leaderboard.renderTable(lbRes.teams.slice(0, 5));
      }
    }

    if (chRes && chRes.challenges) {
      const missionsCount = document.getElementById('statTotalMissions');
      if (missionsCount) missionsCount.textContent = chRes.challenges.length;

      const solvesCount = document.getElementById('statTotalSolves');
      if (solvesCount) {
        const total = chRes.challenges.reduce((acc, c) => acc + (c.solve_count || 0), 0);
        solvesCount.textContent = total;
      }

      // Featured Challenges
      const featuredGrid = document.getElementById('homeFeaturedChallenges');
      if (featuredGrid) {
        featuredGrid.innerHTML = chRes.challenges.slice(0, 3).map(c => ChallengeCard.render(c)).join('');
      }
    }

    // Dynamic Flag Prefix display
    if (compRes && compRes.competition) {
      const prefixEl = document.getElementById('homeFlagPrefix');
      if (prefixEl) prefixEl.textContent = compRes.competition.flagPrefix || 'XploitXβ{';
    }

  } catch (err) {
    console.error('Home initialization error:', err);
  }
});
