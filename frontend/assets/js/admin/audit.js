/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Audit Trail (assets/js/admin/audit.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'audit');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminAuditTableBody');

  async function loadLogs() {
    try {
      const res = await window.api.admin.getAuditLogs();
      const logs = res.logs || [];

      if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-secondary); font-family:var(--font-mono);">AUDIT LOG IS EMPTY.</td></tr>`;
        return;
      }

      tableBody.innerHTML = logs.map(l => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${window.Utils.timeAgo(l.created_at)}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--warning);">[ ${l.action} ]</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:13px; color:#fff;">${window.Utils.escapeHTML(l.target || 'SYSTEM')}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">${l.ip_address || '127.0.0.1'}</td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  loadLogs();
});
