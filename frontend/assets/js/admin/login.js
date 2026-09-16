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

    // Trim username whitespace; keep password exactly as entered (never trim or modify passphrase)
    const username = (document.getElementById('adminUsername').value || '').trim();
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
      sessionStorage.setItem('xploitx_token', res.token);

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

      let displayText = 'INVALID ADMIN CREDENTIALS';
      if (err.status === 403 || err.code === 'CLEARANCE_DENIED' || (err.message && err.message.includes('ADMIN ACCESS REQUIRED'))) {
        displayText = 'ADMIN ACCESS REQUIRED';
      } else if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
        displayText = 'INVALID ADMIN CREDENTIALS';
      } else if (err.status >= 500) {
        displayText = 'CONTROL ROOM TEMPORARILY UNAVAILABLE';
      } else if (err.status === 429) {
        displayText = 'SECURITY RATE LIMIT EXCEEDED. STAND BY.';
      } else {
        displayText = 'INVALID ADMIN CREDENTIALS';
      }

      errBox.textContent = displayText;
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'ACCESS CONTROL ROOM';
    }
  });
});
