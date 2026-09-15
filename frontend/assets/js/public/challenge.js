/**
 * XPLOITX // CYBER BATTLEFIELD
 * Dedicated Mission Dossier (assets/js/public/challenge.js)
 * Implements Sections 8, 9, 10, 11, 12, 13, 29 of Architectural Specification:
 * - Dynamic data driven 100% by MongoDB Atlas (Zero mock or fallback data)
 * - Real asset attachments with size, SHA-256 integrity hash, and download streaming
 * - Dynamic Docker Instance orchestration (INSTANCE REQUIRED vs No instance required)
 * - Real-time WebSocket synchronization across operatives & administrators
 */

let currentChallenge = null;

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const params = new URLSearchParams(location.search);
  const rawId = params.get('id') || params.get('challengeId') || params.get('mission_id') || params.get('slug');
  const challengeId = rawId ? decodeURIComponent(rawId).trim() : null;

  function showMissionError(status, customMessage) {
    let title = 'MISSION SERVICE UNAVAILABLE';
    let message = customMessage || 'Unable to load mission. Please try again.';

    if (status === 400) {
      title = 'INVALID MISSION IDENTIFIER';
      message = customMessage || 'The requested mission ID is missing, malformed, or invalid.';
    } else if (status === 401) {
      title = 'AUTHENTICATION REQUIRED';
      message = customMessage || 'Login required to access this mission.';
    } else if (status === 403) {
      title = 'MISSION ACCESS DENIED';
      message = customMessage || 'You are not authorized to access this mission.';
    } else if (status === 404) {
      title = 'MISSION NOT FOUND';
      message = customMessage || 'Mission not found.';
    } else if (status === 409) {
      title = 'MISSION CURRENTLY UNAVAILABLE';
      message = customMessage || 'Mission unavailable due to competition state or schedule.';
    } else if (status === 429) {
      title = 'RATE LIMIT EXCEEDED';
      message = customMessage || 'Too many requests. Please wait a moment before trying again.';
    } else if (status === 503) {
      title = 'MISSION SERVICE UNAVAILABLE';
      message = customMessage || 'Mission service is temporarily unavailable.';
    } else if (status >= 500) {
      title = 'MISSION SERVICE UNAVAILABLE';
      message = customMessage || 'Unable to load mission. Please try again.';
    }

    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    const contentArea = document.getElementById('missionContentArea');
    if (contentArea) {
      contentArea.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:50px 20px; text-align:center; max-width:640px; margin:40px auto; grid-column:1 / -1;">
          <div style="font-size:36px; margin-bottom:12px;">🛡️</div>
          <h2 style="font-family:var(--font-heading); color:var(--danger); font-size:20px; font-weight:800; margin-bottom:12px; letter-spacing:0.05em;">
            ${esc(title)}
          </h2>
          <p style="color:var(--text-secondary); font-family:var(--font-mono); font-size:13px; line-height:1.6; margin-bottom:24px;">
            ${esc(message)}
          </p>
          <a href="/challenges.html" class="btn btn-primary" style="text-decoration:none; display:inline-block; padding:12px 24px;">
            ← RETURN TO ALL MISSIONS
          </a>
        </div>
      `;
    }
  }

  if (!challengeId || challengeId === 'undefined' || challengeId === 'null' || challengeId === '') {
    showMissionError(400, 'Invalid or missing mission identifier in request URL.');
    return;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  // Instance Lifecycle Handlers (Section 12)
  window.spawnSandbox = async () => {
    try {
      renderInstanceUI({ status: 'REQUESTED' });
      const res = await window.api.instances.spawn(challengeId);
      if (res && res.instance) {
        renderInstanceUI(res.instance);
      } else if (res && res.status) {
        renderInstanceUI(res);
      } else {
        await loadChallenge();
      }
    } catch (err) {
      const errCode = err.error?.code || err.code || '';
      const errMsg = err.error?.message || err.message || 'Failed to spawn challenge instance';

      if (errCode === 'AGENT_OFFLINE' || errMsg.includes('AGENT_OFFLINE')) {
        // Docker agent is not connected — show actionable error
        renderInstanceUI({
          status: 'FAILED',
          error: 'DOCKER AGENT OFFLINE',
          errorDetail: 'The challenge host agent is not connected. Please contact the CTF organizers — the infrastructure agent needs to be started.',
          code: 'AGENT_OFFLINE'
        });
        if (window.showError) window.showError('⚠ AGENT OFFLINE: The Docker host agent is not connected. Challenge instances are temporarily unavailable.');
      } else if (errCode === 'AGENT_TIMEOUT' || errMsg.includes('AGENT_TIMEOUT')) {
        renderInstanceUI({
          status: 'FAILED',
          error: 'AGENT TIMEOUT',
          errorDetail: 'The challenge container did not start in time. Please try again.',
          code: 'AGENT_TIMEOUT'
        });
        if (window.showError) window.showError('TIMEOUT: Agent did not respond. Please try again.');
      } else {
        if (window.showError) window.showError(errMsg);
        renderInstanceUI({ status: 'FAILED', error: errMsg });
      }
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
    } else {
      if (confirm('Terminate target sandbox container?')) {
        window.api.instances.terminate(challengeId)
          .then(() => loadChallenge())
          .catch(e => window.showError(e.message));
      }
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

  // Primary Challenge Loader (Source of Truth: MongoDB Atlas)
  async function loadChallenge() {
    try {
      const titleEl = document.getElementById('missionTitle');
      if (titleEl) titleEl.textContent = 'LOADING MISSION DOSSIER...';
      const descEl = document.getElementById('missionDescription');
      if (descEl) descEl.textContent = 'Decrypting tactical telemetry from C2 server...';

      let data = null;

      // Handle Preview mode from Studio
      if (challengeId === 'preview' || challengeId === 'draft') {
        const previewStr = sessionStorage.getItem('xploitx_challenge_preview');
        if (previewStr) {
          try { data = JSON.parse(previewStr); } catch (e) {}
        }
      }

      if (!data) {
        data = await window.api.getChallenge(challengeId);
      }

      currentChallenge = data;

      // 1. Mission Header Metadata
      document.title = `${data.title} // XPLOITX CYBER BATTLEFIELD`;
      document.getElementById('missionIdBadge').textContent = data.mission_id || 'OP-CLASSIFIED';
      document.getElementById('missionCategoryBadge').textContent = `[ ${data.category || 'MISC'} ]`;
      document.getElementById('missionCategoryBadge').style.color = data.category_color || 'var(--accent)';
      document.getElementById('missionDifficultyBadge').innerHTML = window.Utils.getDifficultyBadge(data.difficulty);
      document.getElementById('missionPoints').textContent = window.Utils.formatXP(data.points);
      document.getElementById('missionSolves').textContent = `${data.solve_count || 0} Solves`;
      document.getElementById('missionTitle').textContent = data.title;
      document.getElementById('missionDescription').textContent = data.description || 'No briefing details provided.';

      // 2. Solved Status Banner
      const solvedBanner = document.getElementById('missionSolvedBanner');
      if (challengeId === 'preview' || data.is_preview) {
        if (solvedBanner) {
          solvedBanner.style.display = 'block';
          solvedBanner.style.background = 'rgba(0, 216, 246, 0.1)';
          solvedBanner.style.borderColor = 'var(--cyan)';
          solvedBanner.style.color = 'var(--cyan)';
          solvedBanner.textContent = '👁️ LIVE DOSSIER PREVIEW // DRAFT TRANSMISSION SIMULATION';
        }
      } else if (data.is_solved) {
        if (solvedBanner) {
          solvedBanner.style.display = 'block';
          solvedBanner.style.background = 'var(--accent-muted)';
          solvedBanner.style.borderColor = 'var(--accent)';
          solvedBanner.style.color = 'var(--accent)';
          solvedBanner.textContent = '✓ MISSION SECURED // FLAG SUCCESSFULLY RECOVERED BY YOUR SQUAD';
          const submitBtn = document.getElementById('flagSubmitBtn');
          if (submitBtn) {
            submitBtn.textContent = 'MISSION SECURED';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-outline');
          }
        }
      }

      // 3. Dynamic Attached Files (Section 6 & 7)
      const filesContainer = document.getElementById('missionFilesContainer');
      const files = data.files || [];

      if (files.length > 0) {
        filesContainer.innerHTML = files.map(f => {
          const sizeStr = formatBytes(f.size || f.sizeBytes || f.file_size_bytes);
          const downloadUrl = f.downloadUrl || `/api/v1/challenges/${data.id}/files/${f.id}/download`;
          const fileName = f.name || f.filename || 'asset.bin';
          const shaHash = f.sha256 ? `${f.sha256.substring(0, 8)}...` : null;

          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:10px; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:12px; min-width:200px;">
                <span style="font-size:22px;">📦</span>
                <div>
                  <div style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:#fff;">
                    ${window.Utils.escapeHTML(fileName)}
                  </div>
                  <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-top:2px;">
                    SIZE: ${sizeStr} ${shaHash ? `• SHA-256: <span title="${f.sha256}" style="color:var(--cyan); cursor:pointer;" onclick="navigator.clipboard.writeText('${f.sha256}'); window.showSuccess('SHA-256 hash copied');">${shaHash} 📋</span>` : ''}
                  </div>
                </div>
              </div>
              <a href="${downloadUrl}" class="btn btn-sm btn-outline" download style="display:flex; align-items:center; gap:6px; padding:8px 18px; font-weight:700; text-decoration:none;">
                ⬇ DOWNLOAD
              </a>
            </div>
          `;
        }).join('');
      } else {
        filesContainer.innerHTML = `
          <div style="font-size:12px; color:var(--text-secondary); font-family:var(--font-mono); background:var(--bg-secondary); padding:14px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
            No downloadable files for this mission.
          </div>
        `;
      }

      // 4. Dynamic Docker Sandbox Requirement (Section 10, 11, 12, 13, 20)
      const instanceSection = document.getElementById('missionInstanceSection');
      const requiresInstance = !!(data.requiresInstance || data.has_instance || data.runtime?.enabled);

      if (instanceSection) {
        if (requiresInstance) {
          instanceSection.style.display = 'block';
          renderInstanceUI(data.instance);
        } else {
          instanceSection.style.display = 'none';
        }
      }

      // 5. Tactical Hints (Section 13)
      const hintsContainer = document.getElementById('missionHintsContainer');
      const hints = data.hints || [];

      if (hints.length > 0) {
        hintsContainer.innerHTML = hints.map(h => {
          if (h.isUnlocked) {
            return `
              <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--cyan); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
                <div style="font-family:var(--font-mono); font-size:11px; color:var(--cyan); margin-bottom:4px; font-weight:700;">HINT #${h.index} // UNLOCKED</div>
                <div style="font-size:13px; color:#fff;">${window.Utils.escapeHTML(h.content)}</div>
              </div>
            `;
          } else {
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border); padding:12px 16px; border-radius:var(--radius-sm); margin-bottom:8px;">
                <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
                  HINT #${h.index} (${h.cost} XP COST)
                </div>
                <button type="button" class="btn btn-sm btn-outline" onclick="window.unlockHint('${h.id}', ${h.cost})">
                  REVEAL HINT
                </button>
              </div>
            `;
          }
        }).join('');
      } else {
        hintsContainer.innerHTML = `
          <div style="font-size:12px; color:var(--text-secondary); font-family:var(--font-mono); background:var(--bg-secondary); padding:14px 16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
            No tactical hints issued for this mission.
          </div>
        `;
      }

    } catch (err) {
      const status = err.status || (err.statusCode ? err.statusCode : 500);
      showMissionError(status, err.message);
    }
  }

  // Real-time Event Synchronization (Section 21)
  if (window.tacticalSocket) {
    const handleRefresh = (payload) => {
      if (!payload || payload.challengeId === challengeId || payload.id === challengeId) {
        loadChallenge();
      }
    };

    window.tacticalSocket.on('challenge.updated', handleRefresh);
    window.tacticalSocket.on('challenge.file.added', handleRefresh);
    window.tacticalSocket.on('challenge.published', handleRefresh);
    window.tacticalSocket.on('INSTANCE_STARTED', handleRefresh);
    window.tacticalSocket.on('INSTANCE_STOPPED', handleRefresh);
    window.tacticalSocket.on('INSTANCE_EXPIRED', handleRefresh);
  }

  // Flag submission Terminal (Section 13)
  const flagForm = document.getElementById('flagForm');
  if (flagForm) {
    flagForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const flagInputEl = document.getElementById('flag') || document.getElementById('flagInput');
      const submittedFlag = flagInputEl ? flagInputEl.value.trim() : '';

      if (!submittedFlag) {
        if (window.showError) window.showError('Please enter a flag payload.');
        return;
      }

      const submitBtn = document.getElementById('flagSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'TRANSMITTING FLAG...';
      }

      try {
        const result = await window.api.submitFlag(challengeId, submittedFlag);
        if (result.correct) {
          window.showSuccess(result.isFirstBlood ? '🩸 FIRST BLOOD SECURED!' : 'FLAG CAPTURED // MISSION SECURED');
          if (flagInputEl) flagInputEl.value = '';
          await loadChallenge();
        } else {
          window.showError(result.message || 'INVALID FLAG PAYLOAD');
        }
      } catch (error) {
        window.showError(error.message || 'INVALID FLAG PAYLOAD');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'SUBMIT FLAG';
        }
      }
    });
  }

  // Initial Load
  loadChallenge();
});
