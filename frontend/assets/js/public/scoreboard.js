/**
 * XPLOITX // CYBER BATTLEFIELD
 * Live Scoreboard Logic (assets/js/public/scoreboard.js)
 * Implements Sections 17 & 18 of Architectural Blueprint
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'scoreboard');

  const user = await window.authManager.requireSquadMembership();
  if (!user) return;

  const podiumSlot = document.getElementById('scoreboardPodiumSlot');
  const tableSlot = document.getElementById('scoreboardTableSlot');
  const lastUpdatedEl = document.getElementById('scoreboardLastUpdated');

  async function refreshScoreboard() {
    try {
      const data = await window.api.getScoreboard();

      if (podiumSlot && data.podium) {
        podiumSlot.innerHTML = Leaderboard.renderPodium(data.podium);
      }

      if (tableSlot && data.teams) {
        tableSlot.innerHTML = Leaderboard.renderTable(data.teams);
      }

      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
      }
    } catch (err) {
      if (err.code === 'SQUAD_REQUIRED' || (err.message && err.message.includes('SQUAD_REQUIRED'))) {
        window.location.href = '/team.html?onboarding=1';
        return;
      }
      console.error('Scoreboard load error:', err);
    }
  }

  await refreshScoreboard();

  // Real-time WebSocket live updates (Section 18)
  if (window.tacticalSocket) {
    window.tacticalSocket.on('SCORE_UPDATED', () => {
      refreshScoreboard();
    });

    window.tacticalSocket.on('FIRST_BLOOD', () => {
      refreshScoreboard();
    });
  }

  // Fallback periodic poll every 15 seconds
  setInterval(refreshScoreboard, 15000);
});
