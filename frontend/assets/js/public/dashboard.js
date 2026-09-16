/**
 * XPLOITX // CYBER BATTLEFIELD
 * Participant Command Center HUD (assets/js/public/dashboard.js)
 *
 * Data flow: GET /auth/me → activeUser → populate HUD
 * No-team guard: users without a squad are redirected to /team.html for onboarding.
 * Source of truth: backend + MongoDB — never localStorage.
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'dashboard');

  const user = await window.authManager.requireSquadMembership();
  if (!user) return; // requireSquadMembership redirected

  try {
    const [meRes, challengesRes, lbRes] = await Promise.all([
      window.api.getMe().catch(() => ({ user })),
      window.api.getChallenges().catch(() => ({ challenges: [] })),
      window.api.getScoreboard().catch(() => ({ teams: [] }))
    ]);

    const activeUser = meRes.user || user;

    // ── Squad Onboarding Guard (Defense-in-depth) ───────────────────────────
    if (!window.authManager.isAdmin() && !activeUser.team_id && !activeUser.hasSquad) {
      window.location.href = '/team.html?onboarding=1';
      return;
    }

    // ── Header: Callsign & Affiliation ──────────────────────────────────────
    const callsignEl = document.getElementById('hudCallsign');
    if (callsignEl) callsignEl.textContent = activeUser.callsign || activeUser.username;

    const affiliationEl = document.getElementById('hudAffiliation');
    if (affiliationEl) affiliationEl.textContent = activeUser.affiliation || 'Independent Operative';

    // ── Squad Info ──────────────────────────────────────────────────────────
    let squadDisplay = 'SOLO OPERATIVE';
    let rankDisplay = '#--';
    let teamScore = activeUser.totalPoints || 0;
    let solvesCount = activeUser.solvesCount || 0;
    let firstBloods = 0;

    if (activeUser.team) {
      const team = activeUser.team;
      // Display: "CYBER WARRIORS · XPX-TEAM-000001"
      const teamId = team.id || team.teamId || '';
      squadDisplay = teamId ? `${team.name} · ${teamId}` : team.name;
      teamScore = team.score || 0;
      solvesCount = team.solvesCount || solvesCount;
      firstBloods = team.firstBloods || 0;

      const teamRankIdx = (lbRes.teams || []).findIndex(t => t.id === team.id);
      if (teamRankIdx !== -1) {
        rankDisplay = `#${String(teamRankIdx + 1).padStart(2, '0')}`;
      }
    }

    const squadEl = document.getElementById('hudSquad');
    if (squadEl) squadEl.textContent = squadDisplay;

    // ── Metric Cards ────────────────────────────────────────────────────────
    const metricsSlot = document.getElementById('hudMetricsSlot');
    if (metricsSlot) {
      metricsSlot.innerHTML = [
        ScoreCard.render({ label: 'CURRENT RANK',  value: rankDisplay,                       subtext: 'TACTICAL STANDINGS',    accentColor: 'var(--gold)',   icon: '🏆' }),
        ScoreCard.render({ label: 'TOTAL XP SCORE', value: window.Utils.formatXP(teamScore), subtext: 'ACCUMULATED TELEMETRY', accentColor: 'var(--accent)', icon: '⚡' }),
        ScoreCard.render({ label: 'FLAGS CAPTURED', value: solvesCount,                      subtext: 'VERIFIED SOLVES',       accentColor: 'var(--cyan)',   icon: '🚩' }),
        ScoreCard.render({ label: 'FIRST BLOODS',   value: firstBloods,                      subtext: 'APEX CAPTURES',         accentColor: 'var(--danger)', icon: '🩸' })
      ].join('');
    }

    // ── Active Missions ─────────────────────────────────────────────────────
    const missionsGrid = document.getElementById('hudMissionsSlot');
    if (missionsGrid && challengesRes.challenges) {
      const unsolved = challengesRes.challenges.filter(c => !c.is_solved);
      const toShow = unsolved.length > 0 ? unsolved.slice(0, 3) : challengesRes.challenges.slice(0, 3);
      if (toShow.length > 0) {
        missionsGrid.innerHTML = toShow.map(c => ChallengeCard.render(c)).join('');
      } else {
        missionsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-secondary); font-family:var(--font-mono); font-size:13px;">NO ACTIVE MISSIONS DEPLOYED YET.</div>`;
      }
    }

  } catch (err) {
    console.error('[DASHBOARD] Init error:', err);
  }
});
