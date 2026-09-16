/**
 * XPLOITX // CYBER BATTLEFIELD
 * Challenge Card Component (assets/js/components/challengeCard.js)
 * Implements Sections 11 & 27 of Architectural Blueprint
 */

const ChallengeCard = {
  render(challenge) {
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    const formatXP = window.Utils ? window.Utils.formatXP : (s => `${s} XP`);

    const isSolved = challenge.is_solved;
    const categoryName = challenge.category || 'MISC';
    const categoryColor = challenge.category_color || '#00ff9c';
    const difficulty = challenge.difficulty || 'MEDIUM';

    let diffColor = 'var(--cyan)';
    if (difficulty === 'EASY') diffColor = 'var(--accent)';
    else if (difficulty === 'HARD') diffColor = 'var(--warning)';
    else if (difficulty === 'INSANE') diffColor = 'var(--danger)';

    const displayChallengeId = challenge.challengeId || challenge.id || challenge.mission_id || 'OP-CLASSIFIED';
    const isPreview = (challenge.id === 'preview' || challenge.slug === 'preview');
    const routeToken = challenge.publicRouteId || challenge.id || challenge.slug || 'preview';
    const linkHref = isPreview ? '/challenge.html?id=preview' : `/challenge/${encodeURIComponent(routeToken)}`;

    return `
      <article class="mission-card ${isSolved ? 'solved' : ''}" data-challenge-id="${esc(challenge.challengeId || challenge.id || routeToken)}" style="${isSolved ? 'border-color: rgba(0, 255, 156, 0.4);' : ''}">
        <div class="mission-card-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="mission-category" style="color:${esc(categoryColor)}; font-family:var(--font-mono); font-size:11px; font-weight:700; letter-spacing:0.1em;">
            [ ${esc(categoryName.toUpperCase())} ]
          </span>
          <span class="mission-status ${isSolved ? 'status-solved' : ''}" style="display:inline-flex; align-items:center; font-family:var(--font-mono); font-size:11px; color:${isSolved ? 'var(--accent)' : 'var(--text-secondary)'}; font-weight:700; ${isSolved ? 'background:var(--accent-muted); border:1px solid var(--accent); padding:2px 8px; border-radius:var(--radius-sm); letter-spacing:0.04em;' : ''}">
            ${isSolved ? '✓ CAPTURED' : (isPreview ? '👁 PREVIEW' : '● ACTIVE')}
          </span>
        </div>

        <h2 style="font-family:var(--font-heading); font-size:18px; font-weight:700; margin:0 0 8px 0; color:#fff;">
          ${esc(challenge.title)}
        </h2>

        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:16px; font-family:var(--font-mono);">
          MISSION ID: <span style="color:var(--text-primary); font-weight:700;">${esc(displayChallengeId)}</span>
        </div>

        <div class="mission-meta" style="display:flex; align-items:center; gap:12px; font-size:12px; font-family:var(--font-mono); margin-bottom:16px; color:var(--text-secondary);">
          <span style="color:${diffColor}; font-weight:600;">${esc(difficulty)}</span>
          <span>•</span>
          <span style="color:var(--accent); font-weight:700;">${formatXP(challenge.points)}</span>
          <span>•</span>
          <span>${challenge.solve_count || 0} SOLVES</span>
        </div>

        <a href="${linkHref}" class="btn ${isSolved ? 'btn-outline' : 'btn-primary'}" style="width:100%; text-decoration:none;">
          ${isSolved ? 'REVIEW MISSION' : (isPreview ? 'PREVIEW DOSSIER ↗' : 'ACCESS MISSION')}
        </a>
      </article>
    `;
  }
};

window.ChallengeCard = ChallengeCard;
