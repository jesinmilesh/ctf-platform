/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Operations Browser (assets/js/public/challenges.js)
 * Real-Time Track Management for the 8 Core Cybersecurity Categories
 */

const TRACK_SECTORS = [
  {
    id: 'all',
    num: 0,
    name: 'All Tracks',
    category: '',
    icon: 'ALL',
    color: '#00ff9c',
    description: 'Viewing all mission directives and operational targets across active sectors.'
  },
  {
    id: 'pwn',
    num: 1,
    name: 'PWN',
    category: 'PWN',
    icon: 'PWN',
    color: '#ff3b5c',
    description: 'Binary exploitation, ROP chains, memory corruption, and heap exploitation.'
  },
  {
    id: 'misc',
    num: 2,
    name: 'Misc',
    category: 'Misc',
    icon: 'MISC',
    color: '#a3a3a3',
    description: 'Miscellaneous tactical missions, multi-disciplinary puzzles, and esoteric systems.'
  },
  {
    id: 'web',
    num: 3,
    name: 'Web',
    category: 'Web',
    icon: 'WEB',
    color: '#00d8f6',
    description: 'Web application exploitation, API security, parameter tampering, and injection vectors.'
  },
  {
    id: 'network',
    num: 4,
    name: 'Network',
    category: 'Network',
    icon: 'NET',
    color: '#f9c74f',
    description: 'Packet inspection, network protocol analysis, routing flaws, and PCAP data extraction.'
  },
  {
    id: 'forensic',
    num: 5,
    name: 'Digital Forensic',
    category: 'Digital Forensic',
    icon: 'DFIR',
    color: '#00ff9c',
    description: 'Memory dump forensics, disk image analysis, filesystem carving, and artifact recovery.'
  },
  {
    id: 'osint',
    num: 6,
    name: 'OSINT',
    category: 'OSINT',
    icon: 'OSINT',
    color: '#4cc9f0',
    description: 'Open source intelligence, asset tracing, geolocation, and persona reconnaissance.'
  },
  {
    id: 'crypto',
    num: 7,
    name: 'Cryptography',
    category: 'Cryptography',
    icon: 'CRYP',
    color: '#c77dff',
    description: 'Classical ciphers, discrete logarithms, RSA, ECC, and cryptanalytic breaks.'
  },
  {
    id: 'stegano',
    num: 8,
    name: 'Steganograhy',
    category: 'Steganograhy',
    icon: 'STEG',
    color: '#ffb020',
    description: 'Covert communication channels, image/audio data hiding, and embedded payload recovery.'
  }
];

let allChallenges = [];
let activeTrackId = 'all';
let activeTrackCategory = '';

