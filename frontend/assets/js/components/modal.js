/**
 * XPLOITX // CYBER BATTLEFIELD
 * Tactical Modal System (assets/js/components/modal.js)
 */

const Modal = {
  overlay: null,

  init() {
    if (this.overlay) return;
    this.overlay = document.createElement('div');
    this.overlay.id = 'tactical-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(5, 7, 10, 0.85);
      backdrop-filter: blur(8px);
      z-index: 99990;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);
  },

  open({ title = 'TACTICAL ADVISORY', content = '', actions = [] }) {
    this.init();
    this.overlay.innerHTML = `
      <div class="modal-card" style="
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        max-width: 540px;
        width: 100%;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        overflow: hidden;
        animation: fadeInPage 0.2s ease-out;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        ">
          <span style="font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--accent); letter-spacing:0.08em;">
            ${window.Utils ? window.Utils.escapeHTML(title) : title}
          </span>
          <button style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:16px;" onclick="Modal.close()">✕</button>
        </div>
        <div style="padding: 20px; font-size: 13px; line-height: 1.6; color: var(--text-primary);" id="modalBodySlot">
          ${content}
        </div>
        <div style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
        " id="modalActionsSlot">
        </div>
      </div>
    `;

    const actionsSlot = this.overlay.querySelector('#modalActionsSlot');
    if (actions.length === 0) {
      actionsSlot.innerHTML = `<button class="btn btn-sm btn-outline" onclick="Modal.close()">DISMISS</button>`;
    } else {
      actions.forEach(act => {
        const btn = document.createElement('button');
        btn.className = `btn btn-sm ${act.primary ? 'btn-primary' : 'btn-outline'}`;
        btn.textContent = act.label;
        btn.onclick = () => {
          if (act.onClick) act.onClick();
          if (act.autoClose !== false) Modal.close();
        };
        actionsSlot.appendChild(btn);
      });
    }

    this.overlay.style.display = 'flex';
  },

  close() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }
};

window.Modal = Modal;
