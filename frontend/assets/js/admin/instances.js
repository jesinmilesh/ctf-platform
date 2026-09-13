/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Sandboxes & Containers (assets/js/admin/instances.js)
 * Implements Section 30 of Architectural Blueprint
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'instances');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminInstancesTableBody');

  async function loadInstances() {
    try {
      const res = await window.api.admin.getInstances();
      const list = res.instances || [];

      if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-secondary); font-family:var(--font-mono);">NO ACTIVE INSTANCES</td></tr>`;
        return;
      }

      tableBody.innerHTML = list.map(inst => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan);">${inst.container_id || inst.id}</td>
          <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">${window.Utils.escapeHTML(inst.challengeTitle)}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${window.Utils.escapeHTML(inst.teamName)}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:700;">${inst.host}:${inst.port}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:${inst.status === 'RUNNING' ? 'var(--accent)' : 'var(--danger)'};">${inst.status}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${window.Utils.timeAgo(inst.created_at)}</td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Failed to load instances:', err);
    }
  }

  loadInstances();
});
