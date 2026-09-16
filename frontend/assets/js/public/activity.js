/**
 * XPLOITX // CYBER BATTLEFIELD
 * Live Activity Feed (assets/js/public/activity.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'activity');

  const user = await window.authManager.requireSquadMembership();
  if (!user) return;

  const streamSlot = document.getElementById('activityStreamSlot');

  async function loadActivity() {
    try {
      const res = await window.api.getSubmissions();
      const subs = res.submissions || [];

      if (subs.length === 0) {
        streamSlot.innerHTML = `
          <div class="empty-state" style="text-align:center; padding:60px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm);">
            <div style="font-size:32px; margin-bottom:12px;">⚡</div>
            <h3 style="font-family:var(--font-heading); font-size:18px; color:#fff; margin-bottom:8px;">NO RECENT ACTIVITY</h3>
            <p style="color:var(--text-secondary); font-size:13px; font-family:var(--font-mono); margin:0;">
              No combat actions or submissions recorded yet.
            </p>
          </div>
        `;
        return;
      }

      streamSlot.innerHTML = subs.map(s => {
        const isCorrect = s.status === 'CORRECT';
        let statusBadge = `<span style="color:var(--danger);">✕ REJECTED</span>`;
        if (isCorrect) {
          statusBadge = `<span style="color:var(--accent); font-weight:700;">✓ SECURED (+${s.points} XP)</span>`;
        }

        return `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ${isCorrect ? 'var(--accent)' : 'var(--border)'}; padding:14px 18px; border-radius:var(--radius-sm); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <span style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:#fff;">${window.Utils.escapeHTML(s.operative)}</span>
              <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-left:6px;">[${window.Utils.escapeHTML(s.teamName)}]</span>
              <span style="font-size:12px; color:var(--text-muted); margin:0 8px;">attacked</span>
              <span style="font-family:var(--font-heading); font-size:14px; font-weight:600; color:var(--cyan);">${window.Utils.escapeHTML(s.challengeTitle)}</span>
            </div>

            <div style="display:flex; align-items:center; gap:16px; font-family:var(--font-mono); font-size:12px;">
              ${statusBadge}
              <span style="color:var(--text-muted); font-size:11px;">${window.Utils.timeAgo(s.timestamp)}</span>
            </div>
          </div>
        `;
      }).join('');

    } catch (err) {
      if (err.code === 'SQUAD_REQUIRED' || (err.message && err.message.includes('SQUAD_REQUIRED'))) {
        window.location.href = '/team.html?onboarding=1';
        return;
      }
      console.error('Failed to load activity stream', err);
    }
  }

  loadActivity();

  if (window.tacticalSocket) {
    window.tacticalSocket.on('SCORE_UPDATED', () => {
      loadActivity();
    });
  }

  setInterval(loadActivity, 15000);
});
