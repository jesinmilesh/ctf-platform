/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Mission Dossier (assets/js/public/challenge.js)
 * Implements Sections 12 & 13 of Architectural Blueprint
 */

let currentChallenge = null;

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const params = new URLSearchParams(location.search);
  const challengeId = params.get('id');

  if (!challengeId) {
    window.location.href = '/challenges.html';
    return;
  }

  // Load Competition Flag Prefix
  let flagPrefix = 'XploitXβ{';
  let flagSuffix = '}';
  try {
    const compRes = await window.api.getCompetition();
    if (compRes && compRes.competition) {
      flagPrefix = compRes.competition.flagPrefix || flagPrefix;
      flagSuffix = compRes.competition.flagSuffix || flagSuffix;
    }
  } catch (e) {}

  const prefixEl = document.getElementById('flagPrefixLabel');
  if (prefixEl) prefixEl.textContent = flagPrefix;
  const suffixEl = document.getElementById('flagSuffixLabel');
  if (suffixEl) suffixEl.textContent = flagSuffix;

  async function loadChallenge() {
    try {
      const data = await window.api.getChallenge(challengeId);
      currentChallenge = data;

      document.title = `${data.title} // XPLOITX CYBER BATTLEFIELD`;
      document.getElementById('missionIdBadge').textContent = data.mission_id || 'OP-CLASSIFIED';
      document.getElementById('missionCategoryBadge').textContent = `[ ${data.category} ]`;
      document.getElementById('missionCategoryBadge').style.color = data.category_color || 'var(--accent)';
      document.getElementById('missionDifficultyBadge').innerHTML = window.Utils.getDifficultyBadge(data.difficulty);
      document.getElementById('missionPoints').textContent = window.Utils.formatXP(data.points);
      document.getElementById('missionSolves').textContent = `${data.solve_count || 0} Solves`;
      document.getElementById('missionTitle').textContent = data.title;
      document.getElementById('missionDescription').textContent = data.description;

      // Status indicator
      const solvedBanner = document.getElementById('missionSolvedBanner');
      if (data.is_solved) {
        solvedBanner.style.display = 'block';
        document.getElementById('flagSubmitBtn').textContent = 'MISSION SECURED';
        document.getElementById('flagSubmitBtn').classList.remove('btn-primary');
        document.getElementById('flagSubmitBtn').classList.add('btn-outline');
      }

      // Render Files
      const filesContainer = document.getElementById('missionFilesContainer');
      if (data.files && data.files.length > 0) {
        filesContainer.innerHTML = data.files.map(f => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>📁</span>
              <span style="font-family:var(--font-mono); font-size:13px; color:#fff;">${window.Utils.escapeHTML(f.filename)}</span>
            </div>
            <a href="/api/files/${encodeURIComponent(f.id)}" class="btn btn-sm btn-outline" download>
              DOWNLOAD
            </a>
          </div>
        `).join('');
      } else {
        filesContainer.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); font-family:var(--font-mono);">NO EXTERNAL ASSETS ATTACHED.</div>`;
      }

      // Render Sandbox / Dynamic Target Box
      const instanceSection = document.getElementById('missionInstanceSection');
      if (data.has_instance) {
        instanceSection.style.display = 'block';
        renderInstanceUI(data.instance);
      } else {
        instanceSection.style.display = 'none';
      }

      // Render Hints
      const hintsContainer = document.getElementById('missionHintsContainer');
      if (data.hints && data.hints.length > 0) {
        hintsContainer.innerHTML = data.hints.map(h => {
          if (h.isUnlocked) {
            return `
              <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--cyan); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
                <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); margin-bottom:4px;">HINT #${h.index} // UNLOCKED</div>
                <div style="font-size:13px; color:#fff;">${window.Utils.escapeHTML(h.content)}</div>
              </div>
            `;
          } else {
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); padding:10px 14px; border-radius:var(--radius-sm); margin-bottom:8px;">
                <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
                  HINT #${h.index} (${h.cost} XP COST)
                </div>
                <button class="btn btn-sm btn-outline" onclick="unlockHint('${h.id}', ${h.cost})">
                  REVEAL HINT
                </button>
              </div>
            `;
          }
        }).join('');
      } else {
        hintsContainer.innerHTML = `<div style="font-size:12px; color:var(--text-secondary); font-family:var(--font-mono);">NO TACTICAL HINTS ISSUED.</div>`;
      }

    } catch (err) {
      document.getElementById('missionContentArea').innerHTML = `
        <div style="color:var(--danger); font-family:var(--font-mono); padding:40px; text-align:center;">
          CLASSIFIED MISSION UNAVAILABLE: ${err.message}
        </div>
      `;
    }
  }

  function renderInstanceUI(inst) {
    const slot = document.getElementById('instanceStatusSlot');
    if (inst) {
      slot.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); padding:14px; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--accent); font-weight:700;">● CONTAINER RUNNING</span>
            <button class="btn btn-sm btn-outline" onclick="terminateSandbox()" style="color:var(--danger); border-color:var(--danger);">DESTROY</button>
          </div>
          <div style="font-family:var(--font-mono); font-size:13px; color:#fff; word-break:break-all;">
            TARGET HOST: <strong style="color:var(--cyan);">${inst.host}:${inst.port}</strong>
          </div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-top:4px;">
            AUTO-TERMINATION: ~${Math.floor(inst.timeRemainingSeconds / 60)} MINUTES
          </div>
        </div>
      `;
    } else {
      slot.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); padding:14px; border-radius:var(--radius-sm);">
          <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">SANDBOX OFFLINE</span>
          <button class="btn btn-sm btn-primary" onclick="spawnSandbox()">SPAWN INSTANCE</button>
        </div>
      `;
    }
  }

  window.spawnSandbox = async () => {
    try {
      window.showSuccess('SPAWNING DOCKER CONTAINER TARGET...');
      await window.api.deployInstance(challengeId);
      loadChallenge();
    } catch (err) {
      window.showError(err.message);
    }
  };

  window.terminateSandbox = async () => {
    try {
      await window.api.terminateInstance(challengeId);
      window.showSuccess('SANDBOX TERMINATED');
      loadChallenge();
    } catch (err) {
      window.showError(err.message);
    }
  };

  window.unlockHint = (hintId, cost) => {
    window.Modal.open({
      title: 'UNLOCK TACTICAL HINT',
      content: `Revealing this hint may assess a deduction of <strong>${cost} XP</strong> from your operative squad score. Proceed?`,
      actions: [
        { label: 'ABORT', primary: false },
        {
          label: 'CONFIRM REVEAL',
          primary: true,
          onClick: async () => {
            try {
              await window.api.unlockHint(challengeId, hintId);
              window.showSuccess('HINT REVEALED');
              loadChallenge();
            } catch (err) {
              window.showError(err.message);
            }
          }
        }
      ]
    });
  };

  // Flag submission (Section 13)
  const flagForm = document.getElementById('flagForm');
  flagForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawInput = document.getElementById('flagInput').value.trim();
    let fullFlag = rawInput;

    // If user typed the inner part without prefix/suffix, auto-wrap
    if (!fullFlag.startsWith(flagPrefix) && !fullFlag.endsWith(flagSuffix)) {
      fullFlag = `${flagPrefix}${fullFlag}${flagSuffix}`;
    }

    const submitBtn = document.getElementById('flagSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'CHECKING CHECKSUM...';

    try {
      const result = await window.api.submitFlag(challengeId, fullFlag);
      if (result.correct) {
        window.showSuccess(result.isFirstBlood ? '🩸 FIRST BLOOD CAPTURED!' : 'FLAG CAPTURED // MISSION SECURED');
        document.getElementById('flagInput').value = '';
        loadChallenge();
      } else {
        window.showError(result.message || 'INVALID FLAG');
      }
    } catch (error) {
      window.showError(error.message || 'INVALID FLAG');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'CAPTURE FLAG';
    }
  });

  loadChallenge();
});
