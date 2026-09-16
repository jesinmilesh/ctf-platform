/**
 * XPLOITX // CYBER BATTLEFIELD
 * Authentication State Manager (assets/js/auth.js)
 */

class AuthManager {
  constructor() {
    this.user = null;
    this.initialized = false;
  }

  async init(forceRefresh = false) {
    if (this.initialized && !forceRefresh) return this.user;
    try {
      const res = await window.api.getMe();
      if (res && res.user) {
        this.user = res.user;
      } else {
        this.user = null;
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
    return this.user && this.user.role === 'ADMIN';
  }

  hasSquad() {
    if (!this.user) return false;
    if (this.isAdmin()) return true;
    return !!(this.user.hasSquad || this.user.has_squad || this.user.team_id || this.user.team);
  }

  getSquadId() {
    if (!this.user) return null;
    return this.user.team?.id || this.user.team?.teamId || this.user.team_id || null;
  }

  async requireAuth(redirectUrl = '/login.html') {
    await this.init();
    if (!this.isLoggedIn()) {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}redirect=${encodeURIComponent(currentPath)}`;
    }
  }

  async requireSquadMembership(redirectUrl = '/team.html?onboarding=1') {
    await this.init(true);
    if (!this.isLoggedIn()) {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
      return null;
    }
    if (this.isAdmin()) {
      return this.user;
    }
    if (!this.hasSquad()) {
      window.location.href = redirectUrl;
      return null;
    }
    return this.user;
  }

  async requireAdmin(redirectUrl = '/admin/login.html') {
    try {
      const res = await (window.api && window.api.admin && window.api.admin.me ? window.api.admin.me() : window.apiRequest('/admin/me'));
      if (res && res.user && res.user.role === 'ADMIN') {
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
      const safe = window.Utils ? window.Utils.escapeHTML : (s) => s;
      const squadId = this.getSquadId();

      let squadBadge = '';
      if (this.isAdmin()) {
        squadBadge = `<span class="squad-badge squad-admin" style="font-family:var(--font-mono); font-size:10px; color:#ff3366; background:rgba(255,51,102,0.15); border:1px solid rgba(255,51,102,0.4); padding:2px 8px; border-radius:3px; font-weight:700; letter-spacing:0.05em; margin-left:6px;">ADMIN</span>`;
      } else if (this.hasSquad()) {
        squadBadge = `<span class="squad-badge squad-joined" style="font-family:var(--font-mono); font-size:10px; color:var(--accent, #00ff88); background:rgba(0,255,136,0.12); border:1px solid rgba(0,255,136,0.35); padding:2px 8px; border-radius:3px; font-weight:700; letter-spacing:0.05em; margin-left:6px;">${safe(squadId || 'SQUAD ACTIVE')}</span>`;
      } else {
        squadBadge = `<span class="squad-badge squad-not-joined" style="font-family:var(--font-mono); font-size:10px; color:var(--danger, #ff3366); background:rgba(255,51,102,0.12); border:1px solid rgba(255,51,102,0.35); padding:2px 8px; border-radius:3px; font-weight:700; letter-spacing:0.05em; margin-left:6px;">SQUAD: NOT JOINED</span>`;
      }

      const teamLinkHref = this.hasSquad() ? '/team.html' : '/team.html?onboarding=1';

      userContainer.innerHTML = `
        <div class="nav-user-badge" style="display:flex; align-items:center; gap:8px;">
          <a href="${teamLinkHref}" class="nav-user-link" style="display:flex; align-items:center; gap:4px; text-decoration:none;">
            <span class="status-indicator"></span>
            <span class="user-callsign">${safe(callsign)}</span>
            ${squadBadge}
          </a>
          <button class="btn btn-sm btn-outline" id="navLogoutBtn" title="Sign Out">LOGOUT</button>
        </div>
      `;
      const btn = document.getElementById('navLogoutBtn');
      if (btn) btn.addEventListener('click', () => this.logout());

      // Update locked visual status across navigation items
      if (window.Navbar && typeof window.Navbar.updateNavLockState === 'function') {
        window.Navbar.updateNavLockState(!this.hasSquad() && !this.isAdmin());
      }
    } else {
      userContainer.innerHTML = `
        <a href="/login.html" class="nav-link">LOGIN</a>
        <a href="/register.html" class="btn btn-sm btn-primary">REGISTER</a>
      `;
      if (window.Navbar && typeof window.Navbar.updateNavLockState === 'function') {
        window.Navbar.updateNavLockState(false);
      }
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

