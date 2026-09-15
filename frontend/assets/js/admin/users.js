/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Operatives Management (assets/js/admin/users.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'users');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminUsersTableBody');

  async function loadUsers() {
    try {
      const res = await window.api.admin.getUsers();
      const list = res.users || [];

      tableBody.innerHTML = list.map(u => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">
            ${window.Utils.escapeHTML(u.callsign || u.username)}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
            ${window.Utils.escapeHTML(u.username)}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">
            ${window.Utils.escapeHTML(u.email)}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan); font-weight:700;">
            ${u.role}
          </td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px;">
            <span style="color:${u.is_banned ? 'var(--danger)' : 'var(--accent)'}; font-weight:700;">
              ${u.is_banned ? 'BANNED' : 'ACTIVE'}
            </span>
          </td>
          <td style="padding:12px 16px; display:flex; gap:6px; align-items:center;">
            <button class="btn btn-sm btn-outline" style="${u.is_banned ? 'color:var(--accent); border-color:var(--accent);' : 'color:var(--danger); border-color:var(--danger);'}" onclick="toggleBan('${u.id}')">
              ${u.is_banned ? 'UNBAN' : 'BAN'}
            </button>
            <a href="/admin/action-logs.html?userId=${encodeURIComponent(u.id)}" class="btn btn-sm btn-outline" style="text-decoration:none; font-size:11px; color:var(--text-secondary);">
              ACTIVITY
            </a>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  window.toggleBan = async (id) => {
    try {
      await window.api.admin.toggleUserBan(id);
      window.showSuccess('OPERATIVE STATUS MODIFIED');
      loadUsers();
    } catch (err) {
      window.showError(err.message);
    }
  };

  loadUsers();
});
