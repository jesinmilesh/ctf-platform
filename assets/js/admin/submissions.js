/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Submissions Stream (assets/js/admin/submissions.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'submissions');
  await window.authManager.requireAdmin('/admin/login.html');

  const tableBody = document.getElementById('adminSubsTableBody');
  const filterSelect = document.getElementById('subsFilterStatus');

  let allSubs = [];

  function renderRows() {
    const filter = filterSelect.value;
    const filtered = filter ? allSubs.filter(s => s.status === filter) : allSubs;

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-secondary); font-family:var(--font-mono);">NO SUBMISSIONS MATCHING FILTER.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(s => {
      const isCorrect = s.status === 'CORRECT';
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">${window.Utils.timeAgo(s.timestamp)}</td>
          <td style="padding:12px 16px; font-family:var(--font-heading); font-weight:700; color:#fff;">${window.Utils.escapeHTML(s.username)} <span style="color:var(--text-secondary); font-size:11px;">[${window.Utils.escapeHTML(s.teamName)}]</span></td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--cyan);">${window.Utils.escapeHTML(s.challengeTitle)}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:#fff;"><code>${window.Utils.escapeHTML(s.flag)}</code></td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; font-weight:700; color:${isCorrect ? 'var(--accent)' : 'var(--danger)'};">${s.status}</td>
          <td style="padding:12px 16px; font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">${s.ip || '127.0.0.1'}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadSubmissions() {
    try {
      const res = await window.api.admin.getSubmissions();
      allSubs = res.submissions || [];
      renderRows();
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  }

  filterSelect.addEventListener('change', renderRows);
  loadSubmissions();

  if (window.tacticalSocket) {
    window.tacticalSocket.on('SCORE_UPDATED', loadSubmissions);
  }
});
