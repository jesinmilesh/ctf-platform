/**
 * XPLOITX // CYBER BATTLEFIELD
 * Mission Studio / Challenge Editor (assets/js/admin/challenge-editor.js)
 * Implements Sections 14, 15, 16 of Architectural Blueprint
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
  }

  async function loadExistingChallenge(id) {
    try {
      const c = await window.api.getChallenge(id);
      document.getElementById('editTitle').value = c.title || '';
      document.getElementById('editMissionId').value = c.mission_id || '';
      document.getElementById('editCategory').value = c.category || 'CRYPTO';
      document.getElementById('editDifficulty').value = c.difficulty || 'MEDIUM';
      document.getElementById('editDescription').value = c.description || '';
      document.getElementById('editPoints').value = c.points || 500;
      document.getElementById('editMinPoints').value = c.minimum_points || 100;
      document.getElementById('editDecay').value = c.decay_threshold || 30;
      document.getElementById('editHasInstance').checked = !!c.has_instance;
    } catch (err) {
      console.error('Failed to prefill challenge:', err);
    }
  }

  // Update Live Preview Tab
  function updatePreview() {
    const title = document.getElementById('editTitle').value || 'Untitled Mission';
    const category = document.getElementById('editCategory').value || 'CRYPTO';
    const difficulty = document.getElementById('editDifficulty').value || 'MEDIUM';
    const points = document.getElementById('editPoints').value || 500;
    const desc = document.getElementById('editDescription').value || 'No briefing details entered yet.';

    const mockChallenge = {
      id: 'preview',
      title,
      category,
      difficulty,
      points,
      solve_count: 0,
      is_solved: false
    };

    document.getElementById('previewCardSlot').innerHTML = ChallengeCard.render(mockChallenge);
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

  // Save Challenge Handler (Draft or Publish)
  const form = document.getElementById('challengeStudioForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
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
      has_instance: document.getElementById('editHasInstance').checked,
      status: 'PUBLISHED'
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'TRANSMITTING DOSSIER...';

    try {
      if (editingId) {
        await window.api.admin.updateChallenge(editingId, payload);
        window.showSuccess('MISSION UPDATED SUCCESSFULLY');
      } else {
        const res = await window.api.admin.createChallenge(payload);
        window.showSuccess('NEW MISSION COMMISSIONED');
      }
      setTimeout(() => {
        window.location.href = '/admin/challenges.html';
      }, 700);
    } catch (err) {
      window.showError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'PUBLISH MISSION';
    }
  });
});
