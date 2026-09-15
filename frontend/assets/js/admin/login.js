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

    // Read credentials exactly as typed — do NOT trim password
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'VALIDATING C2 KEY...';

    // Clear any previous tokens before admin authentication
    localStorage.removeItem('xploitx_token');
    sessionStorage.removeItem('xploitx_token');

    try {
      // window.api.adminLogin calls /api/v1/auth/admin-login which enforces admin-only
      const res = await window.api.adminLogin({ username, password });

      if (!res || !res.token) {
        throw new Error('No authentication token received from server.');
      }

      if (res.user && res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
        throw new Error('CLEARANCE DENIED: Only administrators can access the C2 portal.');
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
      errBox.textContent = err.message || 'C2 Access Denied: Invalid administrator credentials.';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'ACCESS CONTROL ROOM';
    }
  });
});
