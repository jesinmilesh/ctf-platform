/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Operations Browser (assets/js/public/challenges.js)
 * Implements Section 10 of Architectural Blueprint
 */

let allChallenges = [];

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const grid = document.getElementById('challengeGrid');
  const searchInput = document.getElementById('challengeSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const difficultyFilter = document.getElementById('difficultyFilter');

  function renderGrid() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const cat = categoryFilter.value;
    const diff = difficultyFilter.value;

    const filtered = allChallenges.filter(c => {
      const matchQuery = !query ||
        c.title.toLowerCase().includes(query) ||
        (c.mission_id && c.mission_id.toLowerCase().includes(query)) ||
        (c.category && c.category.toLowerCase().includes(query));

      const matchCat = !cat || (c.category && c.category.toUpperCase() === cat.toUpperCase());
      const matchDiff = !diff || (c.difficulty && c.difficulty.toUpperCase() === diff.toUpperCase());

      return matchQuery && matchCat && matchDiff;
    });

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

  try {
    const res = await window.api.getChallenges();
    allChallenges = res.challenges || [];

    // Populate category dropdown
    const categories = Array.from(new Set(allChallenges.map(c => c.category).filter(Boolean)));
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });

    renderGrid();

    searchInput.addEventListener('input', renderGrid);
    categoryFilter.addEventListener('change', renderGrid);
    difficultyFilter.addEventListener('change', renderGrid);

  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; color:var(--danger); text-align:center; font-family:var(--font-mono); padding:40px;">
        FAILED TO COMMUNICATE WITH MISSION DATABASE: ${err.message}
      </div>
    `;
  }
});
