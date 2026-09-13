/**
 * XPLOITX // CYBER BATTLEFIELD
 * Leaderboard & Podium Component (assets/js/components/leaderboard.js)
 */

const Leaderboard = {
  renderPodium(podium) {
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    const formatXP = window.Utils ? window.Utils.formatXP : (s => `${s} XP`);

    const p1 = podium.first;
    const p2 = podium.second;
    const p3 = podium.third;

    return `
      <div class="scoreboard-top-podium">
        <!-- Rank 2 -->
        <div class="podium-card rank-2" style="border-top: 3px solid var(--silver);">
          <div style="font-family:var(--font-mono); font-size:12px; color:var(--silver); font-weight:700; margin-bottom:4px;">#02 // SILVER</div>
          <div style="font-family:var(--font-heading); font-size:18px; font-weight:700; color:#fff; margin-bottom:6px;">
            ${p2 ? esc(p2.name) : 'Awaiting Operative'}
          </div>
          <div style="font-family:var(--font-display); font-size:20px; font-weight:800; color:var(--silver);">
            ${p2 ? formatXP(p2.score) : '0 XP'}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:6px; font-family:var(--font-mono);">
            ${p2 ? `${p2.solvesCount} SOLVES` : ''}
          </div>
        </div>

        <!-- Rank 1 (Gold Apex) -->
        <div class="podium-card rank-1" style="border-top: 4px solid var(--gold); transform: translateY(-10px); box-shadow: 0 0 24px rgba(255, 190, 11, 0.15);">
          <div style="font-size:24px; margin-bottom:4px;">👑</div>
          <div style="font-family:var(--font-mono); font-size:13px; color:var(--gold); font-weight:800; letter-spacing:0.08em; margin-bottom:4px;">#01 // GOLD APEX</div>
          <div style="font-family:var(--font-heading); font-size:22px; font-weight:800; color:#fff; margin-bottom:6px;">
            ${p1 ? esc(p1.name) : 'Awaiting Champion'}
          </div>
          <div style="font-family:var(--font-display); font-size:26px; font-weight:900; color:var(--gold);">
            ${p1 ? formatXP(p1.score) : '0 XP'}
          </div>
          <div style="font-size:11px; color:var(--accent); margin-top:6px; font-family:var(--font-mono);">
            ${p1 ? `${p1.solvesCount} SOLVES • ${p1.firstBloods} FIRST BLOODS` : ''}
          </div>
        </div>

        <!-- Rank 3 -->
        <div class="podium-card rank-3" style="border-top: 3px solid var(--bronze);">
          <div style="font-family:var(--font-mono); font-size:12px; color:var(--bronze); font-weight:700; margin-bottom:4px;">#03 // BRONZE</div>
          <div style="font-family:var(--font-heading); font-size:18px; font-weight:700; color:#fff; margin-bottom:6px;">
            ${p3 ? esc(p3.name) : 'Awaiting Operative'}
          </div>
          <div style="font-family:var(--font-display); font-size:20px; font-weight:800; color:var(--bronze);">
            ${p3 ? formatXP(p3.score) : '0 XP'}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:6px; font-family:var(--font-mono);">
            ${p3 ? `${p3.solvesCount} SOLVES` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderTable(teams = []) {
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    const formatXP = window.Utils ? window.Utils.formatXP : (s => `${s} XP`);
    const timeAgo = window.Utils ? window.Utils.timeAgo : (s => s);

    if (!teams || teams.length === 0) {
      return `
        <div style="text-align:center; padding:40px; color:var(--text-secondary); font-family:var(--font-mono);">
          NO SQUADS REGISTERED ON LIVE BATTLEFIELD GRID YET.
        </div>
      `;
    }

    const rows = teams.map(t => {
      let rankBadge = `#${String(t.rank).padStart(2, '0')}`;
      let rankColor = 'var(--text-secondary)';
      if (t.rank === 1) rankColor = 'var(--gold)';
      else if (t.rank === 2) rankColor = 'var(--silver)';
      else if (t.rank === 3) rankColor = 'var(--bronze)';

      return `
        <tr style="border-bottom:1px solid var(--border); transition: background 0.15s ease;">
          <td style="padding:14px 18px; font-family:var(--font-mono); font-weight:800; color:${rankColor};">
            ${rankBadge}
          </td>
          <td style="padding:14px 18px;">
            <a href="/team.html?id=${encodeURIComponent(t.id)}" style="font-family:var(--font-heading); font-size:14px; font-weight:700; color:#fff; text-decoration:none;">
              ${esc(t.name)}
            </a>
          </td>
          <td style="padding:14px 18px; font-family:var(--font-mono); font-size:14px; font-weight:800; color:var(--accent);">
            ${formatXP(t.score)}
          </td>
          <td style="padding:14px 18px; font-family:var(--font-mono); font-size:12px; color:var(--text-secondary);">
            ${t.solvesCount}
          </td>
          <td style="padding:14px 18px; font-family:var(--font-mono); font-size:12px; color:var(--danger); font-weight:700;">
            ${t.firstBloods > 0 ? `🩸 ${t.firstBloods}` : '-'}
          </td>
          <td style="padding:14px 18px; font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
            ${timeAgo(t.lastScoreUpdate)}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border); font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.08em;">
              <th style="padding:12px 18px;">Rank</th>
              <th style="padding:12px 18px;">Squad Designation</th>
              <th style="padding:12px 18px;">XP Score</th>
              <th style="padding:12px 18px;">Solves</th>
              <th style="padding:12px 18px;">First Bloods</th>
              <th style="padding:12px 18px;">Last Capture</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }
};

window.Leaderboard = Leaderboard;
