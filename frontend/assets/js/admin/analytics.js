/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Analytics (assets/js/admin/analytics.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'analytics');
  await window.authManager.requireAdmin('/admin/login.html');

  const catBreakdown = document.getElementById('analyticsCategoryBreakdown');

  try {
    const res = await window.api.admin.getAnalytics();

    document.getElementById('statSolveRate').textContent = `${res.solveRate || 0}%`;
    document.getElementById('statTotalSolves').textContent = res.totalSolves || 0;
    document.getElementById('statTotalSubs').textContent = res.totalSubmissions || 0;

    const stats = res.categoryStats || {};
    const categories = Object.keys(stats);

    if (categories.length === 0) {
      catBreakdown.innerHTML = `<div style="color:var(--text-secondary); font-family:var(--font-mono);">NO SOLVES RECORDED YET.</div>`;
    } else {
      catBreakdown.innerHTML = categories.map(cat => {
        const item = stats[cat];
        return `
          <div style="background:var(--bg-secondary); border:1px solid var(--border); padding:16px; border-radius:var(--radius-sm); margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong style="color:#fff; font-family:var(--font-heading);">${window.Utils.escapeHTML(cat)}</strong>
              <span style="font-family:var(--font-mono); font-size:12px; color:var(--accent);">${item.solves} Solves (${item.count} Challenges)</span>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${Math.min(100, item.solves * 8)}%; background:var(--accent);"></div>
            </div>
          </div>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
});
