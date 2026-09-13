/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Dashboard (assets/js/admin/dashboard.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'dashboard');
  await window.authManager.requireAdmin('/admin/login.html');

  try {
    const [overviewRes, subsRes, logsRes] = await Promise.all([
      window.api.admin.getOverview(),
      window.api.admin.getSubmissions().catch(() => ({ submissions: [] })),
      window.api.admin.getAuditLogs().catch(() => ({ logs: [] }))
    ]);

    const stats = overviewRes.stats || {};
    document.getElementById('statOperatives').textContent = stats.activeOperatives || 0;
    document.getElementById('statSquads').textContent = stats.squads || 0;
    document.getElementById('statMissions').textContent = stats.totalMissions || 0;
    document.getElementById('statSolves').textContent = stats.flagsCaptured || 0;
    document.getElementById('statSubmissions').textContent = stats.totalSubmissions || 0;
    document.getElementById('statSandboxes').textContent = stats.activeSandboxes || 0;

    // Recent Submissions Mini Feed
    const subsSlot = document.getElementById('adminRecentSubsSlot');
    if (subsSlot && subsRes.submissions) {
      const recent = subsRes.submissions.slice(0, 6);
      subsSlot.innerHTML = recent.map(s => {
        const isCorrect = s.status === 'CORRECT';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px; font-family:var(--font-mono); font-size:12px;">
            <div>
              <strong style="color:#fff;">${window.Utils.escapeHTML(s.username)}</strong>
              <span style="color:var(--text-secondary);">(${window.Utils.escapeHTML(s.teamName)})</span>
              <span style="color:var(--cyan); margin-left:6px;">${window.Utils.escapeHTML(s.challengeTitle)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="color:${isCorrect ? 'var(--accent)' : 'var(--danger)'}; font-weight:700;">${s.status}</span>
              <span style="color:var(--text-muted); font-size:11px;">${window.Utils.timeAgo(s.timestamp)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Recent Audit Logs Mini Feed
    const auditSlot = document.getElementById('adminRecentAuditSlot');
    if (auditSlot && logsRes.logs) {
      const recentLogs = logsRes.logs.slice(0, 6);
      auditSlot.innerHTML = recentLogs.map(l => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px; font-family:var(--font-mono); font-size:12px;">
          <div>
            <span style="color:var(--warning); font-weight:700;">[ ${l.action} ]</span>
            <span style="color:#fff; margin-left:8px;">${window.Utils.escapeHTML(l.target || '')}</span>
          </div>
          <span style="color:var(--text-muted); font-size:11px;">${window.Utils.timeAgo(l.created_at)}</span>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Failed to load admin dashboard:', err);
  }
});
