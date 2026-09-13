/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Operations Browser (assets/js/public/challenges.js)
 * Implements Section 8 & 10 of Master Production Specification
 */

let allChallenges = [];
let activeTrackCategory = '';

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const grid = document.getElementById('challengeGrid');
  const searchInput = document.getElementById('challengeSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const difficultyFilter = document.getElementById('difficultyFilter');

  function renderGrid() {
    if (!grid) return;
    const query = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
    const cat = categoryFilter && categoryFilter.value ? categoryFilter.value : activeTrackCategory;
    const diff = difficultyFilter && difficultyFilter.value ? difficultyFilter.value : '';

    const filtered = allChallenges.filter(c => {
      const matchQuery = !query ||
        (c.title && c.title.toLowerCase().includes(query)) ||
        (c.mission_id && c.mission_id.toLowerCase().includes(query)) ||
        (c.category && c.category.toLowerCase().includes(query));

      const matchCat = !cat || (c.category && c.category.toUpperCase().includes(cat.toUpperCase()));
      const matchDiff = !diff || (c.difficulty && c.difficulty.toUpperCase() === diff.toUpperCase());

      return matchQuery && matchCat && matchDiff;
    });

    if (allChallenges.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align:center; padding:60px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm);">
          <div style="font-size:32px; margin-bottom:12px;">🎯</div>
          <h3 style="font-family:var(--font-heading); font-size:18px; color:#fff; margin-bottom:8px;">NO ACTIVE MISSIONS</h3>
          <p style="color:var(--text-secondary); font-size:13px; font-family:var(--font-mono); margin:0;">
            No challenges have been published yet.
          </p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:50px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-secondary); font-family:var(--font-mono);">
          NO TARGET OPERATIONS MATCH THE SPECIFIED CRITERIA.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(c => ChallengeCard.render(c)).join('');
  }

  // Hook global track selector from HTML
  window.selectTrackCategory = (catName) => {
    activeTrackCategory = catName || '';
    if (categoryFilter) {
      categoryFilter.value = '';
    }
    renderGrid();
  };

  try {
    const res = await window.api.getChallenges();
    allChallenges = res.challenges || [];

    // Populate category dropdown
    if (categoryFilter) {
      const categories = Array.from(new Set(allChallenges.map(c => c.category).filter(Boolean)));
      categoryFilter.innerHTML = '<option value="">All Categories</option>';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categoryFilter.appendChild(opt);
      });
    }

    renderGrid();

    if (searchInput) searchInput.addEventListener('input', renderGrid);
    if (categoryFilter) categoryFilter.addEventListener('change', () => {
      activeTrackCategory = '';
      renderGrid();
    });
    if (difficultyFilter) difficultyFilter.addEventListener('change', renderGrid);

    // Real-Time Event Listener
    if (window.tacticalSocket) {
      window.tacticalSocket.on('CHALLENGE_SOLVED', async () => {
        try {
          const fresh = await window.api.getChallenges();
          allChallenges = fresh.challenges || [];
          renderGrid();
        } catch (e) {}
      });
      window.tacticalSocket.on('CHALLENGE_CREATED', async () => {
        try {
          const fresh = await window.api.getChallenges();
          allChallenges = fresh.challenges || [];
          renderGrid();
        } catch (e) {}
      });
    }

  } catch (err) {
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; color:var(--danger); text-align:center; font-family:var(--font-mono); padding:40px;">
          FAILED TO COMMUNICATE WITH MISSION DATABASE: ${err.message}
        </div>
      `;
    }
  }
});
