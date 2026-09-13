/**
 * XPLOITX // CYBER BATTLEFIELD
 * Participant Command Center HUD (assets/js/public/dashboard.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'dashboard');

  await window.authManager.requireAuth('/login.html');
  const user = window.authManager.getUser();

  try {
    const [meRes, challengesRes, lbRes] = await Promise.all([
      window.api.getMe().catch(() => ({ user })),
      window.api.getChallenges().catch(() => ({ challenges: [] })),
      window.api.getScoreboard().catch(() => ({ teams: [] }))
    ]);

    const activeUser = meRes.user || user;

    // Header Callsign & Status
    const callsignEl = document.getElementById('hudCallsign');
    if (callsignEl) callsignEl.textContent = activeUser.callsign || activeUser.username;

    const affiliationEl = document.getElementById('hudAffiliation');
    if (affiliationEl) affiliationEl.textContent = activeUser.affiliation || 'Independent Operative';

    // Squad & Rank Detection
    let squadName = 'SOLO OPERATIVE';
    let rankDisplay = '#--';
    let teamScore = activeUser.totalPoints || 0;
    let solvesCount = activeUser.solvesCount || 0;

    if (activeUser.team) {
      squadName = activeUser.team.name;
      teamScore = activeUser.team.score || 0;
      solvesCount = activeUser.team.solvesCount || solvesCount;

      const teamRankIdx = lbRes.teams.findIndex(t => t.id === activeUser.team.id);
      if (teamRankIdx !== -1) {
        rankDisplay = `#${String(teamRankIdx + 1).padStart(2, '0')}`;
      }
    }

    const squadEl = document.getElementById('hudSquad');
    if (squadEl) squadEl.textContent = squadName;

    // Metric Cards
    const metricsSlot = document.getElementById('hudMetricsSlot');
    if (metricsSlot) {
      metricsSlot.innerHTML = [
        ScoreCard.render({ label: 'CURRENT RANK', value: rankDisplay, subtext: 'TACTICAL STANDINGS', accentColor: 'var(--gold)', icon: '🏆' }),
        ScoreCard.render({ label: 'TOTAL XP SCORE', value: window.Utils.formatXP(teamScore), subtext: 'ACCUMULATED TELEMETRY', accentColor: 'var(--accent)', icon: '⚡' }),
        ScoreCard.render({ label: 'FLAGS CAPTURED', value: solvesCount, subtext: 'VERIFIED SOLVES', accentColor: 'var(--cyan)', icon: '🚩' }),
        ScoreCard.render({ label: 'FIRST BLOODS', value: activeUser.team ? (activeUser.team.firstBloods || 0) : 0, subtext: 'APEX CAPTURES', accentColor: 'var(--danger)', icon: '🩸' })
      ].join('');
    }

    // Active Target Operations
    const missionsGrid = document.getElementById('hudMissionsSlot');
    if (missionsGrid && challengesRes.challenges) {
      const unsolved = challengesRes.challenges.filter(c => !c.is_solved);
      const toShow = unsolved.length > 0 ? unsolved.slice(0, 3) : challengesRes.challenges.slice(0, 3);
      missionsGrid.innerHTML = toShow.map(c => ChallengeCard.render(c)).join('');
    }

  } catch (err) {
    console.error('Dashboard init error:', err);
  }
});
