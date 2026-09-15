/**
 * XPLOITX // CYBER BATTLEFIELD
 * Squad Management (assets/js/public/team.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'team');

  await window.authManager.requireAuth('/login.html?redirect=/team.html');
  const user = window.authManager.getUser();

  // If requireAuth redirected (user not logged in), stop execution
  if (!user) return;

  const noSquadView = document.getElementById('noSquadView');
  const hasSquadView = document.getElementById('hasSquadView');

  async function loadTeamData() {
    try {
      const meRes = await window.api.getMe();
      const currentUser = meRes.user || user;

      if (!currentUser.team_id) {
        noSquadView.style.display = 'block';
        hasSquadView.style.display = 'none';
        setupCreateAndJoinForms();
        return;
      }

      // User has team
      noSquadView.style.display = 'none';
      hasSquadView.style.display = 'block';

      let team;
      try {
        const teamRes = await window.api.getTeam(currentUser.team_id);
        team = teamRes.team;
      } catch (teamErr) {
        // Team not found (stale team_id after DB reset or team deleted)
        // Fall back to no-squad view gracefully
        console.warn('[SQUAD] Team not found (stale ID?), showing no-squad view:', teamErr.message);
        noSquadView.style.display = 'block';
        hasSquadView.style.display = 'none';
        setupCreateAndJoinForms();
        return;
      }

      document.getElementById('squadName').textContent = team.name;
      document.getElementById('squadScore').textContent = window.Utils.formatXP(team.total_score);
      document.getElementById('squadSolves').textContent = team.solves_count || 0;
      document.getElementById('squadFirstBloods').textContent = team.first_bloods || 0;

      // Access Code & Copy Button
      const codeEl = document.getElementById('squadAccessCode');
      if (codeEl) codeEl.textContent = team.access_code || 'CONFIDENTIAL';

      const copyBtn = document.getElementById('copyAccessCodeBtn');
      if (copyBtn) {
        copyBtn.onclick = () => window.Utils.copyToClipboard(team.access_code, 'ACCESS CODE COPIED');
      }

      // Squad Roster
      const rosterSlot = document.getElementById('squadRosterSlot');
      if (rosterSlot && team.members) {
        rosterSlot.innerHTML = team.members.map(m => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
            <div>
              <span style="font-family:var(--font-heading); font-size:14px; font-weight:700; color:#fff;">${window.Utils.escapeHTML(m.callsign || m.username)}</span>
              <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-left:8px;">(${m.role})</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); font-family:var(--font-mono);">
              ${window.Utils.escapeHTML(m.affiliation || 'Active')}
            </div>
          </div>
        `).join('');
      }

      // Solves list
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
      // Outer catch: unexpected errors — show no-squad view rather than blank page
      console.error('[SQUAD] Failed to load squad data:', err);
      noSquadView.style.display = 'block';
      hasSquadView.style.display = 'none';
      setupCreateAndJoinForms();
    }
  }

  function setupCreateAndJoinForms() {
    const createForm = document.getElementById('createSquadForm');
    if (createForm) {
      createForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newSquadName').value.trim();
        try {
          await window.api.createTeam(name);
          window.showSuccess(`SQUAD [${name}] COMMISSIONED`);
          loadTeamData();
        } catch (err) {
          window.showError(err.message);
        }
      };
    }

    const joinForm = document.getElementById('joinSquadForm');
    if (joinForm) {
      joinForm.onsubmit = async (e) => {
        e.preventDefault();
        const accessCode = document.getElementById('joinAccessCode').value.trim();
        try {
          await window.api.joinTeam(accessCode);
          window.showSuccess('SQUAD JOINED SUCCESSFULLY');
          loadTeamData();
        } catch (err) {
          window.showError(err.message);
        }
      };
    }
  }

  loadTeamData();
});
