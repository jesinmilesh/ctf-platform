/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Settings & Competition Configuration (assets/js/admin/settings.js)
 * Implements Sections 24 & 25 of Architectural Blueprint
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'settings');
  await window.authManager.requireAdmin('/admin/login.html');

  const form = document.getElementById('adminSettingsForm');

  async function loadSettings() {
    try {
      const compRes = await window.api.getCompetition();
      const comp = (compRes && compRes.competition) || {};

      document.getElementById('setCompName').value = comp.name || 'XPLOITX 2.0 BETA';
      document.getElementById('setTagline').value = comp.tagline || 'ENTER THE DIGITAL BATTLEFIELD';
      document.getElementById('setFlagPrefix').value = comp.flagPrefix || 'XploitXβ{';
      document.getElementById('setFlagSuffix').value = comp.flagSuffix || '}';
      document.getElementById('setMaxTeamSize').value = comp.max_team_size || 4;
      document.getElementById('setDynamicScoring').checked = comp.dynamic_scoring !== false;
      document.getElementById('setDecayThreshold').value = comp.scoring_decay || 30;
      document.getElementById('setRateLimit').value = 10;
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      competitionName: document.getElementById('setCompName').value.trim(),
      tagline: document.getElementById('setTagline').value.trim(),
      flagPrefix: document.getElementById('setFlagPrefix').value.trim(),
      flagSuffix: document.getElementById('setFlagSuffix').value.trim(),
      maxTeamSize: parseInt(document.getElementById('setMaxTeamSize').value, 10),
      dynamicScoring: document.getElementById('setDynamicScoring').checked,
      decayThreshold: parseInt(document.getElementById('setDecayThreshold').value, 10),
      submissionRateLimit: parseInt(document.getElementById('setRateLimit').value, 10)
    };

    try {
      await window.api.admin.updateSettings(payload);
      window.showSuccess('C2 COMPETITION CONFIGURATION SAVED');
    } catch (err) {
      window.showError(err.message);
    }
  });

  loadSettings();
});
