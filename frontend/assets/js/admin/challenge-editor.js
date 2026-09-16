/**
 * XPLOITX // CYBER BATTLEFIELD
 * Mission Studio / Challenge Editor (assets/js/admin/challenge-editor.js)
 * Implements Sections 3, 4, 5, 14, 15, 16 of Master Specification:
 * - Full authoring pipeline with authoritative persistence to MongoDB Atlas
 * - Real asset attachments with isolated storage, SHA-256 integrity, and delete controls
 * - Dynamic Docker runtime configuration with requiresInstance synchronization
 */

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'challenge-editor');
  await window.authManager.requireAdmin('/admin/login.html');

  // Multi-tab Studio switching
  const tabs = document.querySelectorAll('.studio-tab-btn');
  const panes = document.querySelectorAll('.studio-pane');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.target);
      if (targetPane) targetPane.classList.add('active');

      if (btn.dataset.target === 'pane-preview') {
        updatePreview();
      }
    });
  });

  // Load Categories into dropdown
  try {
    const catRes = await window.api.admin.getCategories();
    const select = document.getElementById('editCategory');
    if (select && catRes.categories) {
      select.innerHTML = catRes.categories.map(cat => `
        <option value="${cat.name}">${cat.name}</option>
      `).join('');
    }
  } catch (e) {}

  // Check URL query param for existing challenge ID
  const params = new URLSearchParams(location.search);
  editingId = params.get('id');

  if (editingId) {
    document.getElementById('editorTitleHeader').textContent = 'EDIT MISSION DOSSIER';
    loadExistingChallenge(editingId);
    const auditBtn = document.getElementById('viewAuditHistoryBtn');
    if (auditBtn) {
      auditBtn.style.display = 'inline-block';
      auditBtn.addEventListener('click', () => {
        window.location.href = `/admin/action-logs.html?challengeId=${encodeURIComponent(editingId)}`;
      });
    }
  } else {
    renderEmptyFilesTable('Save or publish the mission to activate live asset uploads, or select assets below to upload upon creation.');
  }

  // ── Authoritative Multiple Hints State (Sections 2, 3, 4, 5) ─────────────
  let hintsState = [];

  function renderHintsUI() {
    const container = document.getElementById('hintsListContainer');
    if (!container) return;

    if (!Array.isArray(hintsState) || hintsState.length === 0) {
      container.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted); background:var(--bg-secondary); border:1px dashed var(--border); padding:24px; border-radius:var(--radius-sm); text-align:center;">
          No tactical hints configured for this mission. Click <strong style="color:var(--accent);">+ ADD HINT</strong> above to create one.
        </div>
      `;
      return;
    }

    container.innerHTML = hintsState.map((hint, idx) => {
      const hintNum = String(idx + 1).padStart(2, '0');
      const order = hint.order !== undefined ? hint.order : (idx + 1);
      const cost = hint.cost !== undefined ? hint.cost : 25;
      const text = hint.text || hint.content || '';
      const enabled = hint.enabled !== false;

      return `
        <div class="hint-editor-card" data-index="${idx}" style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius-sm); padding:18px; display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:10px;">
            <div style="display:flex; align-items:center; gap:14px;">
              <span style="font-family:var(--font-mono); font-size:12px; font-weight:800; color:var(--accent); letter-spacing:0.06em;">
                HINT ${hintNum}
              </span>
              <label style="display:flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); cursor:pointer;">
                <input type="checkbox" class="hint-field-enabled" data-index="${idx}" ${enabled ? 'checked' : ''} style="accent-color:var(--accent); width:14px; height:14px;">
                <span>ENABLED</span>
              </label>
            </div>
            <button type="button" class="btn btn-sm btn-outline hint-delete-btn" data-index="${idx}" style="color:#ff3366; border-color:rgba(255,51,102,0.4); font-size:11px; padding:4px 10px; font-weight:700;">
              🗑 DELETE HINT
            </button>
          </div>

          <div>
            <label style="display:block; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-bottom:6px;">
              HINT INTEL / CLUE TEXT *
            </label>
            <textarea rows="2" class="hint-field-text" data-index="${idx}" placeholder="Enter specific clue or guidance for operatives..." style="width:100%; background:var(--bg-card); border:1px solid var(--border); color:#fff; padding:10px 12px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:13px; resize:vertical; line-height:1.5;">${window.Utils.escapeHTML(text)}</textarea>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
            <div>
              <label style="display:block; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-bottom:6px;">
                XP UNLOCK COST (POINTS DEDUCTED)
              </label>
              <input type="number" min="0" class="hint-field-cost" data-index="${idx}" value="${cost}" style="width:100%; background:var(--bg-card); border:1px solid var(--border); color:#fff; padding:8px 12px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:13px;">
            </div>
            <div>
              <label style="display:block; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-bottom:6px;">
                DISPLAY / UNLOCK ORDER
              </label>
              <input type="number" min="1" class="hint-field-order" data-index="${idx}" value="${order}" style="width:100%; background:var(--bg-card); border:1px solid var(--border); color:#fff; padding:8px 12px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:13px;">
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to card controls
    container.querySelectorAll('.hint-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx) && idx >= 0 && idx < hintsState.length) {
          syncHintsFromDOM();
          hintsState.splice(idx, 1);
          hintsState.forEach((h, i) => { h.order = i + 1; });
          renderHintsUI();
        }
      });
    });

    container.querySelectorAll('.hint-field-text').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.index, 10);
        if (hintsState[idx]) hintsState[idx].text = input.value;
      });
    });

    container.querySelectorAll('.hint-field-cost').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.index, 10);
        if (hintsState[idx]) hintsState[idx].cost = parseInt(input.value, 10) || 0;
      });
    });

    container.querySelectorAll('.hint-field-order').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.index, 10);
        if (hintsState[idx]) hintsState[idx].order = parseInt(input.value, 10) || (idx + 1);
      });
    });

    container.querySelectorAll('.hint-field-enabled').forEach(input => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.dataset.index, 10);
        if (hintsState[idx]) hintsState[idx].enabled = input.checked;
      });
    });
  }

  function syncHintsFromDOM() {
    const container = document.getElementById('hintsListContainer');
    if (!container) return;
    container.querySelectorAll('.hint-editor-card').forEach(card => {
      const idx = parseInt(card.dataset.index, 10);
      if (hintsState[idx]) {
        const textEl = card.querySelector('.hint-field-text');
        const costEl = card.querySelector('.hint-field-cost');
        const orderEl = card.querySelector('.hint-field-order');
        const enabledEl = card.querySelector('.hint-field-enabled');

        if (textEl) hintsState[idx].text = textEl.value;
        if (costEl) hintsState[idx].cost = parseInt(costEl.value, 10) || 0;
        if (orderEl) hintsState[idx].order = parseInt(orderEl.value, 10) || (idx + 1);
        if (enabledEl) hintsState[idx].enabled = enabledEl.checked;
      }
    });
  }

  const addHintBtn = document.getElementById('addHintBtn');
  if (addHintBtn) {
    addHintBtn.addEventListener('click', () => {
      syncHintsFromDOM();
      hintsState.push({
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: '',
        content: '',
        cost: 25,
        order: hintsState.length + 1,
        enabled: true
      });
      renderHintsUI();
      const newCardTextarea = document.querySelector(`.hint-field-text[data-index="${hintsState.length - 1}"]`);
      if (newCardTextarea) newCardTextarea.focus();
    });
  }

  // Initial render of empty hints for new mission
  if (!editingId) {
    renderHintsUI();
  }

  // Runtime Panel toggle
  const hasInstanceCheckbox = document.getElementById('editHasInstance');
  const runtimePanel = document.getElementById('sandboxRuntimeConfigPanel');
  if (hasInstanceCheckbox && runtimePanel) {
    hasInstanceCheckbox.addEventListener('change', () => {
      runtimePanel.style.display = hasInstanceCheckbox.checked ? 'block' : 'none';
    });
  }

  // File Upload Controls (Section 4 & 16)
  const chooseFilesBtn = document.getElementById('chooseFilesBtn');
  const fileInput = document.getElementById('challengeFiles');
  const uploadFilesBtn = document.getElementById('uploadFilesBtn');
  const previewBox = document.getElementById('selectedFilesPreview');
  const refreshFilesBtn = document.getElementById('refreshFilesBtn');

  // Single authoritative frontend selection state (Section 4 & 5)
  let selectedFiles = [];

  function updateSelectedFilesUI() {
    const count = selectedFiles.length;

    if (previewBox) {
      if (count > 0) {
        previewBox.style.display = 'block';
        previewBox.innerHTML = `
          <strong>Selected for transmission (${count}):</strong><br>
          ${selectedFiles.map(f => `• ${window.Utils.escapeHTML(f.name)} (${formatFileSize(f.size)})`).join('<br>')}
        `;
      } else {
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
      }
    }

    if (uploadFilesBtn) {
      uploadFilesBtn.disabled = (count === 0);
      uploadFilesBtn.innerHTML = `⬆ UPLOAD SELECTED (${count})`;
      if (editingId && count > 0) {
        uploadFilesBtn.style.display = 'inline-block';
      } else if (count === 0) {
        uploadFilesBtn.style.display = 'none';
      }
    }
  }

  if (chooseFilesBtn && fileInput) {
    chooseFilesBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      selectedFiles = Array.from(fileInput.files || []);
      updateSelectedFilesUI();
    });
  }

  if (uploadFilesBtn) {
    uploadFilesBtn.addEventListener('click', async () => {
      if (!editingId) return;
      if (!selectedFiles || selectedFiles.length === 0) {
        window.showWarning('Please select assets to upload.');
        return;
      }

      // Pre-flight size validation against deployment constraints (Section 12, 13, 52)
      const isServerless = window.location.hostname.includes('vercel.app');
      const maxBytes = isServerless ? (4.5 * 1024 * 1024) : (50 * 1024 * 1024);
      const maxMbText = isServerless ? '4.5 MB' : '50 MB';

      for (let i = 0; i < selectedFiles.length; i++) {
        if (selectedFiles[i].size > maxBytes) {
          window.showError(`FILE TOO LARGE: '${selectedFiles[i].name}' (${(selectedFiles[i].size / (1024 * 1024)).toFixed(2)} MB) exceeds allowed limit of ${maxMbText}.`);
          return;
        }
      }

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      uploadFilesBtn.disabled = true;
      uploadFilesBtn.innerHTML = `⏳ TRANSMITTING & STORING ASSETS...`;

      try {
        const uploadResult = await window.api.admin.uploadChallengeFiles(editingId, formData);
        const uploadedCount = (uploadResult && uploadResult.files) ? uploadResult.files.length : selectedFiles.length;
        window.showSuccess(`✓ ${uploadedCount} asset(s) successfully secured in persistent storage with SHA-256 integrity.`);
        selectedFiles = [];
        if (fileInput) fileInput.value = '';
        updateSelectedFilesUI();
        await loadChallengeFiles(editingId);
      } catch (err) {
        window.showError(`UPLOAD FAILED: ${err.message}`);
        updateSelectedFilesUI();
      }
    });
  }

  if (refreshFilesBtn) {
    refreshFilesBtn.addEventListener('click', () => {
      if (editingId) loadChallengeFiles(editingId);
    });
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function renderEmptyFilesTable(message = 'No downloadable files uploaded for this mission yet.') {
    const container = document.getElementById('uploadedFilesTableContainer');
    if (container) {
      container.innerHTML = `
        <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted); padding:12px 0;">
          ℹ ${message}
        </div>
      `;
    }
  }

  async function loadChallengeFiles(id) {
    const container = document.getElementById('uploadedFilesTableContainer');
    if (!container) return;

    try {
      const res = await window.api.admin.getChallengeFiles(id);
      const files = (res && res.files) ? res.files : [];

      if (files.length === 0) {
        renderEmptyFilesTable();
        return;
      }

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-family:var(--font-mono); font-size:12px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); color:var(--text-secondary);">
                <th style="padding:10px 8px;">FILE NAME</th>
                <th style="padding:10px 8px;">SIZE</th>
                <th style="padding:10px 8px;">SHA-256 INTEGRITY</th>
                <th style="padding:10px 8px;">UPLOADED</th>
                <th style="padding:10px 8px; text-align:right;">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${files.map(f => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:12px 8px; color:#fff; font-weight:700;">
                    📁 ${window.Utils.escapeHTML(f.filename || f.name)}
                  </td>
                  <td style="padding:12px 8px; color:var(--cyan);">
                    ${formatFileSize(f.size || f.file_size_bytes)}
                  </td>
                  <td style="padding:12px 8px;">
                    <span title="${f.sha256}" style="color:var(--text-muted); cursor:pointer;" onclick="navigator.clipboard.writeText('${f.sha256}'); window.showSuccess('SHA-256 copied');">
                      ${f.sha256 ? f.sha256.substring(0, 10) + '...' : 'N/A'} 📋
                    </span>
                  </td>
                  <td style="padding:12px 8px; color:var(--text-secondary);">
                    ${f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : '---'}
                  </td>
                  <td style="padding:12px 8px; text-align:right;">
                    <a href="${f.downloadUrl || `/api/v1/challenges/${id}/files/${f.id}/download`}" class="btn btn-sm btn-outline" style="font-size:11px; padding:4px 10px; margin-right:6px; text-decoration:none;" download>
                      VERIFY
                    </a>
                    <button type="button" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger); font-size:11px; padding:4px 10px;" onclick="window.deleteUploadedFile('${f.id}')">
                      DELETE
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div style="color:var(--danger); font-family:var(--font-mono); font-size:12px; padding:12px 0;">
          ⚠ Failed to retrieve mission files: ${err.message}
        </div>
      `;
    }
  }

  window.deleteUploadedFile = (fileId) => {
    if (!editingId) return;
    if (window.Dialog) {
      window.Dialog.confirm({
        title: 'DELETE MISSION ASSET',
        message: 'Are you sure you want to delete this challenge file from storage? Participants will no longer be able to download it.',
        confirmText: 'DELETE FILE',
        cancelText: 'ABORT',
        severity: 'danger',
        onConfirm: async () => {
          try {
            await window.api.admin.deleteChallengeFile(editingId, fileId);
            window.showSuccess('Asset neutralized from storage.');
            await loadChallengeFiles(editingId);
          } catch (err) {
            window.showError(`Delete failed: ${err.message}`);
          }
        }
      });
    } else {
      if (confirm('Delete this file from storage?')) {
        window.api.admin.deleteChallengeFile(editingId, fileId)
          .then(() => loadChallengeFiles(editingId))
          .catch(e => window.showError(e.message));
      }
    }
  };

  async function loadExistingChallenge(id) {
    try {
      let res;
      try {
        res = await window.api.admin.getChallenge(id);
      } catch (adminErr) {
        console.warn('Admin challenge fetch fallback:', adminErr.message);
        res = await window.api.getChallenge(id);
      }
      const c = (res && res.challenge) ? res.challenge : res;
      if (!c) return;

      document.getElementById('editTitle').value = c.title || '';
      const missionIdEl = document.getElementById('editMissionId');
      if (missionIdEl) {
        missionIdEl.value = c.challengeId || c.mission_id || c.id || '';
        missionIdEl.disabled = true;
        missionIdEl.readOnly = true;
        missionIdEl.style.cursor = 'not-allowed';
        missionIdEl.style.opacity = '0.7';
      }
      document.getElementById('editCategory').value = c.category || c.category_name || 'PWN';
      document.getElementById('editDifficulty').value = c.difficulty || 'MEDIUM';
      document.getElementById('editDescription').value = c.description || '';
      document.getElementById('editPoints').value = c.points || c.current_points || c.base_points || 500;
      document.getElementById('editMinPoints').value = c.minimum_points || 100;
      document.getElementById('editDecay').value = c.decay_threshold || 30;

      // Authoritative Flag pre-fill (Sections 1, 3, 5, 13, 53)
      const flagInput = document.getElementById('editFlag');
      if (flagInput) {
        const storedFlag = c.flag || (Array.isArray(c.flags) && c.flags[0] ? (c.flags[0].value || c.flags[0].flag_value) : '') || '';
        flagInput.value = storedFlag;
      }

      // Authoritative Hints pre-fill (Sections 2, 3, 4, 14, 16)
      if (Array.isArray(c.hints) && c.hints.length > 0) {
        hintsState = c.hints.map((h, i) => ({
          id: h.id,
          text: h.text || h.content || '',
          content: h.content || h.text || '',
          cost: h.cost !== undefined ? h.cost : 50,
          order: h.order || h.order_index || (i + 1),
          enabled: h.enabled !== false
        }));
      } else if (c.hint) {
        hintsState = [{
          id: `h-init-0`,
          text: c.hint,
          content: c.hint,
          cost: c.hint_cost !== undefined ? c.hint_cost : 50,
          order: 1,
          enabled: true
        }];
      } else {
        hintsState = [];
      }
      renderHintsUI();
      
      const hasInst = !!(c.requiresInstance || c.runtime?.enabled || c.has_instance);
      document.getElementById('editHasInstance').checked = hasInst;
      if (runtimePanel) runtimePanel.style.display = hasInst ? 'block' : 'none';

      if (hasInst) {
        const rt = c.runtime || {};
        document.getElementById('editDockerImage').value = rt.image || c.docker_image || '';
        document.getElementById('editContainerPort').value = rt.containerPort || c.container_port || 80;
        document.getElementById('editHealthCheckPath').value = rt.healthCheck?.path || c.health_check_path || '/';
        document.getElementById('editInstanceDuration').value = rt.durationMinutes || c.instance_ttl_minutes || 30;
        document.getElementById('editCpuLimit').value = rt.resources?.cpus || c.cpu_limit || 0.5;
        document.getElementById('editMemoryLimit').value = rt.resources?.memory || c.memory_limit || '256m';
        document.getElementById('editPidLimit').value = rt.resources?.pidsLimit || 128;
      }

      // Load attached files
      await loadChallengeFiles(id);
    } catch (err) {
      console.error('Failed to prefill challenge:', err);
    }
  }

  // Update Live Preview Tab
  function updatePreview() {
    const title = document.getElementById('editTitle').value || 'Untitled Mission';
    const category = document.getElementById('editCategory').value || 'PWN';
    const difficulty = document.getElementById('editDifficulty').value || 'MEDIUM';
    const points = parseInt(document.getElementById('editPoints').value || 500, 10);
    const desc = document.getElementById('editDescription').value || 'No briefing details entered yet.';
    const missionId = document.getElementById('editMissionId')?.value || 'OP-PREVIEW';
    const hasInst = document.getElementById('editHasInstance')?.checked;

    const previewChallenge = {
      id: editingId || 'preview',
      mission_id: missionId,
      title,
      category,
      category_color: '#00ff9c',
      difficulty,
      points,
      solve_count: 0,
      description: desc,
      has_instance: !!hasInst,
      requiresInstance: !!hasInst,
      is_solved: false,
      files: [],
      hints: hintsState.map((h, idx) => ({
        id: h.id || `h-preview-${idx}`,
        content: h.text || h.content || '',
        cost: h.cost || 0,
        index: idx + 1,
        isUnlocked: false
      }))
    };

    try {
      sessionStorage.setItem('xploitx_challenge_preview', JSON.stringify(previewChallenge));
    } catch (e) {}

    document.getElementById('previewCardSlot').innerHTML = ChallengeCard.render(previewChallenge);
    document.getElementById('previewBriefingSlot').textContent = desc;
  }

  // Test Flag validation (Section 15)
  const testFlagBtn = document.getElementById('testFlagBtn');
  testFlagBtn.addEventListener('click', async () => {
    const flag = document.getElementById('editFlag').value.trim();
    if (!flag) {
      window.showWarning('Please enter a flag to validate.');
      return;
    }
    try {
      const res = await window.api.admin.testFlag({ flag, challengeId: editingId });
      if (res.valid) {
        window.showSuccess(res.message);
      } else {
        window.showError(res.message);
      }
    } catch (err) {
      window.showError(err.message);
    }
  });

  function validatePayload(payload) {
    const errors = [];
    if (!payload.title) errors.push('Mission title is required.');
    if (!payload.description) errors.push('Operational description/briefing is required.');
    if (!payload.category) errors.push('Mission category must be selected.');
    if (!payload.difficulty) errors.push('Difficulty rating must be designated.');
    if (!payload.points || isNaN(payload.points) || payload.points <= 0) errors.push('Base reward XP must be a positive integer.');
    if (payload.minimum_points && payload.minimum_points > payload.points) errors.push('Floor XP cannot exceed base XP.');
    if (!payload.flag) errors.push('Cryptographic flag configuration is required.');
    if (payload.requiresInstance && !payload.docker_image) errors.push('Docker image is required when sandbox is enabled.');
    return errors;
  }

  function displayValidationErrors(errors = []) {
    const banner = document.getElementById('publishValidationErrors');
    const list = document.getElementById('publishErrorsList');
    if (!banner || !list) return;

    if (errors.length === 0) {
      banner.style.display = 'none';
      list.innerHTML = '';
      return true;
    }

    list.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
    banner.style.display = 'block';
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  // Validate Only Button
  const validateOnlyBtn = document.getElementById('validateOnlyBtn');
  if (validateOnlyBtn) {
    validateOnlyBtn.addEventListener('click', async () => {
      const payload = getFormPayload();
      const localErrors = validatePayload(payload);
      if (localErrors.length > 0) {
        displayValidationErrors(localErrors);
        window.showError('VALIDATION FAILED: Correct highlighted deficiencies.');
        return;
      }

      if (editingId) {
        try {
          const res = await window.api.admin.getChallengeValidation(editingId);
          if (res && !res.valid) {
            displayValidationErrors(res.errors || ['Backend validation rejected mission.']);
            window.showError('VALIDATION DEFICIENCIES DETECTED');
            return;
          }
        } catch (e) {}
      }

      displayValidationErrors([]);
      window.showSuccess('✓ ALL VALIDATION CHECKS PASSED // READY FOR PUBLICATION');
    });
  }

  function getFormPayload() {
    const hasInstance = document.getElementById('editHasInstance')?.checked || false;
    const dockerImage = document.getElementById('editDockerImage') ? document.getElementById('editDockerImage').value.trim() : '';
    const containerPort = parseInt(document.getElementById('editContainerPort')?.value || 80, 10);
    const healthPath = document.getElementById('editHealthCheckPath')?.value.trim() || '/';
    const durationMinutes = parseInt(document.getElementById('editInstanceDuration')?.value || 30, 10);
    const cpuLimit = parseFloat(document.getElementById('editCpuLimit')?.value || 0.5);
    const memoryLimit = document.getElementById('editMemoryLimit')?.value.trim() || '256m';
    const pidLimit = parseInt(document.getElementById('editPidLimit')?.value || 128, 10);

    const flagVal = document.getElementById('editFlag') ? document.getElementById('editFlag').value.trim() : '';

    syncHintsFromDOM();
    const hintsPayload = hintsState
      .map((h, idx) => ({
        id: (h.id && !h.id.startsWith('temp_')) ? h.id : undefined,
        text: (h.text || h.content || '').trim(),
        content: (h.text || h.content || '').trim(),
        cost: isNaN(parseInt(h.cost, 10)) || parseInt(h.cost, 10) < 0 ? 0 : parseInt(h.cost, 10),
        order: isNaN(parseInt(h.order, 10)) ? (idx + 1) : parseInt(h.order, 10),
        order_index: isNaN(parseInt(h.order, 10)) ? (idx + 1) : parseInt(h.order, 10),
        enabled: h.enabled !== false
      }))
      .filter(h => h.text.length > 0);

    const firstHintText = hintsPayload[0]?.text || '';
    const firstHintCost = hintsPayload[0]?.cost !== undefined ? hintsPayload[0].cost : 50;

    return {
      title: document.getElementById('editTitle')?.value.trim() || '',
      mission_id: document.getElementById('editMissionId')?.value.trim() || '',
      category: document.getElementById('editCategory')?.value || 'PWN',
      difficulty: document.getElementById('editDifficulty')?.value || 'MEDIUM',
      description: document.getElementById('editDescription')?.value.trim() || '',
      flag: flagVal,
      flags: flagVal ? [{
        type: 'STATIC',
        value: flagVal,
        case_sensitive: true,
        enabled: true
      }] : [],
      points: parseInt(document.getElementById('editPoints')?.value || 500, 10),
      minimum_points: parseInt(document.getElementById('editMinPoints')?.value || 100, 10),
      decay_threshold: parseInt(document.getElementById('editDecay')?.value || 30, 10),
      hint: firstHintText,
      hint_cost: firstHintCost,
      hints: hintsPayload,
      has_instance: hasInstance,
      requiresInstance: hasInstance,
      docker_image: hasInstance ? (dockerImage || 'xploitx/vault:latest') : null,
      container_port: containerPort,
      health_check_path: healthPath,
      instance_ttl_minutes: durationMinutes,
      cpu_limit: cpuLimit,
      memory_limit: memoryLimit,
      runtime: hasInstance ? {
        enabled: true,
        image: dockerImage || 'xploitx/vault:latest',
        containerPort,
        protocol: 'http',
        healthCheck: { type: 'http', path: healthPath },
        resources: { cpus: cpuLimit, memory: memoryLimit, pidsLimit: pidLimit },
        durationMinutes
      } : { enabled: false },
      status: 'PUBLISHED'
    };
  }

  // Save Challenge Handler (Draft or Publish)
  const form = document.getElementById('challengeStudioForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = getFormPayload();
    const localErrors = validatePayload(payload);
    if (!displayValidationErrors(localErrors)) {
      window.showError('CANNOT PUBLISH: Resolve validation deficiencies first.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'TRANSMITTING DOSSIER...';

    try {
      let targetChallengeId = editingId;

      if (editingId) {
        await window.api.admin.updateChallenge(editingId, payload);
        window.showSuccess('MISSION UPDATED SUCCESSFULLY');
      } else {
        const res = await window.api.admin.createChallenge(payload);
        targetChallengeId = res.challenge?.id || res.challenge?._id;
        window.showSuccess('NEW MISSION COMMISSIONED');
      }

      // If files were selected in input, upload them to the target challenge
      const stagedFiles = fileInput ? fileInput.files : null;
      if (stagedFiles && stagedFiles.length > 0 && targetChallengeId) {
        const isServerless = window.location.hostname.includes('vercel.app');
        const maxBytes = isServerless ? (4.5 * 1024 * 1024) : (50 * 1024 * 1024);
        const maxMbText = isServerless ? '4.5 MB' : '50 MB';

        let hasOversized = false;
        for (let i = 0; i < stagedFiles.length; i++) {
          if (stagedFiles[i].size > maxBytes) {
            window.showWarning(`Asset '${stagedFiles[i].name}' exceeds limit of ${maxMbText}. Upload skipped.`);
            hasOversized = true;
            break;
          }
        }

        if (!hasOversized) {
          submitBtn.textContent = 'TRANSMITTING & STORING ASSETS...';
          const formData = new FormData();
          for (let i = 0; i < stagedFiles.length; i++) {
            formData.append('files', stagedFiles[i]);
          }
          try {
            await window.api.admin.uploadChallengeFiles(targetChallengeId, formData);
            window.showSuccess('✓ Staged assets attached and secured in persistent storage.');
          } catch (uploadErr) {
            window.showWarning(`Mission saved, but asset upload had warning: ${uploadErr.message}`);
          }
        }
      }

      setTimeout(() => {
        window.location.href = '/admin/challenges.html';
      }, 700);
    } catch (err) {
      window.showError(err.message);
      displayValidationErrors([err.message]);
      submitBtn.disabled = false;
      submitBtn.textContent = 'PUBLISH MISSION';
    }
  });
});
