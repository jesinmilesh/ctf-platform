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
    await this.init();
    if (!this.isAdmin()) {
      window.location.href = redirectUrl;
    }
  }

  updateNavUI() {
    const userContainer = document.getElementById('navUserSlot');
    if (!userContainer) return;

    if (this.user) {
      const callsign = this.user.callsign || this.user.username;
      userContainer.innerHTML = `
        <div class="nav-user-badge">
          <a href="/profile.html" class="nav-user-link">
            <span class="status-indicator"></span>
            <span class="user-callsign">${window.Utils ? window.Utils.escapeHTML(callsign) : callsign}</span>
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
    try {
      await window.api.logout();
    } catch (e) {}
    localStorage.removeItem('xploitx_token');
    window.location.href = '/login.html';
  }
}

window.authManager = new AuthManager();
