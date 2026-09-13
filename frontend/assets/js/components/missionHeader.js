/**
 * XPLOITX // CYBER BATTLEFIELD
 * Standardized Mission Telemetry Header Component (assets/js/components/missionHeader.js)
 * Implements Section 5 of Master Production Specification:
 * - Dynamic difficulty badges
 * - Category accent coloring
 * - Dynamic decayed points & solve count
 * - First blood operative callsign indicator
 */

const MissionHeader = {
  render(challenge) {
    if (!challenge) return '';

    const diffBadge = window.Utils ? window.Utils.getDifficultyBadge(challenge.difficulty) : challenge.difficulty;
    const pointsFormatted = window.Utils ? window.Utils.formatXP(challenge.points || challenge.current_points || challenge.base_points) : `${challenge.points} XP`;
    const categoryName = challenge.category || challenge.category_name || 'MISC';
    const missionCode = challenge.mission_id || 'OP-INIT';
    const solvesCount = challenge.solve_count || 0;
    const firstBlood = challenge.first_blood ? challenge.first_blood.team_name || challenge.first_blood.user_callsign : null;

    return `
      <div class="mission-header-panel" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:24px 28px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="mission-code-badge" style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); background:var(--bg-secondary); padding:4px 8px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              ${missionCode}
            </span>
            <span class="category-tag" style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--accent);">
              [ ${categoryName} ]
            </span>
            ${diffBadge}
          </div>

          <div style="display:flex; align-items:center; gap:16px; font-family:var(--font-mono);">
            <div style="text-align:right;">
              <span style="font-size:11px; color:var(--text-secondary); display:block;">REWARD</span>
              <span style="font-size:18px; font-weight:800; color:var(--accent);">${pointsFormatted}</span>
            </div>
            <div style="width:1px; height:28px; background:var(--border);"></div>
            <div style="text-align:right;">
              <span style="font-size:11px; color:var(--text-secondary); display:block;">CONFIRMED SOLVES</span>
              <span style="font-size:15px; font-weight:700; color:#fff;">${solvesCount}</span>
            </div>
          </div>
        </div>

        <h1 style="font-family:var(--font-heading); font-size:28px; font-weight:800; color:#fff; margin:0 0 12px 0; letter-spacing:0.02em;">
          ${window.Utils ? window.Utils.escapeHTML(challenge.title) : challenge.title}
        </h1>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; font-family:var(--font-mono); font-size:12px; border-top:1px solid var(--border); padding-top:12px; margin-top:12px;">
          <div style="color:var(--text-muted);">
            DECAY THRESHOLD: ${challenge.decay_threshold || 30} SOLVES // FLOOR: ${challenge.minimum_points || 100} XP
          </div>
          ${firstBlood ? `
            <div style="color:var(--danger); display:flex; align-items:center; gap:6px;">
              <span>🩸 FIRST BLOOD:</span>
              <strong style="color:#fff;">${window.Utils ? window.Utils.escapeHTML(firstBlood) : firstBlood}</strong>
            </div>
          ` : `
            <div style="color:var(--accent); font-size:11px;">
              ⚡ FIRST BLOOD UNCLAIMED — FULL XP AVAILABLE
            </div>
          `}
        </div>
      </div>
    `;
  }
};

window.MissionHeader = MissionHeader;
