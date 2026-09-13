/**
 * XPLOITX // CYBER BATTLEFIELD
 * Real-Time Battlefield Activity Feed Component (assets/js/components/activityFeed.js)
 * Implements Section 5 of Master Production Specification:
 * - Renders live flag captures, first blood notices, announcements, and team milestones
 * - Formatted tactical event badges (🩸 FIRST BLOOD, 🚩 CAPTURED, 📢 BROADCAST)
 * - Auto-prepends incoming WebSocket events without page refresh
 */

const ActivityFeed = {
  renderFeed(activities = [], targetId = 'activityFeedList') {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-secondary); font-family:var(--font-mono); background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-sm);">
          NO COMBAT TELEMETRY LOGGED. FREQUENCIES QUIET.
        </div>
      `;
      return;
    }

    container.innerHTML = activities.map(act => this.renderItem(act)).join('');
  },

  prependEvent(event, targetId = 'activityFeedList') {
    const container = document.getElementById(targetId);
    if (!container) return;

    // If empty state is visible, clear it
    if (container.querySelector('div') && (container.textContent.includes('FREQUENCIES QUIET') || container.textContent.includes('NO RECENT ACTIVITY'))) {
      container.innerHTML = '';
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this.renderItem(event);
    const element = tempDiv.firstElementChild;
    element.style.animation = 'fadeIn 0.4s ease-out';
    container.insertBefore(element, container.firstChild);
  },

  renderItem(act) {
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);
    const timeAgo = window.Utils && act.timestamp ? window.Utils.timeAgo(act.timestamp) : (act.timestamp || 'JUST NOW');
    
    let typeBadge = '';
    let borderAccent = 'var(--border)';

    if (act.isFirstBlood || act.type === 'FIRST_BLOOD') {
      typeBadge = `<span style="color:var(--danger); font-weight:800; font-family:var(--font-mono); font-size:11px; background:rgba(255,0,85,0.1); padding:2px 8px; border-radius:2px; border:1px solid var(--danger);">🩸 FIRST BLOOD</span>`;
      borderAccent = 'var(--danger)';
    } else if (act.type === 'SOLVE' || act.type === 'FLAG_CAPTURED') {
      typeBadge = `<span style="color:var(--accent); font-weight:700; font-family:var(--font-mono); font-size:11px; background:rgba(0,255,156,0.08); padding:2px 8px; border-radius:2px; border:1px solid var(--accent);">🚩 FLAG CAPTURED</span>`;
      borderAccent = 'var(--accent)';
    } else if (act.type === 'ANNOUNCEMENT') {
      typeBadge = `<span style="color:var(--warning); font-weight:700; font-family:var(--font-mono); font-size:11px; background:rgba(255,183,3,0.1); padding:2px 8px; border-radius:2px; border:1px solid var(--warning);">📢 BROADCAST</span>`;
      borderAccent = 'var(--warning)';
    } else {
      typeBadge = `<span style="color:var(--cyan); font-weight:700; font-family:var(--font-mono); font-size:11px; background:rgba(0,216,246,0.1); padding:2px 8px; border-radius:2px; border:1px solid var(--cyan);">📡 TELEMETRY</span>`;
    }

    return `
      <div class="activity-feed-item" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ${borderAccent}; padding:14px 18px; border-radius:var(--radius-sm); margin-bottom:10px; transition:border-color 0.2s;">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          ${typeBadge}
          <div style="font-size:13px; color:#fff;">
            <strong style="color:var(--text-bright);">${esc(act.teamName || act.userCallsign || act.author || 'Operative')}</strong>
            <span style="color:var(--text-secondary);"> ${esc(act.action || 'solved')} </span>
            <strong style="color:var(--cyan);">${esc(act.target || act.challengeTitle || '')}</strong>
            ${act.points ? `<span style="color:var(--accent); font-family:var(--font-mono); font-weight:700; font-size:12px; margin-left:6px;">+${act.points} XP</span>` : ''}
          </div>
        </div>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); white-space:nowrap; margin-left:12px;">
          ${timeAgo}
        </div>
      </div>
    `;
  }
};

window.ActivityFeed = ActivityFeed;
