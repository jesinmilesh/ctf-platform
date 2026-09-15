/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Sidebar Component (assets/js/components/sidebar.js)
 */

const Sidebar = {
  render(targetId = 'admin-sidebar-container', activePage = '') {
    const container = document.getElementById(targetId);
    if (!container) return;

    container.innerHTML = `
      <aside class="admin-sidebar">
        <div style="padding:12px 14px; border-bottom:1px solid var(--border); margin-bottom:8px;">
          <div style="font-family:var(--font-display); font-size:12px; font-weight:800; color:var(--danger); letter-spacing:0.1em;">
            C2 // CONTROL ROOM
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">
            TACTICAL OVERWATCH
          </div>
        </div>

        <a href="/admin/dashboard.html" class="admin-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
          <span>📊</span> Overview
        </a>
        <a href="/admin/challenges.html" class="admin-nav-item ${activePage === 'challenges' ? 'active' : ''}">
          <span>🎯</span> Missions
        </a>
        <a href="/admin/challenge-editor.html" class="admin-nav-item ${activePage === 'challenge-editor' ? 'active' : ''}">
          <span>🛠️</span> Mission Studio
        </a>
        <a href="/admin/categories.html" class="admin-nav-item ${activePage === 'categories' ? 'active' : ''}">
          <span>📁</span> Categories
        </a>
        <a href="/admin/users.html" class="admin-nav-item ${activePage === 'users' ? 'active' : ''}">
          <span>👤</span> Operatives
        </a>
        <a href="/admin/teams.html" class="admin-nav-item ${activePage === 'teams' ? 'active' : ''}">
          <span>🛡️</span> Squads
        </a>
        <a href="/admin/submissions.html" class="admin-nav-item ${activePage === 'submissions' ? 'active' : ''}">
          <span>📡</span> Submissions
        </a>
        <a href="/admin/scoreboard.html" class="admin-nav-item ${activePage === 'scoreboard' ? 'active' : ''}">
          <span>🏆</span> Scoreboard
        </a>
        <a href="/admin/announcements.html" class="admin-nav-item ${activePage === 'announcements' ? 'active' : ''}">
          <span>📢</span> Broadcasts
        </a>
        <a href="/admin/analytics.html" class="admin-nav-item ${activePage === 'analytics' ? 'active' : ''}">
          <span>📈</span> Analytics
        </a>
        <a href="/admin/instances.html" class="admin-nav-item ${activePage === 'instances' ? 'active' : ''}">
          <span>🐳</span> Sandboxes
        </a>
        <a href="/admin/action-logs.html" class="admin-nav-item ${activePage === 'action-logs' || activePage === 'audit' ? 'active' : ''}">
          <span>📜</span> Action Logs
        </a>
        <a href="/admin/settings.html" class="admin-nav-item ${activePage === 'settings' ? 'active' : ''}">
          <span>⚙️</span> Settings
        </a>

        <div style="margin-top:20px; padding-top:12px; border-top:1px solid var(--border); display:flex; flex-direction:column; gap:6px;">
          <a href="/dashboard.html" class="admin-nav-item" style="color:var(--accent);">
            <span>👁️</span> Public Portal
          </a>
          <button id="adminSignOutBtn" class="admin-nav-item" style="background:none; border:none; color:var(--danger); cursor:pointer; text-align:left;">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
    `;

    const signout = container.querySelector('#adminSignOutBtn');
    if (signout) {
      signout.addEventListener('click', async () => {
        try { await window.api.logout(); } catch(e) {}
        localStorage.removeItem('xploitx_token');
        window.location.href = '/admin/login.html';
      });
    }
  }
};

window.Sidebar = Sidebar;
