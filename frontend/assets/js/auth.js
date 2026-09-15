/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication State Manager (assets/js/auth.js)
 */

class AuthManager {
  constructor() {
    this.user = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return this.user;
    try {
      const res = await window.api.getMe();
      if (res && res.user) {
        this.user = res.user;
      }
    } catch (e) {
      this.user = null;
    }
    this.initialized = true;
    this.updateNavUI();
    return this.user;
  }

  getUser() {
    return this.user;
  }

  isLoggedIn() {
    return !!this.user;
  }

  isAdmin() {
    return this.user && (this.user.role === 'ADMIN' || this.user.role === 'SUPER_ADMIN');
  }

  async requireAuth(redirectUrl = '/login.html') {
    await this.init();
    if (!this.isLoggedIn()) {
      window.location.href = redirectUrl;
    }
  }

  async requireAdmin(redirectUrl = '/admin/login.html') {
    try {
      const res = await (window.api && window.api.admin && window.api.admin.me ? window.api.admin.me() : window.apiRequest('/admin/me'));
      if (res && res.user && (res.user.role === 'ADMIN' || res.user.role === 'SUPER_ADMIN')) {
        this.user = res.user;
        this.initialized = true;
        this.updateNavUI();
        return this.user;
      }
      throw new Error('ADMIN_CLEARANCE_DENIED');
    } catch (err) {
      this.user = null;
      window.location.href = redirectUrl;
    }
  }

  updateNavUI() {
    const userContainer = document.getElementById('navUserSlot');
    if (!userContainer) return;

    if (this.user) {
      const callsign = this.user.callsign || this.user.username;
      const teamId = this.user.team?.id || this.user.team?.teamId || '';
      const safe = window.Utils ? window.Utils.escapeHTML : (s) => s;

      const teamBadge = teamId
        ? `<span style="font-family:var(--font-mono); font-size:10px; color:var(--accent); background:rgba(0,255,136,0.1); border:1px solid rgba(0,255,136,0.3); padding:2px 6px; border-radius:3px; margin-left:4px;">${safe(teamId)}</span>`
        : '';

      userContainer.innerHTML = `
        <div class="nav-user-badge" style="display:flex; align-items:center; gap:8px;">
          <a href="/team.html" class="nav-user-link" style="display:flex; align-items:center; gap:6px; text-decoration:none;">
            <span class="status-indicator"></span>
            <span class="user-callsign">${safe(callsign)}</span>
            ${teamBadge}
          </a>
          <button class="btn btn-sm btn-outline" id="navLogoutBtn" title="Sign Out">LOGOUT</button>
        </div>
      `;
      const btn = document.getElementById('navLogoutBtn');
      if (btn) btn.addEventListener('click', () => this.logout());
    } else {
      userContainer.innerHTML = `
        <a href="/login.html" class="nav-link">LOGIN</a>
        <a href="/register.html" class="btn btn-sm btn-primary">REGISTER</a>
      `;
    }
  }

  async logout() {
    const wasAdmin = this.isAdmin();
    try {
      if (wasAdmin && window.api && window.api.admin && window.api.admin.logout) {
        await window.api.admin.logout();
      } else if (window.api && window.api.logout) {
        await window.api.logout();
      }
    } catch (e) {}
    localStorage.removeItem('xploitx_token');
    sessionStorage.removeItem('xploitx_token');
    window.location.href = wasAdmin ? '/admin/login.html' : '/login.html';
  }
}

window.authManager = new AuthManager();

