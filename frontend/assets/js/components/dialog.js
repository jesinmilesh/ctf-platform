/**
 * XPLOITX // CYBER BATTLEFIELD
 * Tactical Confirmation Dialog Component (assets/js/components/dialog.js)
 * Implements Section 5 of Master Production Specification:
 * - Keyboard navigation (Esc to cancel, Enter to confirm)
 * - Accessible ARIA dialog attributes
 * - Custom severity styles: danger (red), warning (amber), standard (terminal green)
 */

const Dialog = {
  confirm({
    title = 'CONFIRM DIRECTIVE',
    message = 'Are you certain you wish to proceed with this operation?',
    confirmText = 'EXECUTE',
    cancelText = 'ABORT',
    severity = 'standard', // 'danger' | 'warning' | 'standard'
    onConfirm = () => {},
    onCancel = () => {}
  }) {
    // Remove any existing dialog
    const existing = document.getElementById('tacticalDialogOverlay');
    if (existing) existing.remove();

    const accentColor = severity === 'danger' ? 'var(--danger)' : (severity === 'warning' ? 'var(--warning)' : 'var(--accent)');
    const btnClass = severity === 'danger' ? 'btn-danger' : 'btn-primary';

    const overlay = document.createElement('div');
    overlay.id = 'tacticalDialogOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'dialogTitle');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(3, 5, 8, 0.85); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.15s ease-out;
    `;

    overlay.innerHTML = `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-top:3px solid ${accentColor}; border-radius:var(--radius-md); max-width:460px; width:100%; padding:24px; box-shadow:0 16px 40px rgba(0,0,0,0.7);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <span style="font-family:var(--font-mono); font-size:11px; font-weight:700; color:${accentColor}; letter-spacing:0.1em;">
            DIRECTIVE // CONFIRMATION REQUIRED
          </span>
        </div>
        <h2 id="dialogTitle" style="font-family:var(--font-heading); font-size:20px; font-weight:800; color:#fff; margin:0 0 10px 0;">
          ${title}
        </h2>
        <p style="color:var(--text-secondary); font-size:13px; line-height:1.6; margin:0 0 24px 0;">
          ${message}
        </p>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" id="dialogCancelBtn" class="btn btn-outline" style="padding:8px 16px; font-size:12px;">
            ${cancelText}
          </button>
          <button type="button" id="dialogConfirmBtn" class="btn ${btnClass}" style="padding:8px 18px; font-size:12px;">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('#dialogConfirmBtn');
    const cancelBtn = overlay.querySelector('#dialogCancelBtn');

    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
      overlay.remove();
    }

    function keyHandler(e) {
      if (e.key === 'Escape') {
        cleanup();
        onCancel();
      } else if (e.key === 'Enter') {
        cleanup();
        onConfirm();
      }
    }

    document.addEventListener('keydown', keyHandler);

    confirmBtn.addEventListener('click', () => {
      cleanup();
      onConfirm();
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      onCancel();
    });

    confirmBtn.focus();
  }
};

window.Dialog = Dialog;
