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
  const selectedCountEl = document.getElementById('selectedFileCount');
  const previewBox = document.getElementById('selectedFilesPreview');
  const refreshFilesBtn = document.getElementById('refreshFilesBtn');

  if (chooseFilesBtn && fileInput) {
    chooseFilesBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files || []);
      if (files.length > 0) {
        if (selectedCountEl) selectedCountEl.textContent = files.length;
        if (previewBox) {
          previewBox.style.display = 'block';
          previewBox.innerHTML = `
            <strong>Selected for transmission (${files.length}):</strong><br>
            ${files.map(f => `• ${window.Utils.escapeHTML(f.name)} (${formatFileSize(f.size)})`).join('<br>')}
          `;
        }
        if (uploadFilesBtn && editingId) {
          uploadFilesBtn.style.display = 'inline-block';
        }
      } else {
        if (previewBox) previewBox.style.display = 'none';
        if (uploadFilesBtn) uploadFilesBtn.style.display = 'none';
      }
    });
  }

  if (uploadFilesBtn) {
    uploadFilesBtn.addEventListener('click', async () => {
      if (!editingId) return;
      const files = fileInput.files;
      if (!files || files.length === 0) {
        window.showWarning('Please select assets to upload.');
        return;
      }

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      uploadFilesBtn.disabled = true;
      uploadFilesBtn.textContent = 'TRANSMITTING ASSETS...';

      try {
        await window.api.admin.uploadChallengeFiles(editingId, formData);
        window.showSuccess(`✓ ${files.length} asset(s) successfully secured in storage.`);
        fileInput.value = '';
        if (previewBox) previewBox.style.display = 'none';
        uploadFilesBtn.style.display = 'none';
        await loadChallengeFiles(editingId);
      } catch (err) {
        window.showError(`UPLOAD FAILED: ${err.message}`);
      } finally {
        uploadFilesBtn.disabled = false;
        uploadFilesBtn.innerHTML = `⬆ UPLOAD SELECTED (<span id="selectedFileCount">0</span>)`;
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
      const c = await window.api.getChallenge(id);
      document.getElementById('editTitle').value = c.title || '';
      const missionIdEl = document.getElementById('editMissionId');
      if (missionIdEl) {
        missionIdEl.value = c.challengeId || c.mission_id || '';
        missionIdEl.readOnly = true;
        missionIdEl.style.opacity = '0.7';
      }
      document.getElementById('editCategory').value = c.category || c.category_name || 'PWN';
      document.getElementById('editDifficulty').value = c.difficulty || 'MEDIUM';
      document.getElementById('editDescription').value = c.description || '';
      document.getElementById('editPoints').value = c.points || 500;
      document.getElementById('editMinPoints').value = c.minimum_points || 100;
      document.getElementById('editDecay').value = c.decay_threshold || 30;
      
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
      hints: []
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
    if (!payload.flag && !editingId) errors.push('Cryptographic flag configuration is required.');
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
    const hasInstance = document.getElementById('editHasInstance').checked;
    const dockerImage = document.getElementById('editDockerImage') ? document.getElementById('editDockerImage').value.trim() : '';
    const containerPort = parseInt(document.getElementById('editContainerPort')?.value || 80, 10);
    const healthPath = document.getElementById('editHealthCheckPath')?.value.trim() || '/';
    const durationMinutes = parseInt(document.getElementById('editInstanceDuration')?.value || 30, 10);
    const cpuLimit = parseFloat(document.getElementById('editCpuLimit')?.value || 0.5);
    const memoryLimit = document.getElementById('editMemoryLimit')?.value.trim() || '256m';
    const pidLimit = parseInt(document.getElementById('editPidLimit')?.value || 128, 10);

    return {
      title: document.getElementById('editTitle').value.trim(),
      mission_id: document.getElementById('editMissionId').value.trim(),
      category: document.getElementById('editCategory').value,
      difficulty: document.getElementById('editDifficulty').value,
      description: document.getElementById('editDescription').value.trim(),
      flag: document.getElementById('editFlag').value.trim(),
      points: parseInt(document.getElementById('editPoints').value, 10),
      minimum_points: parseInt(document.getElementById('editMinPoints').value, 10),
      decay_threshold: parseInt(document.getElementById('editDecay').value, 10),
      hint: document.getElementById('editHint').value.trim(),
      hint_cost: parseInt(document.getElementById('editHintCost').value || 50, 10),
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
        submitBtn.textContent = 'TRANSMITTING ASSETS...';
        const formData = new FormData();
        for (let i = 0; i < stagedFiles.length; i++) {
          formData.append('files', stagedFiles[i]);
        }
        try {
          await window.api.admin.uploadChallengeFiles(targetChallengeId, formData);
          window.showSuccess('✓ Staged assets attached and saved.');
        } catch (uploadErr) {
          window.showWarning(`Mission saved, but asset upload had warning: ${uploadErr.message}`);
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
