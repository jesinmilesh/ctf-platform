/**
 * XPLOITX // CYBER BATTLEFIELD
 * Tactical Toast Notification Engine (assets/js/components/toast.js)
 */

const Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'tactical-toast-container';
    this.container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 420px;
      width: 100%;
    `;
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', durationMs = 4000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `tactical-toast toast-${type}`;
    toast.style.cssText = `
      pointer-events: auto;
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 14px 18px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      font-family: var(--font-heading);
      font-size: 13px;
      animation: fadeInPage 0.2s ease-out;
      transition: all 0.2s ease;
    `;

    let borderColor = 'var(--border)';
    let icon = '⚡';
    if (type === 'success') {
      borderColor = 'var(--accent)';
      icon = '✓';
      toast.style.boxShadow = '0 0 16px var(--accent-glow)';
    } else if (type === 'error' || type === 'danger') {
      borderColor = 'var(--danger)';
      icon = '✕';
      toast.style.boxShadow = '0 0 16px var(--danger-glow)';
    } else if (type === 'warning') {
      borderColor = 'var(--warning)';
      icon = '⚠';
    } else if (type === 'firstblood' || type === 'urgent') {
      borderColor = 'var(--gold)';
      icon = '🩸';
      toast.style.boxShadow = '0 0 20px rgba(255, 190, 11, 0.4)';
    }

    toast.style.borderLeft = `4px solid ${borderColor}`;
    toast.innerHTML = `
      <span style="font-size:16px;">${icon}</span>
      <div style="flex:1; color:#fff; line-height:1.4;">${window.Utils ? window.Utils.escapeHTML(message) : message}</div>
      <button style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px;" onclick="this.parentElement.remove()">✕</button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, durationMs);
  },

  firstBlood(teamName, challengeTitle) {
    this.show(`FIRST BLOOD: Squad [${teamName}] captured flag on [${challengeTitle}]!`, 'firstblood', 6000);
  }
};

window.Toast = Toast;
window.showSuccess = (msg) => Toast.show(msg, 'success');
window.showError = (msg) => Toast.show(msg, 'error');
window.showWarning = (msg) => Toast.show(msg, 'warning');
