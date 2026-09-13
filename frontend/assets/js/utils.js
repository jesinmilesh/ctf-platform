/**
 * XPLOITX // CYBER BATTLEFIELD
 * Utility Library (assets/js/utils.js)
 */

const Utils = {
  /**
   * Escape HTML to prevent XSS (Section 27 of Blueprint)
   */
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Format numeric XP (e.g. 1420 -> "1,420 XP")
   */
  formatXP(points) {
    const val = parseInt(points, 10) || 0;
    return `${val.toLocaleString()} XP`;
  },

  /**
   * Relative time formatter (e.g. "12m ago", "2h ago")
   */
  timeAgo(isoString) {
    if (!isoString) return 'Classified';
    const date = new Date(isoString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },

  /**
   * Copy string to clipboard with feedback
   */
  async copyToClipboard(text, successMsg = 'COPIED TO CLIPBOARD') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      if (window.Toast) {
        window.Toast.show(successMsg, 'success');
      }
      return true;
    } catch (err) {
      console.error('Clipboard copy failed', err);
      if (window.Toast) {
        window.Toast.show('COPY FAILED', 'error');
      }
      return false;
    }
  },

  /**
   * Difficulty badge class & label
   */
  getDifficultyBadge(diff) {
    const d = (diff || 'MEDIUM').toUpperCase();
    let color = 'var(--text-secondary)';
    if (d === 'EASY') color = 'var(--accent)';
    else if (d === 'MEDIUM') color = 'var(--cyan)';
    else if (d === 'HARD') color = 'var(--warning)';
    else if (d === 'INSANE') color = 'var(--danger)';

    return `<span class="badge" style="border-color:${color}; color:${color}; background:rgba(255,255,255,0.03);">${Utils.escapeHTML(d)}</span>`;
  }
};

window.Utils = Utils;