function normalizeStr(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesCategory(challenge, targetCategory) {
  if (!targetCategory) return true;
  const targetNorm = normalizeStr(targetCategory);
  const catNorm = normalizeStr(challenge.category || challenge.category_name);
  const slugNorm = normalizeStr(challenge.category_slug);

  if (catNorm === targetNorm || slugNorm === targetNorm) return true;
  if (catNorm.includes(targetNorm) || targetNorm.includes(catNorm)) return true;

  // Keyword fuzzy matching for the 8 sectors
  if (targetNorm.includes('forensic') && (catNorm.includes('forensic') || catNorm === 'df' || catNorm === 'dfir')) return true;
  if (targetNorm.includes('steg') && catNorm.includes('steg')) return true;
  if (targetNorm.includes('crypt') && (catNorm.includes('crypt') || catNorm === 'cipher')) return true;
  if (targetNorm.includes('net') && catNorm.includes('net')) return true;
  if (targetNorm.includes('pwn') && (catNorm.includes('pwn') || catNorm.includes('bin'))) return true;
  if (targetNorm.includes('web') && catNorm.includes('web')) return true;
  if (targetNorm.includes('osint') && (catNorm.includes('osint') || catNorm.includes('intel'))) return true;
  if (targetNorm.includes('misc') && catNorm.includes('misc')) return true;

  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  Navbar.render('navbar-container', 'challenges');

  const timelineContainer = document.getElementById('eventTrackTimeline');
  const grid = document.getElementById('challengeGrid');
  const searchInput = document.getElementById('challengeSearch');
  const categoryFilter = document.getElementById('categoryFilter');
  const difficultyFilter = document.getElementById('difficultyFilter');
  const trackTitle = document.getElementById('trackTitle');
  const trackDescription = document.getElementById('trackDescription');
  const trackSolvedStat = document.getElementById('trackSolvedStat');
  const trackPointsStat = document.getElementById('trackPointsStat');
  const resetTrackBtn = document.getElementById('resetTrackBtn');

  function updateBannerStats() {
    const currentTrack = TRACK_SECTORS.find(t => t.id === activeTrackId) || TRACK_SECTORS[0];
    const trackChallenges = currentTrack.category
      ? allChallenges.filter(c => matchesCategory(c, currentTrack.category))
      : allChallenges;
    
    const solvedCount = trackChallenges.filter(c => c.is_solved).length;
    const totalPoints = trackChallenges.reduce((sum, c) => sum + (c.points || 0), 0);

    if (trackTitle) {
      trackTitle.textContent = currentTrack.num === 0
        ? 'All Operations'
        : `Track ${currentTrack.num} (${currentTrack.name})`;
    }

    if (trackDescription) {
      trackDescription.textContent = currentTrack.description;
    }

    if (trackSolvedStat) {
      trackSolvedStat.textContent = `${solvedCount} / ${trackChallenges.length}`;
    }

    if (trackPointsStat) {
      trackPointsStat.textContent = `${totalPoints} XP`;
    }

    if (resetTrackBtn) {
      resetTrackBtn.style.display = activeTrackId === 'all' ? 'none' : 'inline-block';
    }
  }

  function renderTimeline() {
    if (!timelineContainer) return;

    let html = '<div class="event-track-line"></div>';

    TRACK_SECTORS.forEach(track => {
      const trackChallenges = track.category
        ? allChallenges.filter(c => matchesCategory(c, track.category))
        : allChallenges;
      
      const solvedCount = trackChallenges.filter(c => c.is_solved).length;
      const isCompleted = trackChallenges.length > 0 && solvedCount === trackChallenges.length;
      const isActive = activeTrackId === track.id;

      const activeBorderGlow = isActive
        ? `box-shadow: 0 0 0 2px ${track.color}, 0 0 20px ${track.color}66; border-color: transparent;`
        : '';

      html += `
        <div class="track-node-wrapper" onclick="window.selectTrack('${track.id}')" title="${track.name}">
          <div class="track-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" 
               id="track-node-${track.id}"
               style="${activeBorderGlow}">
            <div class="track-node-inner">
              <span class="track-node-icon" style="color: ${isActive ? track.color : (isCompleted ? 'var(--accent)' : 'var(--text-secondary)')};">
                ${track.icon}
              </span>
            </div>
            ${isCompleted ? '<div class="track-badge-completed">✓</div>' : ''}
            ${isActive ? `<div class="track-badge-active" style="background:${track.color};"></div>` : ''}
          </div>
          <div class="track-label">
            <p class="track-title" style="color: ${isActive ? '#fff' : 'var(--text-secondary)'}; font-weight: ${isActive ? '700' : '600'};">
              ${track.num === 0 ? 'All Tracks' : `Track ${track.num} (${track.name})`}
            </p>
            <p class="track-status" style="color: ${isCompleted ? 'var(--accent)' : (isActive ? track.color : 'var(--text-secondary)')};">
              ${isCompleted ? 'COMPLETED' : `${trackChallenges.length} OPS`}
            </p>
          </div>
        </div>
      `;
    });

    timelineContainer.innerHTML = html;
  }

  function renderGrid() {
    if (!grid) return;
    const query = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
    const dropdownCat = categoryFilter && categoryFilter.value ? categoryFilter.value : '';
    const activeCat = dropdownCat || activeTrackCategory;
    const diff = difficultyFilter && difficultyFilter.value ? difficultyFilter.value : '';

    const filtered = allChallenges.filter(c => {
      const matchQuery = !query ||
        (c.title && c.title.toLowerCase().includes(query)) ||
        (c.mission_id && c.mission_id.toLowerCase().includes(query)) ||
        (c.category && c.category.toLowerCase().includes(query));

      const matchCat = matchesCategory(c, activeCat);
      const matchDiff = !diff || (c.difficulty && c.difficulty.toUpperCase() === diff.toUpperCase());

      return matchQuery && matchCat && matchDiff;
    });

    if (allChallenges.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align:center; padding:60px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm);">
          <div style="font-size:32px; margin-bottom:12px;">🎯</div>
          <h3 style="font-family:var(--font-heading); font-size:18px; color:#fff; margin-bottom:8px;">NO ACTIVE MISSIONS</h3>
          <p style="color:var(--text-secondary); font-size:13px; font-family:var(--font-mono); margin:0;">
            No challenges have been published yet in this operation theater.
          </p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:50px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-secondary); font-family:var(--font-mono);">
          NO TARGET OPERATIONS MATCH THE CURRENT SECTOR FILTER.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(c => ChallengeCard.render(c)).join('');
  }

  // Global Track Selection function
  window.selectTrack = (trackId) => {
    const track = TRACK_SECTORS.find(t => t.id === trackId) || TRACK_SECTORS[0];
    activeTrackId = track.id;
    activeTrackCategory = track.category;

    if (categoryFilter) {
      categoryFilter.value = track.category;
    }

    renderTimeline();
    updateBannerStats();
    renderGrid();
  };

  try {
    const res = await window.api.getChallenges();
    allChallenges = res.challenges || [];

    renderTimeline();
    updateBannerStats();
    renderGrid();

    // Event Listeners
    if (searchInput) {
      searchInput.addEventListener('input', renderGrid);
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        const val = categoryFilter.value;
        const matched = TRACK_SECTORS.find(t => t.category && normalizeStr(t.category) === normalizeStr(val));
        if (matched) {
          activeTrackId = matched.id;
          activeTrackCategory = matched.category;
        } else {
          activeTrackId = 'all';
          activeTrackCategory = '';
        }
        renderTimeline();
        updateBannerStats();
        renderGrid();
      });
    }

    if (difficultyFilter) {
      difficultyFilter.addEventListener('change', renderGrid);
    }

    // Real-Time WebSocket Synchronization
    if (window.tacticalSocket) {
      const handleDataRefresh = async () => {
        try {
          const fresh = await window.api.getChallenges();
          allChallenges = fresh.challenges || [];
          renderTimeline();
          updateBannerStats();
          renderGrid();
        } catch (e) {}
      };

      window.tacticalSocket.on('CHALLENGE_SOLVED', handleDataRefresh);
      window.tacticalSocket.on('CHALLENGE_CREATED', handleDataRefresh);
      window.tacticalSocket.on('CHALLENGE_UPDATED', handleDataRefresh);
      window.tacticalSocket.on('CHALLENGE_DELETED', handleDataRefresh);
    }

  } catch (err) {
    if (grid) {
      const is503 = err.status === 503 || (err.message && err.message.includes('temporarily unavailable'));
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm);">
          <div style="font-size:32px; margin-bottom:12px;">${is503 ? '🔌' : '⚠️'}</div>
          <h3 style="font-family:var(--font-heading); font-size:18px; color:${is503 ? 'var(--warning)' : 'var(--danger)'}; margin-bottom:8px;">
            ${is503 ? 'MISSION DATABASE TEMPORARILY UNAVAILABLE' : 'FAILED TO LOAD MISSION ROSTER'}
          </h3>
          <p style="color:var(--text-secondary); font-size:13px; font-family:var(--font-mono); margin:0 0 16px 0;">
            ${is503 ? 'The mission database is temporarily offline. Please try again in a few seconds.' : err.message}
          </p>
          <button onclick="location.reload()" class="btn btn-outline" style="padding:10px 20px; font-size:12px;">
            ↻ RETRY
          </button>
        </div>
      `;
    }
  }
});
