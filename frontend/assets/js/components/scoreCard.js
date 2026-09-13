/**
 * XPLOITX // CYBER BATTLEFIELD
 * ScoreCard Component (assets/js/components/scoreCard.js)
 */

const ScoreCard = {
  render({ label, value, subtext = '', accentColor = 'var(--accent)', icon = '⚡' }) {
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    return `
      <div class="telemetry-card" style="border-left: 3px solid ${esc(accentColor)};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); letter-spacing:0.08em; text-transform:uppercase;">
            ${esc(label)}
          </span>
          <span style="font-size:16px;">${esc(icon)}</span>
        </div>
        <div class="telemetry-val" style="color:#fff;">
          ${esc(value)}
        </div>
        ${subtext ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px; font-family:var(--font-mono);">${esc(subtext)}</div>` : ''}
      </div>
    `;
  }
};

window.ScoreCard = ScoreCard;
