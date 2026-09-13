/**
 * XPLOITX // CYBER BATTLEFIELD
 * Operative Registration (assets/js/public/register.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  Navbar.render('navbar-container', 'register');

  const form = document.getElementById('registerForm');
  const errorBox = document.getElementById('registerError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const callsign = document.getElementById('regCallsign').value.trim() || username;
    const affiliation = document.getElementById('regAffiliation').value.trim() || 'Independent';
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;

    if (password !== confirm) {
      errorBox.textContent = 'Passphrase confirmation does not match.';
      errorBox.style.display = 'block';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'ENLISTING OPERATIVE...';

    try {
      const res = await window.api.register({
        username,
        email,
        password,
        callsign,
        affiliation
      });

      if (res && res.token) {
        localStorage.setItem('xploitx_token', res.token);
        window.showSuccess('OPERATIVE ENLISTED // CREDENTIALS LOGGED');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 600);
      }
    } catch (err) {
      errorBox.textContent = err.message || 'Registration rejected.';
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'CONFIRM ENLISTMENT';
    }
  });
});
