/**
 * XPLOITX // CYBER BATTLEFIELD
 * Tactical Navbar Component (assets/js/components/navbar.js)
 */

const Navbar = {
  render(targetId = 'navbar-container', activePage = '') {
    const container = document.getElementById(targetId);
    if (!container) return;

    container.innerHTML = `
      <nav class="tactical-navbar">
        <div class="container navbar-inner">
          <div style="display:flex; align-items:center; gap:20px;">
            <a href="/" class="brand-logo" style="text-decoration:none;">
              <span style="display:inline-block; width:10px; height:10px; background:var(--accent); border-radius:2px; box-shadow:0 0 10px var(--accent);"></span>
              <span>XPLOITX</span>
              <span class="brand-badge">BATTLEFIELD</span>
            </a>
          </div>

          <!-- Desktop Navigation Links -->
          <div class="nav-links" id="desktopNavLinks">
            <a href="/dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">COMMAND</a>
            <a href="/challenges.html" class="nav-link ${activePage === 'challenges' ? 'active' : ''}">MISSIONS</a>
            <a href="/scoreboard.html" class="nav-link ${activePage === 'scoreboard' ? 'active' : ''}">SCOREBOARD</a>
            <a href="/team.html" class="nav-link ${activePage === 'team' ? 'active' : ''}">SQUAD</a>
            <a href="/activity.html" class="nav-link ${activePage === 'activity' ? 'active' : ''}">FEED</a>
            <a href="/announcements.html" class="nav-link ${activePage === 'announcements' ? 'active' : ''}">INTEL</a>
            <a href="/rules.html" class="nav-link ${activePage === 'rules' ? 'active' : ''}">RULES</a>
          </div>

          <!-- Right Action Slot (Operative status / Auth buttons) -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-right:8px;">
              <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px var(--accent-glow);"></span>
              <span class="desktop-only">LIVE</span>
            </div>
            <div id="navUserSlot" style="display:flex; align-items:center; gap:8px;">
              <a href="/login.html" class="nav-link">LOGIN</a>
              <a href="/register.html" class="btn btn-sm btn-primary">REGISTER</a>
            </div>
            <!-- Mobile Menu Toggle Button -->
            <button id="mobileNavToggle" class="mobile-only" style="background:none; border:1px solid var(--border); color:#fff; padding:6px 10px; border-radius:var(--radius-sm); cursor:pointer;">
              ☰
            </button>
          </div>
        </div>

        <!-- Mobile Drawer -->
        <div id="mobileNavDrawer" style="display:none; background:var(--bg-secondary); border-bottom:1px solid var(--border); padding:16px 20px;">
          <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="/dashboard.html" class="nav-link">COMMAND CENTER</a>
            <a href="/challenges.html" class="nav-link">MISSIONS</a>
            <a href="/scoreboard.html" class="nav-link">SCOREBOARD</a>
            <a href="/team.html" class="nav-link">SQUAD</a>
            <a href="/activity.html" class="nav-link">FEED</a>
            <a href="/announcements.html" class="nav-link">INTEL</a>
            <a href="/rules.html" class="nav-link">RULES</a>
          </div>
        </div>
      </nav>
    `;

    // Mobile Toggle
    const toggle = container.querySelector('#mobileNavToggle');
    const drawer = container.querySelector('#mobileNavDrawer');
    if (toggle && drawer) {
      toggle.addEventListener('click', () => {
        const isHidden = drawer.style.display === 'none';
        drawer.style.display = isHidden ? 'block' : 'none';
      });
    }

    // Trigger auth state update
    if (window.authManager) {
      window.authManager.init().then(() => {
        window.authManager.updateNavUI();
      });
    }
  }
};

window.Navbar = Navbar;
