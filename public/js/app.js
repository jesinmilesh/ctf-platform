/**
 * XPLOITX // CYBER BATTLEFIELD
 * Core Application Controller & UI Orchestrator
 */

class AppController {
  constructor() {
    this.state = window.stateManager.state;
    this.currentView = 'view-landing';
    this.currentCategoryFilter = 'ALL';
    this.currentDifficultyFilter = 'ALL';
    this.currentStatusFilter = 'ALL';
    this.searchQuery = '';
    this.sortBy = 'POINTS_DESC';
    this.activeMission = null;
    this.instanceTimers = {};
    this.simulatedEventTimer = null;
  }

  init() {
    this.recalculateAll();
    this.bindGlobalEvents();
    this.bindNavigation();
    this.bindFilters();
    this.bindMissionDossier();
    this.bindAdminControls();
    this.bindCommandPalette();
    this.startCountdownClock();
    this.startSimulatedBattlefieldFeed();

    // Check hash or default to landing
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`view-${hash}`)) {
      this.switchView(`view-${hash}`);
    } else {
      this.switchView('view-landing');
    }

    this.renderAll();
  }

  recalculateAll() {
    const result = window.ScoringEngine.recomputeLeaderboard(
      this.state.challenges,
      this.state.teams,
      this.state.solves,
      this.state.unlockedHints
    );
    this.state.teams = result.rankedTeams;

    // Update user stats based on myTeam
    const myTeam = this.state.teams.find(t => t.id === this.state.currentUser.teamId);
    if (myTeam) {
      this.state.currentUser.xp = myTeam.score;
      this.state.myTeam.score = myTeam.score;
      this.state.myTeam.rank = myTeam.rank;
    }
    window.stateManager.saveState();
  }

  // ----------------------------------------------------
  // ROUTING & VIEW NAVIGATION
  // ----------------------------------------------------
  switchView(viewId) {
    window.tacticalAudio.playClick();
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewId;
      window.scrollTo(0, 0);

      const navKey = viewId.replace('view-', '');
      window.location.hash = navKey;

      const activeNav = document.querySelector(`.nav-link[data-view="${viewId}"]`);
      if (activeNav) activeNav.classList.add('active');

      const activeMob = document.querySelector(`.mobile-nav-btn[data-view="${viewId}"]`);
      if (activeMob) activeMob.classList.add('active');

      // Specialized view refreshes
      if (viewId === 'view-scoreboard') {
        this.renderScoreboardCanvas();
      }
    }
  }

  bindNavigation() {
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const target = btn.getAttribute('data-view');
        this.switchView(target);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      const viewId = `view-${hash}`;
      if (document.getElementById(viewId) && this.currentView !== viewId) {
        this.switchView(viewId);
      }
    });

    // Audio mute toggle
    const audioBtn = document.getElementById('audioToggleBtn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isMuted = window.tacticalAudio.toggleMute();
        audioBtn.classList.toggle('muted', isMuted);
        audioBtn.innerHTML = isMuted ? '🔇 HUD MUTED' : '🔊 HUD AUDIO';
        if (!isMuted) window.tacticalAudio.playClick();
      });
    }

    // Role switcher (Player <-> Admin)
    const roleBtn = document.getElementById('roleToggleBtn');
    if (roleBtn) {
      roleBtn.addEventListener('click', () => {
        const newRole = this.state.currentUser.role === 'ADMIN' ? 'PLAYER' : 'ADMIN';
        this.state.currentUser.role = newRole;
        window.stateManager.saveState();
        roleBtn.textContent = `CLEARANCE: ${newRole}`;
        document.getElementById('adminNavBtn').style.display = newRole === 'ADMIN' ? 'flex' : 'none';
        this.showToast(`ACCESS LEVEL ELEVATED TO ${newRole}`, 'info');
        window.tacticalAudio.playClick();
        if (newRole === 'ADMIN') {
          this.switchView('view-admin');
        } else {
          this.switchView('view-command');
        }
      });
    }
  }

  // ----------------------------------------------------
  // GLOBAL KEYBOARD SHORTCUTS & COMMAND PALETTE (CTRL+K)
  // ----------------------------------------------------
  bindCommandPalette() {
    const paletteBackdrop = document.getElementById('commandPalette');
    const paletteInput = document.getElementById('paletteInput');
    const paletteResults = document.getElementById('paletteResults');
    const searchTrigger = document.getElementById('globalSearchTrigger');

    const openPalette = () => {
      paletteBackdrop.classList.add('active');
      paletteInput.value = '';
      paletteInput.focus();
      this.renderPaletteResults('');
      window.tacticalAudio.playClick();
    };

    const closePalette = () => {
      paletteBackdrop.classList.remove('active');
    };

    if (searchTrigger) searchTrigger.addEventListener('click', openPalette);

    paletteBackdrop.addEventListener('click', (e) => {
      if (e.target === paletteBackdrop) closePalette();
    });

    paletteInput.addEventListener('input', (e) => {
      this.renderPaletteResults(e.target.value.trim().toLowerCase());
    });

    // Keyboard listener
    window.addEventListener('keydown', (e) => {
      // Ctrl + K / Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (paletteBackdrop.classList.contains('active')) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (e.key === 'Escape') {
        closePalette();
        this.closeMissionDossier();
        this.closeAdminChallengeModal();
        return;
      }

      // Quick Nav Shortcuts (G then key) if not typing in an input
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key.toLowerCase() === 'c') this.switchView('view-missions');
        if (e.key.toLowerCase() === 'l') this.switchView('view-scoreboard');
        if (e.key.toLowerCase() === 't') this.switchView('view-team');
        if (e.key.toLowerCase() === 'p') this.switchView('view-profile');
        if (e.key.toLowerCase() === 'h') this.switchView('view-command');
      }
    });
  }

  renderPaletteResults(query) {
    const paletteResults = document.getElementById('paletteResults');
    paletteResults.innerHTML = '';

    const items = [];

    // Views
    items.push({ type: 'NAV', title: 'GO TO: COMMAND CENTER', view: 'view-command', icon: '⚡' });
    items.push({ type: 'NAV', title: 'GO TO: MISSIONS MATRIX', view: 'view-missions', icon: '🎯' });
    items.push({ type: 'NAV', title: 'GO TO: BATTLEFIELD SCOREBOARD', view: 'view-scoreboard', icon: '🏆' });
    items.push({ type: 'NAV', title: 'GO TO: COMBAT TEAM DOSSIER', view: 'view-team', icon: '🛡' });
    items.push({ type: 'NAV', title: 'GO TO: OPERATIVE PROFILE', view: 'view-profile', icon: '👤' });
    if (this.state.currentUser.role === 'ADMIN') {
      items.push({ type: 'NAV', title: 'GO TO: CONTROL ROOM C2', view: 'view-admin', icon: '⚙' });
    }

    // Challenges
    this.state.challenges.forEach(ch => {
      items.push({
        type: 'MISSION',
        title: `[${ch.missionId}] ${ch.title} (${ch.category}) - ${ch.currentPoints} XP`,
        challenge: ch,
        icon: '⚔'
      });
    });

    const filtered = items.filter(item => item.title.toLowerCase().includes(query));

    if (filtered.length === 0) {
      paletteResults.innerHTML = `<div style="padding:16px; color:var(--x-text-muted); font-family:var(--font-mono); font-size:12px; text-align:center;">NO CLASSIFIED ENTRIES MATCHING "${query}"</div>`;
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'palette-item';
      row.innerHTML = `
        <span style="display:flex; align-items:center; gap:8px;">
          <span>${item.icon}</span>
          <span>${item.title}</span>
        </span>
        <span class="kbd-badge">${item.type}</span>
      `;
      row.addEventListener('click', () => {
        document.getElementById('commandPalette').classList.remove('active');
        if (item.type === 'NAV') {
          this.switchView(item.view);
        } else if (item.type === 'MISSION') {
          this.openMissionDossier(item.challenge.id);
        }
      });
      paletteResults.appendChild(row);
    });
  }

  // ----------------------------------------------------
  // MISSIONS FILTERING & RENDERING
  // ----------------------------------------------------
  bindFilters() {
    // Category chips
    document.querySelectorAll('.cat-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        window.tacticalAudio.playClick();
        document.querySelectorAll('.cat-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentCategoryFilter = chip.getAttribute('data-cat');
        this.renderMissionsGrid();
      });
    });

    // Difficulty filter
    const diffSelect = document.getElementById('diffFilterSelect');
    if (diffSelect) {
      diffSelect.addEventListener('change', (e) => {
        this.currentDifficultyFilter = e.target.value;
        this.renderMissionsGrid();
      });
    }

    // Status filter
    const statusSelect = document.getElementById('statusFilterSelect');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.currentStatusFilter = e.target.value;
        this.renderMissionsGrid();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('sortFilterSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderMissionsGrid();
      });
    }

    // Search input
    const searchInput = document.getElementById('missionSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderMissionsGrid();
      });
    }
  }

  renderMissionsGrid() {
    const grid = document.getElementById('challengesGrid');
    if (!grid) return;

    let list = this.state.challenges.filter(ch => ch.status === 'LIVE' || this.state.currentUser.role === 'ADMIN');

    // Filter Category
    if (this.currentCategoryFilter !== 'ALL') {
      list = list.filter(ch => ch.category.toUpperCase() === this.currentCategoryFilter.toUpperCase());
    }

    // Filter Difficulty
    if (this.currentDifficultyFilter !== 'ALL') {
      list = list.filter(ch => ch.difficulty.toUpperCase() === this.currentDifficultyFilter.toUpperCase());
    }

    // Filter Status
    if (this.currentStatusFilter === 'SOLVED') {
      list = list.filter(ch => this.isChallengeSolved(ch.id));
    } else if (this.currentStatusFilter === 'UNSOLVED') {
      list = list.filter(ch => !this.isChallengeSolved(ch.id));
    }

    // Search Query
    if (this.searchQuery) {
      list = list.filter(ch => 
        ch.title.toLowerCase().includes(this.searchQuery) ||
        ch.missionId.toLowerCase().includes(this.searchQuery) ||
        ch.category.toLowerCase().includes(this.searchQuery) ||
        (ch.tags && ch.tags.some(t => t.toLowerCase().includes(this.searchQuery)))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (this.sortBy === 'POINTS_DESC') return b.currentPoints - a.currentPoints;
      if (this.sortBy === 'POINTS_ASC') return a.currentPoints - b.currentPoints;
      if (this.sortBy === 'SOLVES_DESC') return b.solveCount - a.solveCount;
      if (this.sortBy === 'SOLVES_ASC') return a.solveCount - b.solveCount;
      return a.title.localeCompare(b.title);
    });

    grid.innerHTML = '';

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; padding:40px; text-align:center; background:var(--x-surface); border:1px solid var(--x-border);">
          <div style="font-family:var(--font-display); font-size:16px; color:var(--x-primary); margin-bottom:8px;">NO MISSIONS DETECTED</div>
          <div style="font-family:var(--font-mono); font-size:12px; color:var(--x-text-muted);">Adjust tactical filters or clear search query to inspect other coordinates.</div>
        </div>
      `;
      return;
    }

    list.forEach(ch => {
      const isSolved = this.isChallengeSolved(ch.id);
      const card = document.createElement('div');
      card.className = `challenge-card panel-corner-accents ${isSolved ? 'solved' : ''}`;
      
      const diffClass = `badge-diff-${ch.difficulty.toLowerCase()}`;
      const catClass = `badge-${ch.category.toLowerCase()}`;

      card.innerHTML = `
        <div>
          <div class="challenge-card-top">
            <span class="badge-tactical ${catClass}">${ch.category}</span>
            <span class="mission-id-tag">${ch.missionId}</span>
          </div>

          <h3 class="challenge-card-title">${ch.title}</h3>

          <div class="challenge-points-row">
            <span class="challenge-points-val">${ch.currentPoints}</span>
            <span style="font-size:12px; color:var(--x-primary); font-family:var(--font-heading); font-weight:700;">XP</span>
            <span class="challenge-points-decay">(${ch.solveCount} SOLVES)</span>
          </div>
        </div>

        <div>
          <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
            <span class="badge-tactical ${diffClass}">${ch.difficulty}</span>
            ${ch.hasInstance ? '<span class="badge-tactical" style="background:rgba(0,216,246,0.12); color:var(--x-cyan); border-color:rgba(0,216,246,0.3);">⚡ INSTANCE</span>' : ''}
          </div>

          <div class="challenge-card-bottom">
            <span>OP // ${ch.author}</span>
            <button class="btn-tactical btn-ghost btn-sm">
              ${isSolved ? 'REVIEW' : 'OPEN MISSION'}
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        window.tacticalAudio.playClick();
        this.openMissionDossier(ch.id);
      });

      grid.appendChild(card);
    });

    // Update mission counter
    const counter = document.getElementById('missionsCountDisplay');
    if (counter) counter.textContent = `${list.length} / ${this.state.challenges.length} MISSIONS VISIBLE`;
  }

  isChallengeSolved(challengeId) {
    return this.state.solves.some(s => s.challengeId === challengeId && s.teamId === this.state.currentUser.teamId);
  }

  // ----------------------------------------------------
  // MISSION DOSSIER MODAL
  // ----------------------------------------------------
  bindMissionDossier() {
    const modalBackdrop = document.getElementById('missionModal');
    const closeBtn = document.getElementById('closeMissionModalBtn');
    const submitBtn = document.getElementById('submitFlagBtn');
    const flagInput = document.getElementById('flagInputBox');

    if (closeBtn) closeBtn.addEventListener('click', () => this.closeMissionDossier());

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) this.closeMissionDossier();
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.handleFlagSubmission());
    }

    if (flagInput) {
      flagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleFlagSubmission();
      });
    }

    // Deploy instance button
    const deployBtn = document.getElementById('deployInstanceBtn');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => this.handleDeployInstance());
    }
  }

  openMissionDossier(challengeId) {
    const ch = this.state.challenges.find(c => c.id === challengeId);
    if (!ch) return;

    this.activeMission = ch;
    const modal = document.getElementById('missionModal');

    document.getElementById('dossierCategoryBadge').textContent = ch.category;
    document.getElementById('dossierCategoryBadge').className = `badge-tactical badge-${ch.category.toLowerCase()}`;
    document.getElementById('dossierMissionId').textContent = ch.missionId;
    document.getElementById('dossierTitle').textContent = ch.title;
    document.getElementById('dossierPoints').textContent = `${ch.currentPoints} XP`;
    document.getElementById('dossierDifficulty').textContent = ch.difficulty;
    document.getElementById('dossierDifficulty').className = `badge-tactical badge-diff-${ch.difficulty.toLowerCase()}`;
    document.getElementById('dossierAuthor').textContent = ch.author;
    document.getElementById('dossierSolves').textContent = `${ch.solveCount} OPERATIVES`;

    // Markdown / Briefing
    document.getElementById('dossierBriefingText').textContent = ch.briefing;

    // Evidence Vault
    const filesContainer = document.getElementById('dossierEvidenceVault');
    filesContainer.innerHTML = '';
    if (ch.evidenceFiles && ch.evidenceFiles.length > 0) {
      ch.evidenceFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'evidence-file-item';
        item.innerHTML = `
          <div class="file-info-left">
            <span style="font-size:16px;">💾</span>
            <div>
              <div style="font-weight:700; color:#fff;">${file.name}</div>
              <div class="file-checksum">SHA256: ${file.sha256.substring(0, 16)}...</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="color:var(--x-text-muted);">${file.size}</span>
            <button class="btn-tactical btn-ghost btn-sm" onclick="window.app.downloadEvidenceSim('${file.name}')">
              DOWNLOAD
            </button>
          </div>
        `;
        filesContainer.appendChild(item);
      });
      document.getElementById('evidenceVaultSection').style.display = 'block';
    } else {
      document.getElementById('evidenceVaultSection').style.display = 'none';
    }

    // Instance Section
    const instanceSec = document.getElementById('instanceSection');
    if (ch.hasInstance) {
      instanceSec.style.display = 'block';
      this.updateInstanceUI();
    } else {
      instanceSec.style.display = 'none';
    }

    // Hints Section
    const hintsSec = document.getElementById('hintsSection');
    const hintsList = document.getElementById('hintsList');
    hintsList.innerHTML = '';
    if (ch.hints && ch.hints.length > 0) {
      hintsSec.style.display = 'block';
      ch.hints.forEach((hint, idx) => {
        const isUnlocked = this.state.unlockedHints.some(h => h.hintId === hint.id && h.teamId === this.state.currentUser.teamId);
        const card = document.createElement('div');
        card.className = 'hint-card';

        if (isUnlocked) {
          card.innerHTML = `
            <div>
              <div style="font-family:var(--font-heading); font-weight:700; font-size:11px; color:var(--x-warning); margin-bottom:4px;">
                💡 HINT #${idx + 1} [DECRYPTED]
              </div>
              <div class="hint-unlocked-text">${hint.content}</div>
            </div>
            <span class="badge-tactical" style="color:var(--x-warning); border-color:var(--x-warning);">REVEALED</span>
          `;
        } else {
          card.innerHTML = `
            <div>
              <div style="font-family:var(--font-heading); font-weight:700; font-size:11px; color:#fff;">
                🔒 CLASSIFIED HINT #${idx + 1}
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--x-text-muted);">
                Penalty Cost: -${hint.cost} XP
              </div>
            </div>
            <button class="btn-tactical btn-ghost btn-sm" onclick="window.app.unlockHint('${hint.id}', ${hint.cost})">
              REVEAL HINT (-${hint.cost} XP)
            </button>
          `;
        }
        hintsList.appendChild(card);
      });
    } else {
      hintsSec.style.display = 'none';
    }

    // Flag input setup
    const flagInput = document.getElementById('flagInputBox');
    const flagFeedback = document.getElementById('flagFeedbackMsg');
    flagFeedback.style.display = 'none';

    const isSolved = this.isChallengeSolved(ch.id);
    if (isSolved) {
      flagInput.value = ch.flagValue || 'XploitX{FLAG_ALREADY_CAPTURED}';
      flagInput.disabled = true;
      document.getElementById('submitFlagBtn').disabled = true;
      flagFeedback.className = 'flag-feedback-msg success';
      flagFeedback.textContent = '✓ MISSION COMPLETE: Flag captured by team.';
      flagFeedback.style.display = 'block';
    } else {
      flagInput.value = 'XploitX{';
      flagInput.disabled = false;
      document.getElementById('submitFlagBtn').disabled = false;
      flagFeedback.style.display = 'none';
    }

    modal.classList.add('active');
  }

  closeMissionDossier() {
    const modal = document.getElementById('missionModal');
    if (modal) modal.classList.remove('active');
    this.activeMission = null;
  }

  downloadEvidenceSim(filename) {
    window.tacticalAudio.playClick();
    this.showToast(`DOWNLOADING ENCRYPTED EVIDENCE: ${filename}`, 'info');

    // Create a mock blob download
    const blob = new Blob([`XPLOITX // EVIDENCE ARCHIVE [${filename}]\nCLASSIFIED BATTLEFIELD TELEMETRY FILE\nCHECKSUM VERIFIED.`], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  handleDeployInstance() {
    if (!this.activeMission) return;
    const chId = this.activeMission.id;
    window.tacticalAudio.playClick();

    const statusEl = document.getElementById('instanceStatusBadge');
    const addrEl = document.getElementById('instanceAddressDisplay');
    const btn = document.getElementById('deployInstanceBtn');

    if (this.state.activeInstances[chId]) {
      // Terminate instance
      delete this.state.activeInstances[chId];
      if (this.instanceTimers[chId]) clearInterval(this.instanceTimers[chId]);
      window.stateManager.saveState();
      this.updateInstanceUI();
      this.showToast('ISOLATED SANDBOX CONTAINER TERMINATED', 'info');
      return;
    }

    // Deploy instance
    statusEl.innerHTML = '● INITIALIZING CONTAINER...';
    btn.disabled = true;

    setTimeout(() => {
      this.state.activeInstances[chId] = {
        host: this.activeMission.instanceHost || '10.10.42.88',
        port: this.activeMission.instancePort || 8080,
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes TTL
      };
      window.stateManager.saveState();
      this.updateInstanceUI();
      window.tacticalAudio.playClick();
      this.showToast(`CONTAINER SPAWNED AT ${this.state.activeInstances[chId].host}:${this.state.activeInstances[chId].port}`, 'success');
    }, 1200);
  }

  updateInstanceUI() {
    if (!this.activeMission) return;
    const chId = this.activeMission.id;
    const inst = this.state.activeInstances[chId];
    const statusEl = document.getElementById('instanceStatusBadge');
    const addrEl = document.getElementById('instanceAddressDisplay');
    const btn = document.getElementById('deployInstanceBtn');

    if (inst && inst.expiresAt > Date.now()) {
      statusEl.innerHTML = '<span style="color:var(--x-primary);">● ONLINE (ISOLATED)</span>';
      addrEl.textContent = `${inst.host}:${inst.port}`;
      addrEl.style.display = 'inline-block';
      btn.textContent = 'TERMINATE CONTAINER';
      btn.className = 'btn-tactical btn-danger btn-sm';
      btn.disabled = false;
    } else {
      statusEl.innerHTML = '<span style="color:var(--x-text-muted);">● OFFLINE</span>';
      addrEl.style.display = 'none';
      btn.textContent = '⚡ DEPLOY ISOLATED INSTANCE';
      btn.className = 'btn-tactical btn-primary btn-sm';
      btn.disabled = false;
    }
  }

  unlockHint(hintId, cost) {
    if (!confirm(`CONFIRMATION REQUIRED:\nReveal classified hint for -${cost} XP deduction from team score?`)) {
      return;
    }

    window.tacticalAudio.playHint();
    this.state.unlockedHints.push({
      id: `uh-${Date.now()}`,
      hintId: hintId,
      teamId: this.state.currentUser.teamId,
      userId: this.state.currentUser.id,
      cost: cost,
      unlockedAt: Date.now()
    });

    this.recalculateAll();
    this.renderAll();
    this.openMissionDossier(this.activeMission.id);
    this.showToast(`HINT DECRYPTED: -${cost} XP deducted from team`, 'warning');
  }

  handleFlagSubmission() {
    if (!this.activeMission) return;
    const flagInput = document.getElementById('flagInputBox');
    const feedback = document.getElementById('flagFeedbackMsg');
    const submitted = flagInput.value.trim();

    if (!submitted) {
      feedback.className = 'flag-feedback-msg error';
      feedback.textContent = 'ERROR: No flag signature provided.';
      feedback.style.display = 'block';
      window.tacticalAudio.playError();
      return;
    }

    // Check if already solved
    if (this.isChallengeSolved(this.activeMission.id)) {
      feedback.className = 'flag-feedback-msg success';
      feedback.textContent = 'Mission flag was already captured by your operatives.';
      feedback.style.display = 'block';
      return;
    }

    // Validate Flag
    const result = window.FlagValidator.validate(submitted, this.activeMission, this.state.currentUser.teamId);

    // Audit Log Entry
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.state.submissionsLog.unshift({
      id: `sub-${Date.now()}`,
      challengeMissionId: this.activeMission.missionId,
      teamName: this.state.myTeam.name,
      submittedFlag: submitted.length > 25 ? submitted.substring(0, 25) + '...' : submitted,
      status: result.valid ? 'CORRECT' : 'INCORRECT',
      ip: '10.8.0.4',
      time: nowTime
    });

    if (result.valid) {
      // Check if FIRST BLOOD
      const isFirstBlood = this.activeMission.solveCount === 0;

      // Register Solve
      this.state.solves.push({
        id: `s-${Date.now()}`,
        challengeId: this.activeMission.id,
        teamId: this.state.currentUser.teamId,
        userId: this.state.currentUser.id,
        timestamp: Date.now(),
        isFirstBlood: isFirstBlood
      });

      if (!this.state.currentUser.solvedChallenges.includes(this.activeMission.id)) {
        this.state.currentUser.solvedChallenges.push(this.activeMission.id);
      }

      // Add to activity feed
      const activityText = isFirstBlood
        ? `⚡ FIRST BLOOD: ${this.state.myTeam.name} captured ${this.activeMission.title} (${this.activeMission.missionId}) [+${this.activeMission.currentPoints} XP]`
        : `✓ SOLVE: ${this.state.myTeam.name} captured ${this.activeMission.title} (${this.activeMission.missionId}) [+${this.activeMission.currentPoints} XP]`;

      this.state.activityFeed.unshift({
        id: `act-${Date.now()}`,
        type: isFirstBlood ? 'first-blood' : 'solve',
        text: activityText,
        time: nowTime
      });

      // Recalculate dynamic scores
      this.recalculateAll();

      if (isFirstBlood) {
        window.tacticalAudio.playFirstBlood();
        this.triggerFirstBloodBanner(`⚡ FIRST BLOOD! Team NEXUS breached ${this.activeMission.missionId} (${this.activeMission.title})`);
      } else {
        window.tacticalAudio.playSuccess();
      }

      feedback.className = 'flag-feedback-msg success';
      feedback.textContent = `🎯 CAPTURE CONFIRMED! +${this.activeMission.currentPoints} XP awarded to Team NEXUS.`;
      feedback.style.display = 'block';
      flagInput.disabled = true;
      document.getElementById('submitFlagBtn').disabled = true;

      this.renderAll();
    } else {
      window.tacticalAudio.playError();
      feedback.className = 'flag-feedback-msg error';
      feedback.textContent = result.message || 'ACCESS DENIED: Flag hash mismatch or invalid cryptographic response.';
      feedback.style.display = 'block';
    }

    window.stateManager.saveState();
  }

  triggerFirstBloodBanner(text) {
    const banner = document.getElementById('firstBloodBanner');
    if (!banner) return;
    banner.querySelector('.blood-text').textContent = text;
    banner.classList.add('active');

    setTimeout(() => {
      banner.classList.remove('active');
    }, 6000);
  }

  // ----------------------------------------------------
  // PARTICIPANT COMMAND CENTER RENDERING
  // ----------------------------------------------------
  renderCommandCenter() {
    const myTeam = this.state.teams.find(t => t.id === this.state.currentUser.teamId) || this.state.myTeam;
    
    document.getElementById('hudRankVal').textContent = `#${String(myTeam.rank).padStart(2, '0')}`;
    document.getElementById('hudScoreVal').textContent = `${myTeam.score.toLocaleString()} XP`;

    // Solves calculation
    const solvedCount = this.state.currentUser.solvedChallenges.length;
    const totalMissions = this.state.challenges.length;
    const pct = Math.round((solvedCount / totalMissions) * 100);

    document.getElementById('hudProgressPct').textContent = `${pct}%`;
    document.getElementById('hudProgressFraction').textContent = `${solvedCount} / ${totalMissions} MISSIONS`;
    document.getElementById('hudProgressBarFill').style.width = `${pct}%`;

    // Category breakdown
    const categories = ['WEB', 'CRYPTO', 'FORENSICS', 'PWN', 'REVERSING', 'OSINT'];
    const catList = document.getElementById('hudCategoryOpsList');
    catList.innerHTML = '';

    categories.forEach(cat => {
      const catChs = this.state.challenges.filter(c => c.category === cat);
      const catSolved = catChs.filter(c => this.isChallengeSolved(c.id));
      const catPct = catChs.length ? Math.round((catSolved.length / catChs.length) * 100) : 0;

      const item = document.createElement('div');
      item.className = 'cat-op-item';
      item.innerHTML = `
        <div class="cat-op-info">
          <span class="badge-tactical badge-${cat.toLowerCase()}">${cat}</span>
          <span style="font-family:var(--font-heading); font-size:12px; font-weight:700; color:#fff;">${cat}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:70px; height:6px; background:var(--x-surface); border-radius:2px; overflow:hidden;">
            <div style="width:${catPct}%; height:100%; background:var(--x-primary);"></div>
          </div>
          <span class="cat-op-fraction">${String(catSolved.length).padStart(2, '0')}/${String(catChs.length).padStart(2, '0')}</span>
        </div>
      `;
      catList.appendChild(item);
    });

    // Dispatch Feed
    const dispatchList = document.getElementById('hudDispatchFeed');
    dispatchList.innerHTML = '';
    this.state.activityFeed.slice(0, 15).forEach(act => {
      const item = document.createElement('div');
      item.className = `dispatch-item ${act.type}`;
      item.innerHTML = `
        <div class="dispatch-meta">
          <span>${act.type.toUpperCase()}</span>
          <span>${act.time}</span>
        </div>
        <div class="dispatch-content">${act.text}</div>
      `;
      dispatchList.appendChild(item);
    });
  }

  // ----------------------------------------------------
  // SCOREBOARD RENDERING & CANVAS TIMELINE
  // ----------------------------------------------------
  renderScoreboard() {
    const teams = [...this.state.teams].sort((a, b) => b.score - a.score);

    // Render Podium (Top 3)
    if (teams[0]) {
      document.getElementById('podiumRank1Team').textContent = teams[0].name;
      document.getElementById('podiumRank1Score').textContent = `${teams[0].score.toLocaleString()} XP`;
      document.getElementById('podiumRank1Bloods').textContent = `⚡ ${teams[0].firstBloods || 0} First Bloods`;
    }
    if (teams[1]) {
      document.getElementById('podiumRank2Team').textContent = teams[1].name;
      document.getElementById('podiumRank2Score').textContent = `${teams[1].score.toLocaleString()} XP`;
      document.getElementById('podiumRank2Bloods').textContent = `⚡ ${teams[1].firstBloods || 0} First Bloods`;
    }
    if (teams[2]) {
      document.getElementById('podiumRank3Team').textContent = teams[2].name;
      document.getElementById('podiumRank3Score').textContent = `${teams[2].score.toLocaleString()} XP`;
      document.getElementById('podiumRank3Bloods').textContent = `⚡ ${teams[2].firstBloods || 0} First Bloods`;
    }

    // Scoreboard Table
    const tableBody = document.getElementById('scoreboardTableBody');
    tableBody.innerHTML = '';

    teams.forEach((t, idx) => {
      const isMyTeam = t.id === this.state.currentUser.teamId;
      const row = document.createElement('tr');
      if (isMyTeam) row.className = 'my-team-row';

      row.innerHTML = `
        <td style="font-weight:700; color:${idx < 3 ? 'var(--x-primary)' : 'var(--x-text-muted)'};">
          #${String(idx + 1).padStart(2, '0')}
        </td>
        <td>
          <span style="color:${isMyTeam ? 'var(--x-primary)' : '#fff'}; font-weight:700; font-family:var(--font-heading);">
            ${t.name} ${isMyTeam ? '<span class="badge-tactical badge-diff-easy" style="font-size:9px;">YOU</span>' : ''}
          </span>
        </td>
        <td style="font-weight:700; color:var(--x-primary); font-size:14px;">
          ${t.score.toLocaleString()}
        </td>
        <td>${t.solvesCount}</td>
        <td><span style="color:var(--x-danger); font-weight:700;">${t.firstBloods || 0}</span></td>
        <td style="color:var(--x-text-muted); font-size:11px;">${t.members.join(', ')}</td>
      `;
      tableBody.appendChild(row);
    });

    this.renderScoreboardCanvas();
  }

  renderScoreboardCanvas() {
    const canvas = document.getElementById('scoreboardChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = 280);

    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = 'rgba(33, 44, 61, 0.4)';
    ctx.lineWidth = 1;
    for (let y = 30; y < height - 20; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }

    // Draw progression lines for top 5 teams
    const topTeams = this.state.teams.slice(0, 5);
    const colors = ['#00f5a0', '#00d8f6', '#ffb703', '#ff0055', '#9d4edd'];

    topTeams.forEach((team, tIdx) => {
      const color = colors[tIdx % colors.length];
      const teamSolves = this.state.solves.filter(s => s.teamId === team.id);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(40, height - 30);

      const steps = Math.max(teamSolves.length + 1, 6);
      const xStep = (width - 70) / steps;
      let runningScore = 0;

      for (let i = 1; i <= steps; i++) {
        const x = 40 + i * xStep;
        if (i <= teamSolves.length) {
          runningScore += 400 + (i % 3) * 50;
        }
        const maxExpectedScore = 9000;
        const y = height - 30 - (runningScore / maxExpectedScore) * (height - 60);

        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Legend in top-left
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillStyle = color;
      ctx.fillText(`● ${team.name} (${team.score})`, 45 + tIdx * 120, 20);
    });
  }

  // ----------------------------------------------------
  // TEAM & OPERATIVE PROFILE RENDERING
  // ----------------------------------------------------
  renderTeamAndProfile() {
    const myTeam = this.state.teams.find(t => t.id === this.state.currentUser.teamId) || this.state.myTeam;
    
    // Team page
    document.getElementById('teamNameDisplay').textContent = myTeam.name;
    document.getElementById('teamRankDisplay').textContent = `#${String(myTeam.rank).padStart(2, '0')}`;
    document.getElementById('teamScoreDisplay').textContent = `${myTeam.score.toLocaleString()} XP`;
    document.getElementById('teamAccessKeyDisplay').textContent = this.state.myTeam.accessCode;

    const rosterList = document.getElementById('teamRosterList');
    rosterList.innerHTML = '';
    myTeam.members.forEach(member => {
      const isCaptain = member === this.state.myTeam.captain;
      const card = document.createElement('div');
      card.className = 'cat-op-item';
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="hud-user-avatar" style="width:30px; height:30px;">${member[0]}</div>
          <div>
            <div style="font-weight:700; color:#fff;">${member}</div>
            <div style="font-size:10px; color:var(--x-primary); font-family:var(--font-mono);">
              ${isCaptain ? 'TEAM CAPTAIN' : 'OPERATIVE'}
            </div>
          </div>
        </div>
        <span class="badge-tactical badge-diff-easy">ONLINE</span>
      `;
      rosterList.appendChild(card);
    });

    // Profile Page
    document.getElementById('profileUsername').textContent = this.state.currentUser.username;
    document.getElementById('profileCallsign').textContent = `CALLSIGN: ${this.state.currentUser.callsign}`;
    document.getElementById('profileTotalXp').textContent = `${myTeam.score.toLocaleString()} XP`;
    document.getElementById('profileSolvedCount').textContent = `${this.state.currentUser.solvedChallenges.length}`;
    document.getElementById('profileFirstBloods').textContent = `${myTeam.firstBloods || 0}`;
    document.getElementById('profileAccuracy').textContent = `${this.state.currentUser.accuracy}%`;

    // Profile Badges
    const badges = [
      { id: 'fb', icon: '⚡', title: 'FIRST BLOOD', desc: 'First to solve a classified battlefield mission.', unlocked: (myTeam.firstBloods || 0) > 0 },
      { id: 'ck', icon: '☠', title: 'CRYPTO KILLER', desc: 'Cracked advanced stream and matrix ciphers.', unlocked: this.state.currentUser.solvedChallenges.some(id => id.includes('crp')) },
      { id: 'wb', icon: '🔓', title: 'WEB BREAKER', desc: 'Breached auth logic and prototype pollution vectors.', unlocked: this.state.currentUser.solvedChallenges.some(id => id.includes('web')) },
      { id: 'fm', icon: '🧠', title: 'FORENSIC MIND', desc: 'Recovered injected memory payloads and logs.', unlocked: false },
      { id: 'oh', icon: '👁', title: 'OSINT HUNTER', desc: 'Located high-value geographic surveillance coordinates.', unlocked: false },
      { id: 'no', icon: '🔥', title: 'NIGHT OPERATIVE', desc: 'Successfully executed captures during 02:00-06:00 UTC.', unlocked: true }
    ];

    const badgesGrid = document.getElementById('profileBadgesGrid');
    badgesGrid.innerHTML = '';
    badges.forEach(b => {
      const card = document.createElement('div');
      card.className = `badge-achievement-card ${b.unlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="badge-icon-box">${b.icon}</div>
        <div>
          <div style="font-family:var(--font-heading); font-weight:700; font-size:12px; color:${b.unlocked ? 'var(--x-primary)' : 'var(--x-text-muted)'};">
            ${b.title}
          </div>
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--x-text-muted); margin-top:2px;">
            ${b.desc}
          </div>
        </div>
      `;
      badgesGrid.appendChild(card);
    });
  }

  // ----------------------------------------------------
  // ADMIN CONTROL ROOM (C2)
  // ----------------------------------------------------
  bindAdminControls() {
    // Admin Tabs
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.tacticalAudio.playClick();
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
        btn.classList.add('active');

        const tabKey = btn.getAttribute('data-tab');
        const content = document.getElementById(`admin-tab-${tabKey}`);
        if (content) content.style.display = 'block';
      });
    });

    // Scoreboard Freeze toggle
    const freezeBtn = document.getElementById('adminFreezeScoreboardBtn');
    if (freezeBtn) {
      freezeBtn.addEventListener('click', () => {
        this.state.competition.scoreboardFrozen = !this.state.competition.scoreboardFrozen;
        freezeBtn.textContent = this.state.competition.scoreboardFrozen ? '❄ UNFREEZE SCOREBOARD' : '❄ FREEZE SCOREBOARD';
        freezeBtn.className = this.state.competition.scoreboardFrozen ? 'btn-tactical btn-danger' : 'btn-tactical btn-ghost';
        this.showToast(this.state.competition.scoreboardFrozen ? 'SCOREBOARD FROZEN FOR PLAYERS' : 'SCOREBOARD RESUMED', 'warning');
        window.stateManager.saveState();
        window.tacticalAudio.playClick();
      });
    }

    // CTF Pause toggle
    const pauseBtn = document.getElementById('adminPauseCtfBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const isPaused = this.state.competition.status === 'PAUSED';
        this.state.competition.status = isPaused ? 'LIVE' : 'PAUSED';
        pauseBtn.textContent = isPaused ? '⏸ PAUSE CTF' : '▶ RESUME CTF';
        pauseBtn.className = isPaused ? 'btn-tactical btn-ghost' : 'btn-tactical btn-danger';
        this.showToast(`BATTLEFIELD STATUS: ${this.state.competition.status}`, 'warning');
        window.stateManager.saveState();
        window.tacticalAudio.playClick();
      });
    }

    // New Challenge modal triggers
    const newChBtn = document.getElementById('adminNewChallengeBtn');
    if (newChBtn) {
      newChBtn.addEventListener('click', () => this.openAdminChallengeModal());
    }

    const closeAdminChBtn = document.getElementById('closeAdminChModalBtn');
    if (closeAdminChBtn) {
      closeAdminChBtn.addEventListener('click', () => this.closeAdminChallengeModal());
    }

    // Test Flag in sandbox
    const testFlagBtn = document.getElementById('adminTestFlagBtn');
    if (testFlagBtn) {
      testFlagBtn.addEventListener('click', () => {
        const flagVal = document.getElementById('adminChFlagInput').value.trim();
        const testRes = document.getElementById('adminTestFlagResult');
        if (!flagVal.startsWith('XploitX{') || !flagVal.endsWith('}')) {
          testRes.style.color = 'var(--x-danger)';
          testRes.textContent = '❌ FAILED: Flag must match XploitX{...} syntax';
          window.tacticalAudio.playError();
        } else {
          testRes.style.color = 'var(--x-primary)';
          testRes.textContent = '✓ VALIDATED: Cryptographic flag verified in sandbox.';
          window.tacticalAudio.playClick();
        }
      });
    }

    // Publish Challenge
    const publishBtn = document.getElementById('adminPublishChallengeBtn');
    if (publishBtn) {
      publishBtn.addEventListener('click', () => this.handleAdminPublishChallenge());
    }

    // Broadcast announcement
    const broadcastBtn = document.getElementById('adminDispatchBroadcastBtn');
    if (broadcastBtn) {
      broadcastBtn.addEventListener('click', () => {
        const text = document.getElementById('adminBroadcastInput').value.trim();
        if (!text) return;

        const time = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' UTC';
        this.state.announcements.unshift({
          id: `ann-${Date.now()}`,
          title: 'SYSTEM BROADCAST // COMMAND',
          content: text,
          urgent: true,
          time: time
        });

        this.state.activityFeed.unshift({
          id: `act-${Date.now()}`,
          type: 'announcement',
          text: `⚠ BROADCAST: ${text}`,
          time: time
        });

        document.getElementById('adminBroadcastInput').value = '';
        this.recalculateAll();
        this.renderAll();
        this.showToast('TACTICAL BROADCAST DISPATCHED TO ALL OPERATIVES', 'success');
        window.tacticalAudio.playSuccess();
      });
    }
  }

  openAdminChallengeModal() {
    document.getElementById('adminChallengeModal').classList.add('active');
    document.getElementById('adminTestFlagResult').textContent = '';
  }

  closeAdminChallengeModal() {
    document.getElementById('adminChallengeModal').classList.remove('active');
  }

  handleAdminPublishChallenge() {
    const title = document.getElementById('adminChTitleInput').value.trim();
    const missionId = document.getElementById('adminChMissionIdInput').value.trim();
    const cat = document.getElementById('adminChCategorySelect').value;
    const diff = document.getElementById('adminChDiffSelect').value;
    const points = parseInt(document.getElementById('adminChPointsInput').value) || 500;
    const flagVal = document.getElementById('adminChFlagInput').value.trim();
    const briefing = document.getElementById('adminChBriefingInput').value.trim();

    if (!title || !missionId || !flagVal || !briefing) {
      alert('PRE-FLIGHT VALIDATION FAILED:\nAll fields (Title, Mission ID, Flag, and Briefing) are mandatory.');
      window.tacticalAudio.playError();
      return;
    }

    const newChallenge = {
      id: `ch-${missionId.toLowerCase()}`,
      missionId: missionId,
      slug: title.toLowerCase().replace(/\s+/g, '-'),
      title: title,
      category: cat,
      difficulty: diff,
      author: 'ADMIN_C2',
      basePoints: points,
      minimumPoints: Math.round(points * 0.3),
      decayThreshold: 30,
      currentPoints: points,
      solveCount: 0,
      status: 'LIVE',
      flagType: 'STATIC',
      flagValue: flagVal,
      flagPrefix: 'XploitX{',
      flagSuffix: '}',
      caseSensitive: true,
      maxAttempts: 20,
      tags: [cat.toLowerCase(), 'classified'],
      briefing: briefing,
      evidenceFiles: [],
      hasInstance: false,
      hints: []
    };

    this.state.challenges.unshift(newChallenge);
    this.recalculateAll();
    this.renderAll();
    this.closeAdminChallengeModal();

    this.showToast(`CLASSIFIED MISSION ${missionId} DEPLOYED TO BATTLEFIELD MATRIX`, 'success');
    window.tacticalAudio.playSuccess();
  }

  renderAdminPanel() {
    // Challenge management table
    const tableBody = document.getElementById('adminChallengesTableBody');
    tableBody.innerHTML = '';

    this.state.challenges.forEach(ch => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight:700; color:#fff;">${ch.missionId}</td>
        <td>${ch.title}</td>
        <td><span class="badge-tactical badge-${ch.category.toLowerCase()}">${ch.category}</span></td>
        <td>${ch.currentPoints}</td>
        <td>${ch.solveCount}</td>
        <td><span class="badge-tactical badge-diff-easy">${ch.status}</span></td>
        <td>
          <button class="btn-tactical btn-ghost btn-sm" onclick="window.app.openMissionDossier('${ch.id}')">
            PREVIEW
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Submissions Audit Log
    const subBody = document.getElementById('adminSubmissionsTableBody');
    subBody.innerHTML = '';
    this.state.submissionsLog.slice(0, 20).forEach(sub => {
      const isCorrect = sub.status === 'CORRECT';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="color:var(--x-text-muted);">${sub.time}</td>
        <td style="font-weight:700; color:#fff;">${sub.teamName}</td>
        <td>${sub.challengeMissionId}</td>
        <td style="font-family:var(--font-mono); color:var(--x-text-muted);">${sub.submittedFlag}</td>
        <td>
          <span class="badge-tactical ${isCorrect ? 'badge-diff-easy' : 'badge-diff-insane'}">
            ${sub.status}
          </span>
        </td>
        <td style="color:var(--x-text-muted);">${sub.ip}</td>
      `;
      subBody.appendChild(row);
    });
  }

  // ----------------------------------------------------
  // CLOCK & SIMULATED LIVE BATTLEFIELD DISPATCH
  // ----------------------------------------------------
  startCountdownClock() {
    const clockEl = document.getElementById('hudCountdownClock');
    const update = () => {
      const diff = Math.max(0, this.state.competition.endTime - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (clockEl) {
        clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    };
    update();
    setInterval(update, 1000);
  }

  startSimulatedBattlefieldFeed() {
    // Generate realistic battlefield action every 35-50 seconds
    const simulatedTeams = ['ROOT_ACCESS', 'NULLBYTE', 'CYBER_VIPERS', 'BUFFER_OVERFLOW', 'ZERO_DAY_SOCIETY'];
    const interval = 40000;

    setInterval(() => {
      if (this.state.competition.status === 'PAUSED') return;

      const randomTeam = simulatedTeams[Math.floor(Math.random() * simulatedTeams.length)];
      const unsolved = this.state.challenges.filter(c => c.status === 'LIVE');
      if (!unsolved.length) return;

      const randomCh = unsolved[Math.floor(Math.random() * unsolved.length)];
      const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

      // Add to feed
      this.state.activityFeed.unshift({
        id: `act-sim-${Date.now()}`,
        type: 'solve',
        text: `✓ SOLVE: Team ${randomTeam} captured ${randomCh.title} (${randomCh.missionId}) [+${randomCh.currentPoints} XP]`,
        time: nowTime
      });

      this.recalculateAll();
      this.renderCommandCenter();
      this.renderScoreboard();
    }, interval);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `first-blood-banner active`;
    toast.style.top = 'auto';
    toast.style.bottom = '24px';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.borderColor = type === 'success' ? 'var(--x-primary)' : type === 'warning' ? 'var(--x-warning)' : 'var(--x-cyan)';
    toast.style.background = 'rgba(14, 19, 27, 0.95)';
    toast.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.8)';
    toast.innerHTML = `<span style="font-size:16px;">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ'}</span> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('active');
      setTimeout(() => document.body.removeChild(toast), 400);
    }, 4000);
  }

  bindGlobalEvents() {
    // Re-render when viewport changes size (for chart)
    window.addEventListener('resize', () => {
      if (this.currentView === 'view-scoreboard') {
        this.renderScoreboardCanvas();
      }
    });
  }

  renderAll() {
    this.renderCommandCenter();
    this.renderMissionsGrid();
    this.renderScoreboard();
    this.renderTeamAndProfile();
    this.renderAdminPanel();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
