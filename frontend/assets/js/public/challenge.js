/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Mission Dossier (assets/js/public/challenge.js)
 * Implements Sections 12 & 13 of Architectural Blueprint
 */

let currentChallenge = null;

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const params = new URLSearchParams(location.search);
  const rawId = params.get('id') || params.get('challengeId') || params.get('mission_id') || params.get('slug');
  const challengeId = rawId ? decodeURIComponent(rawId).trim() : null;

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
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:50px 20px; text-align:center; max-width:640px; margin:40px auto; grid-column:1 / -1;">
          <div style="font-size:36px; margin-bottom:12px;">🛡️</div>
          <h2 style="font-family:var(--font-heading); color:var(--danger); font-size:20px; font-weight:800; margin-bottom:12px;">
            CLASSIFIED MISSION UNAVAILABLE
          </h2>
          <p style="color:var(--text-secondary); font-family:var(--font-mono); font-size:13px; line-height:1.6; margin-bottom:24px;">
            ${err.message || 'Mission dossier classified or nonexistent.'}
          </p>
          <a href="/challenges.html" class="btn btn-primary" style="text-decoration:none; display:inline-block; padding:12px 24px;">
            ← RETURN TO ALL MISSIONS
          </a>
        </div>
      `;
    }
  }

  function renderInstanceUI(inst) {
    if (window.InstancePanel) {
      window.InstancePanel.render({
        targetId: 'instanceStatusSlot',
        challengeId,
        instance: inst,
        onSpawn: window.spawnSandbox,
        onTerminate: window.terminateSandbox
      });
    }
  }

  window.spawnSandbox = async () => {
    try {
      renderInstanceUI({ status: 'REQUESTED' });
      const res = await window.api.instances.spawn(challengeId);
      if (res && res.instance) {
        renderInstanceUI(res.instance);
      } else {
        await loadChallenge();
      }
    } catch (err) {
      const errMsg = err.error?.message || err.message || 'Failed to spawn challenge instance';
      if (window.showError) window.showError(errMsg);
      renderInstanceUI({ status: 'FAILED', error: errMsg });
    }
  };

  window.terminateSandbox = () => {
    if (window.Dialog) {
      window.Dialog.confirm({
        title: 'TERMINATE TARGET SANDBOX',
        message: 'This will destroy the active Docker container and release the assigned port. Any uncommitted state inside the sandbox will be wiped. Proceed?',
        confirmText: 'TERMINATE',
        cancelText: 'ABORT',
        severity: 'danger',
        onConfirm: async () => {
          try {
            await window.api.instances.terminate(challengeId);
            if (window.showSuccess) window.showSuccess('SANDBOX NEUTRALIZED');
            await loadChallenge();
          } catch (err) {
            if (window.showError) window.showError(err.message);
          }
        }
      });
    }
  };

  window.unlockHint = (hintId, cost) => {
    const actionConfirm = async () => {
      try {
        await window.api.unlockHint(challengeId, hintId);
        if (window.showSuccess) window.showSuccess('HINT UNLOCKED');
        loadChallenge();
      } catch (err) {
        if (window.showError) window.showError(err.message);
      }
    };

    if (window.Dialog) {
      window.Dialog.confirm({
        title: 'UNLOCK SIGNALS HINT',
        message: `Revealing this tactical hint will deduct ${cost} XP from your squad score. Proceed?`,
        confirmText: `UNLOCK (-${cost} XP)`,
        cancelText: 'ABORT',
        severity: 'warning',
        onConfirm: actionConfirm
      });
    } else {
      actionConfirm();
    }
  };

  // Real-time events for sandbox & challenge updates
  if (window.tacticalSocket) {
    window.tacticalSocket.on('INSTANCE_STARTED', (payload) => {
      if (payload && payload.challengeId === challengeId) {
        loadChallenge();
      }
    });
    window.tacticalSocket.on('INSTANCE_STOPPED', (payload) => {
      if (payload && payload.challengeId === challengeId) {
        loadChallenge();
      }
    });
    window.tacticalSocket.on('INSTANCE_EXPIRED', (payload) => {
      if (payload && payload.challengeId === challengeId) {
        loadChallenge();
      }
    });
  }

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
