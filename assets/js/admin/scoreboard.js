/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Scoreboard Control (assets/js/admin/scoreboard.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'scoreboard');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableSlot = document.getElementById('adminScoreboardSlot');

  async function loadScoreboard() {
    try {
      const data = await window.api.getScoreboard();
      tableSlot.innerHTML = Leaderboard.renderTable(data.teams);
    } catch (err) {
      console.error('Failed to load scoreboard:', err);
    }
  }

  loadScoreboard();
});
