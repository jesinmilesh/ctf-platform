/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Squads Management (assets/js/admin/teams.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'teams');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminTeamsTableBody');

  async function loadTeams() {
    try {
      const res = await window.api.admin.getTeams();
      const list = res.teams || [];

      tableBody.innerHTML = list.map(t => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">
            ${window.Utils.escapeHTML(t.name)}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan);">
            ${t.access_code}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:700;">
            ${window.Utils.formatXP(t.total_score)}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
            ${t.solves_count || 0}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--danger); font-weight:700;">
            ${t.first_bloods || 0}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px;">
            <span style="color:${t.is_disqualified ? 'var(--danger)' : 'var(--accent)'}; font-weight:700;">
              ${t.is_disqualified ? 'DISQUALIFIED' : 'ACTIVE'}
            </span>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  }

  loadTeams();
});
