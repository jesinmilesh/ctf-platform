/**
 * XPLOITX // CYBER BATTLEFIELD
 * Operative Authentication (assets/js/public/login.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  Navbar.render('navbar-container', 'login');

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'AUTHENTICATING...';

    try {
      const res = await window.api.login({ username, password });
      if (res && res.token) {
        localStorage.setItem('xploitx_token', res.token);
        window.showSuccess('BIOMETRIC PASSCONFIRMED // ACCESS GRANTED');

        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect') || '/dashboard.html';
        setTimeout(() => {
          window.location.href = redirect;
        }, 600);
      }
    } catch (err) {
      errorBox.textContent = err.message || 'Authentication rejected: Invalid callsign or passphrase.';
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'INFILTRATE SYSTEM';
    }
  });
});
