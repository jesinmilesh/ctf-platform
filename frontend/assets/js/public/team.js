/**
 * XPLOITX // CYBER BATTLEFIELD
 * Squad Management (assets/js/public/team.js)
 *
 * Handles:
 * - Onboarding flow: Create Squad / Join Squad for users with no team
 * - Team dashboard: member roster, solves, access code for existing members
 * - After create/join: refreshes /auth/me then redirects to /dashboard.html
 * - Shows real backend error messages (including RECORD ALREADY EXISTS)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'team');

  await window.authManager.requireAuth('/login.html?redirect=/team.html');
  const user = window.authManager.getUser();
  if (!user) return; // requireAuth redirected

  const noSquadView = document.getElementById('noSquadView');
  const hasSquadView = document.getElementById('hasSquadView');

  // Check if we arrived here as part of dashboard onboarding redirect
  const isOnboarding = new URLSearchParams(location.search).has('onboarding');

  const gateBanner = document.getElementById('squadGateBanner');

  async function loadTeamData() {
    try {
      const meRes = await window.api.getMe();
      const currentUser = meRes.user || user;
      const hasTeam = !!(currentUser.team_id || currentUser.hasSquad);

      if (!hasTeam) {
        // No squad — show onboarding
        if (gateBanner) gateBanner.style.display = 'block';
        noSquadView.style.display = 'block';
        hasSquadView.style.display = 'none';
        setupCreateAndJoinForms();
        return;
      }

      // User has squad — show squad dashboard
      if (gateBanner) gateBanner.style.display = 'none';
      noSquadView.style.display = 'none';
      hasSquadView.style.display = 'block';

      let team;
      try {
        const teamRes = await window.api.getTeam(currentUser.team_id);
        team = teamRes.team;
      } catch (teamErr) {
        // Stale team_id (team deleted / DB reset) — fall back gracefully
        console.warn('[SQUAD] Team not found (stale ID?), showing onboarding:', teamErr.message);
        if (gateBanner) gateBanner.style.display = 'block';
        noSquadView.style.display = 'block';
        hasSquadView.style.display = 'none';
        setupCreateAndJoinForms();
        return;
      }

      // ── Populate squad header ──────────────────────────────────────────
      const teamIdDisplay = team.id || team.teamId || '';
      document.getElementById('squadName').textContent = team.name;
      if (teamIdDisplay) {
        const idEl = document.getElementById('squadTeamId');
        if (idEl) idEl.textContent = teamIdDisplay;
      }
      document.getElementById('squadScore').textContent = window.Utils.formatXP(team.total_score || 0);
      document.getElementById('squadSolves').textContent = team.solves_count || 0;
      document.getElementById('squadFirstBloods').textContent = team.first_bloods || 0;

      // Access Code (visible to captain / member)
      const codeEl = document.getElementById('squadAccessCode');
      if (codeEl) codeEl.textContent = team.access_code || 'CONFIDENTIAL';

      const copyBtn = document.getElementById('copyAccessCodeBtn');
      if (copyBtn && team.access_code) {
        copyBtn.onclick = () => window.Utils.copyToClipboard(team.access_code, 'ACCESS CODE COPIED');
      }

      // ── Squad Roster ────────────────────────────────────────────────────
      const rosterSlot = document.getElementById('squadRosterSlot');
      if (rosterSlot && team.members) {
        if (team.members.length === 0) {
          rosterSlot.innerHTML = `<div style="color:var(--text-secondary); font-family:var(--font-mono); font-size:12px;">NO OPERATIVES ON ROSTER.</div>`;
        } else {
          rosterSlot.innerHTML = team.members.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
              <div>
                <span style="font-family:var(--font-heading); font-size:14px; font-weight:700; color:#fff;">${window.Utils.escapeHTML(m.callsign || m.username)}</span>
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent); margin-left:8px;">${m.memberRole || m.role || 'MEMBER'}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">
                ${window.Utils.escapeHTML(m.affiliation || 'Active')}
              </div>
            </div>
          `).join('');
        }
      }

      // ── Solves Feed ─────────────────────────────────────────────────────
      const solvesSlot = document.getElementById('squadSolvesSlot');
      if (solvesSlot && team.solves) {
        if (team.solves.length === 0) {
          solvesSlot.innerHTML = `<div style="color:var(--text-secondary); font-family:var(--font-mono); font-size:12px;">NO CAPTURES LOGGED YET.</div>`;
        } else {
          solvesSlot.innerHTML = team.solves.map(s => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
              <span style="font-family:var(--font-heading); font-size:14px; font-weight:700; color:#fff;">${window.Utils.escapeHTML(s.title)}</span>
              <div style="display:flex; align-items:center; gap:12px; font-family:var(--font-mono); font-size:12px;">
                ${s.isFirstBlood ? '<span style="color:var(--danger); font-weight:700;">🩸 FIRST BLOOD</span>' : ''}
                <span style="color:var(--accent); font-weight:700;">+${s.points} XP</span>
              </div>
            </div>
          `).join('');
        }
      }

    } catch (err) {
      console.error('[SQUAD] Failed to load squad data:', err);
      noSquadView.style.display = 'block';
      hasSquadView.style.display = 'none';
      setupCreateAndJoinForms();
    }
  }

  function setupCreateAndJoinForms() {
    const createForm = document.getElementById('createSquadForm');
    if (createForm && !createForm._bound) {
      createForm._bound = true;
      createForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newSquadName').value.trim();
        const btn = createForm.querySelector('button[type="submit"]');
        const errEl = document.getElementById('createSquadError');

        if (errEl) errEl.style.display = 'none';
        if (btn) { btn.disabled = true; btn.textContent = 'COMMISSIONING...'; }

        try {
          const res = await window.api.createTeam(name);

          // Success — refresh auth state then go to dashboard
          if (window.showSuccess) window.showSuccess(`SQUAD [${res.team?.name || name}] COMMISSIONED // ID: ${res.team?.id || ''}`);

          // Reinitialize auth state from server before redirecting
          window.authManager.initialized = false;
          await window.authManager.init();

          setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
        } catch (err) {
          const msg = err.message || 'Squad creation failed.';
          if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
          } else {
            window.showError ? window.showError(msg) : alert(msg);
          }
          if (btn) { btn.disabled = false; btn.textContent = 'COMMISSION SQUAD'; }
        }
      };
    }

    const joinForm = document.getElementById('joinSquadForm');
    if (joinForm && !joinForm._bound) {
      joinForm._bound = true;
      joinForm.onsubmit = async (e) => {
        e.preventDefault();
        const accessCode = document.getElementById('joinAccessCode').value.trim();
        const btn = joinForm.querySelector('button[type="submit"]');
        const errEl = document.getElementById('joinSquadError');

        if (errEl) errEl.style.display = 'none';
        if (btn) { btn.disabled = true; btn.textContent = 'LINKING...'; }

        try {
          const res = await window.api.joinTeam(accessCode);

          if (window.showSuccess) window.showSuccess(`SQUAD JOINED // ${res.team?.name || 'LINKED'}`);

          // Reinitialize auth state from server before redirecting
          window.authManager.initialized = false;
          await window.authManager.init();

          setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
        } catch (err) {
          const msg = err.message || 'Join failed.';
          if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = 'block';
          } else {
            window.showError ? window.showError(msg) : alert(msg);
          }
          if (btn) { btn.disabled = false; btn.textContent = 'LINK WITH SQUAD'; }
        }
      };
    }
  }

  loadTeamData();
  window.onTeamMembershipChanged = () => loadTeamData();
});
