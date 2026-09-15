/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin C2 Authentication (assets/js/admin/login.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  const errBox = document.getElementById('adminLoginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.style.display = 'none';

    // Read credentials exactly as typed — do NOT trim or modify username or password
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    if (!username || !password) {
      errBox.textContent = 'Please provide both Commander callsign and C2 passphrase.';
      errBox.style.display = 'block';
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'VALIDATING C2 KEY...';

    // Clear any previous tokens before admin authentication
    localStorage.removeItem('xploitx_token');
    sessionStorage.removeItem('xploitx_token');

    try {
      // window.api.adminLogin calls /api/v1/admin/auth/login which enforces admin-only
      const res = await window.api.adminLogin({ username, password });

      if (!res || !res.token) {
        throw new Error('No authentication token received from server.');
      }

      if (res.user && res.user.role !== 'ADMIN') {
        throw new Error('ADMIN ACCESS REQUIRED');
      }

      // Save token FIRST — before any optional UI calls that might throw
      localStorage.setItem('xploitx_token', res.token);

      // Show success (optional — if Toast is unavailable, login still works)
      try {
        if (window.showSuccess) window.showSuccess('C2 CLEARANCE VERIFIED // WELCOME COMMANDER');
      } catch (_) {}

      // Redirect to admin dashboard
      setTimeout(() => {
        window.location.href = '/admin/dashboard.html';
      }, 400);

    } catch (err) {
      localStorage.removeItem('xploitx_token');
      sessionStorage.removeItem('xploitx_token');
      const msg = err.message || 'INVALID ADMIN CREDENTIALS';
      errBox.textContent = msg.includes('ADMIN ACCESS REQUIRED')
        ? 'LOGIN DENIED: ADMIN ACCESS REQUIRED'
        : (msg.includes('CLEARANCE_DENIED') ? 'LOGIN DENIED: ADMIN ACCESS REQUIRED' : msg);
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'ACCESS CONTROL ROOM';
    }
  });
});
