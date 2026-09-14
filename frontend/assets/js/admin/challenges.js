/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Challenges Operations (assets/js/admin/challenges.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'challenges');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminChallengesTableBody');

  async function loadChallenges() {
    try {
      const res = await window.api.admin.getChallenges();
      const list = res.challenges || [];

      if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary); font-family:var(--font-mono);">NO MISSIONS CREATED YET.</td></tr>`;
        return;
      }

      tableBody.innerHTML = list.map(c => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${window.Utils.escapeHTML(c.mission_id || c.id)}</td>
          <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">
            <a href="/challenge.html?id=${encodeURIComponent(c.id)}" target="_blank" style="color:#fff; text-decoration:none;" title="Open in Participant Portal">
              ${window.Utils.escapeHTML(c.title)} ↗
            </a>
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan);">${window.Utils.escapeHTML(c.category_name || c.category || 'MISC')}</td>
          <td style="padding:12px 16px;">${window.Utils.getDifficultyBadge(c.difficulty)}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:700;">${c.current_points || c.base_points} XP</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${c.solve_count || 0}</td>
          <td style="padding:12px 16px;">
            <div style="display:flex; gap:6px;">
              <a href="/challenge.html?id=${encodeURIComponent(c.id)}" target="_blank" class="btn btn-sm btn-outline" style="color:var(--accent); border-color:var(--accent); text-decoration:none;">VIEW</a>
              <a href="/admin/challenge-editor.html?id=${encodeURIComponent(c.id)}" class="btn btn-sm btn-outline" style="text-decoration:none;">EDIT</a>
              <button class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="deleteMission('${c.id}')">DELETE</button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Failed to load admin challenges:', err);
    }
  }

  window.deleteMission = async (id) => {
    if (confirm('Neutralize and delete this mission dossier? This will remove all solve history for this target.')) {
      try {
        await window.api.admin.deleteChallenge(id);
        window.showSuccess('MISSION DELETED');
        loadChallenges();
      } catch (err) {
        window.showError(err.message);
      }
    }
  };

  loadChallenges();
});
