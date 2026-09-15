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

    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'VALIDATING C2 KEY...';

    // Clear any previous operative tokens before attempting admin C2 authentication
    localStorage.removeItem('xploitx_token');
    sessionStorage.removeItem('xploitx_token');

    try {
      const loginFn = window.api?.adminLogin || window.api?.auth?.adminLogin || window.api?.login;
      const res = await loginFn({ username, password, adminOnly: true });
      if (res && res.user) {
        if (res.user.role !== 'ADMIN' && res.user.role !== 'SUPER_ADMIN') {
          localStorage.removeItem('xploitx_token');
          sessionStorage.removeItem('xploitx_token');
          throw new Error('CLEARANCE DENIED: Operative account lacks administrative clearance. Only administrators can log in to the C2 portal.');
        }
        localStorage.setItem('xploitx_token', res.token);
        window.showSuccess('C2 CLEARANCE VERIFIED // WELCOME COMMANDER');
        setTimeout(() => {
          window.location.href = '/admin/dashboard.html';
        }, 600);
      }
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
