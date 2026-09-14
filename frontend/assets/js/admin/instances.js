/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Sandboxes & Containers (assets/js/admin/instances.js)
 * Implements Section 25 of Architectural Specification:
 * - Real live instance listing from backend
 * - Real admin actions: View, Stop, Destroy
 * - Clean empty state: NO ACTIVE INSTANCES
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
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-secondary); font-family:var(--font-mono); font-weight:700;">NO ACTIVE INSTANCES</td></tr>`;
        return;
      }

      tableBody.innerHTML = list.map(inst => {
        const instId = inst.instanceId || inst.id;
        const shortContainerId = inst.containerId || inst.container_id ? String(inst.containerId || inst.container_id).substring(0, 12) : '---';
        const isRunning = inst.status === 'RUNNING';
        const healthColor = inst.healthCheckStatus === 'HEALTHY' || isRunning ? 'var(--accent)' : 'var(--warning)';
        const targetUrl = inst.url || `http://${inst.host || '127.0.0.1'}:${inst.port}`;

        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan); font-weight:700;">${instId}</td>
            <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">${window.Utils.escapeHTML(inst.challengeTitle || 'Mission')}</td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${window.Utils.escapeHTML(inst.teamName || 'Solo Operative')}</td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);"><code style="font-size:11px;">${shortContainerId}</code></td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:700;">${inst.port}</td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; font-weight:700; color:${isRunning ? 'var(--accent)' : 'var(--danger)'};">${inst.status}</td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:11px; color:${healthColor}; font-weight:700;">${inst.healthCheckStatus || (isRunning ? 'HEALTHY' : 'PENDING')}</td>
            <td style="padding:12px 16px; font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${inst.expiresAt || inst.expires_at ? window.Utils.timeAgo(inst.expiresAt || inst.expires_at) : '---'}</td>
            <td style="padding:12px 16px; text-align:right;">
              <div style="display:inline-flex; gap:6px;">
                <button type="button" class="btn btn-xs btn-outline" onclick="window.open('${targetUrl}', '_blank')" ${!isRunning ? 'disabled' : ''}>
                  VIEW
                </button>
                <button type="button" class="btn btn-xs btn-outline" style="color:var(--warning); border-color:var(--warning);" onclick="window.terminateInstanceAdmin('${instId}', 'STOP')">
                  STOP
                </button>
                <button type="button" class="btn btn-xs btn-outline" style="color:var(--danger); border-color:var(--danger);" onclick="window.terminateInstanceAdmin('${instId}', 'DESTROY')">
                  DESTROY
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load instances:', err);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--danger); font-family:var(--font-mono);">FAILED TO POLL CONTAINER RUNTIME</td></tr>`;
    }
  }

  window.terminateInstanceAdmin = async (instanceId, actionName) => {
    if (!confirm(`Are you sure you want to ${actionName} instance ${instanceId}?`)) return;
    try {
      await window.api.instances.terminate(instanceId);
      if (window.showSuccess) window.showSuccess(`INSTANCE ${instanceId} NEUTRALIZED`);
      await loadInstances();
    } catch (err) {
      if (window.showError) window.showError(err.message || 'Termination failed');
    }
  };

  loadInstances();
});
