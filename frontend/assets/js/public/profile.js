/**
 * XPLOITX // CYBER BATTLEFIELD
 * Operative Profile (assets/js/public/profile.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'profile');

  await window.authManager.requireAuth('/login.html');
  const user = window.authManager.getUser();

  try {
    const res = await window.api.getMe();
    const activeUser = res.user || user;

    document.getElementById('profCallsign').textContent = activeUser.callsign || activeUser.username;
    document.getElementById('profUsername').textContent = `@${activeUser.username}`;
    document.getElementById('profEmail').textContent = activeUser.email;
    document.getElementById('profRole').textContent = activeUser.role;
    document.getElementById('profAffiliation').textContent = activeUser.affiliation || 'Independent';

    document.getElementById('profPoints').textContent = window.Utils.formatXP(activeUser.totalPoints || 0);
    document.getElementById('profSolvesCount').textContent = activeUser.solvesCount || 0;

    const squadEl = document.getElementById('profSquad');
    if (activeUser.team) {
      squadEl.innerHTML = `<a href="/team.html" style="color:var(--accent); text-decoration:none; font-weight:700;">${window.Utils.escapeHTML(activeUser.team.name)}</a>`;
    } else {
      squadEl.innerHTML = `<span style="color:var(--text-secondary);">Independent Operative</span> (<a href="/team.html" style="color:var(--accent);">Join Squad</a>)`;
    }

  } catch (err) {
    console.error('Failed to load profile:', err);
  }
});
