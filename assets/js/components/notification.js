/**
 * XPLOITX // CYBER BATTLEFIELD
 * Notification Banner Component (assets/js/components/notification.js)
 */

const NotificationBanner = {
  bannerEl: null,

  init() {
    if (this.bannerEl) return;
    this.bannerEl = document.createElement('div');
    this.bannerEl.id = 'tactical-notification-banner';
    this.bannerEl.style.cssText = `
      display: none;
      background: linear-gradient(90deg, rgba(255, 59, 92, 0.95), rgba(181, 23, 158, 0.95));
      color: #fff;
      padding: 10px 20px;
      font-family: var(--font-heading);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      position: relative;
      z-index: 10001;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.2);
    `;
    document.body.prepend(this.bannerEl);
  },

  show(title, content, urgent = false) {
    this.init();
    const esc = window.Utils ? window.Utils.escapeHTML : (s => s);

    if (urgent) {
      this.bannerEl.style.background = 'linear-gradient(90deg, #ff3b5c, #b5179e)';
    } else {
      this.bannerEl.style.background = 'linear-gradient(90deg, #0d1218, #141a22)';
    }

    this.bannerEl.innerHTML = `
      <div class="container" style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
        <div style="display:flex; align-items:center; gap:10px; margin:0 auto;">
          <span style="font-family:var(--font-mono); font-size:11px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:3px; border:1px solid rgba(255,255,255,0.2);">
            ${urgent ? 'CRITICAL INTEL' : 'ADVISORY'}
          </span>
          <span><strong>${esc(title)}:</strong> ${esc(content)}</span>
        </div>
        <button style="background:none; border:none; color:#fff; cursor:pointer; font-size:16px;" onclick="NotificationBanner.hide()">✕</button>
      </div>
    `;
    this.bannerEl.style.display = 'block';
  },

  hide() {
    if (this.bannerEl) {
      this.bannerEl.style.display = 'none';
    }
  }
};

window.NotificationBanner = NotificationBanner;
