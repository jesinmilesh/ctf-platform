/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Intel Dispatcher (assets/js/admin/announcements.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'announcements');
  await window.authManager.requireAdmin('/admin/login.html');

  const form = document.getElementById('dispatchAnnouncementForm');
  const streamSlot = document.getElementById('adminAnnouncementsHistory');

  async function loadAnnouncements() {
    try {
      const res = await window.api.getAnnouncements();
      const list = res.announcements || [];

      streamSlot.innerHTML = list.map(a => `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ${a.urgent ? 'var(--danger)' : 'var(--cyan)'}; padding:14px; border-radius:var(--radius-sm); margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:#fff; font-family:var(--font-heading);">${window.Utils.escapeHTML(a.title)}</strong>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${window.Utils.timeAgo(a.created_at)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.5;">${window.Utils.escapeHTML(a.content)}</div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load announcements:', err);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('annTitle').value.trim();
    const content = document.getElementById('annContent').value.trim();
    const urgent = document.getElementById('annUrgent').checked;

    try {
      await window.api.admin.dispatchAnnouncement({ title, content, urgent });
      window.showSuccess('INTEL BROADCAST DISPATCHED OVER C2 GRID');
      form.reset();
      loadAnnouncements();
    } catch (err) {
      window.showError(err.message);
    }
  });

  loadAnnouncements();
});
