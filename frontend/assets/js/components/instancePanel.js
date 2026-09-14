/**
 * XPLOITX // CYBER BATTLEFIELD
 * Interactive Mission Sandbox Controller Component (assets/js/components/instancePanel.js)
 * Implements Section 5 & 39 of Master Production Specification:
 * - Real-time instance states: REQUESTED, STARTING, HEALTH_CHECKING, RUNNING, FAILED, STOPPING, STOPPED, EXPIRED
 * - Dynamic timer countdown without page reload
 * - Subdomain and direct host:port display
 * - One-click clipboard copy of target connection strings (nc / curl)
 * - Start / Terminate sandbox lifecycle controls
 */

const InstancePanel = {
  render({
    targetId = 'instanceStatusSlot',
    challengeId,
    instance = null,
    onSpawn = async () => {},
    onTerminate = async () => {}
  }) {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (!instance || instance.status === 'STOPPED' || instance.status === 'DESTROYED') {
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); padding:16px; border-radius:var(--radius-sm);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--text-muted);"></span>
              <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-secondary); font-weight:700;">SANDBOX TARGET: OFFLINE</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
              Deploy on-demand isolated Docker container to attack this mission.
            </div>
          </div>
          <button type="button" id="spawnInstanceBtn" class="btn btn-sm btn-primary" style="padding:10px 18px; font-weight:700;">
            ⚡ START INSTANCE
          </button>
        </div>
      `;

      const spawnBtn = container.querySelector('#spawnInstanceBtn');
      if (spawnBtn) {
        spawnBtn.addEventListener('click', (e) => {
          spawnBtn.disabled = true;
          spawnBtn.innerHTML = `⏳ ALLOCATING INSTANCE...`;
          onSpawn(e);
        });
      }
      return;
    }

    // In-progress transitional states
    if (['REQUESTED', 'ALLOCATING', 'PORT_RESERVED', 'CONTAINER_CREATING', 'STARTING', 'HEALTH_CHECKING'].includes(instance.status)) {
      let stateLabel = 'REQUESTING';
      if (instance.status === 'ALLOCATING' || instance.status === 'PORT_RESERVED') {
        stateLabel = 'ALLOCATING PORT';
      } else if (instance.status === 'CONTAINER_CREATING' || instance.status === 'STARTING') {
        stateLabel = 'STARTING CONTAINER';
      } else if (instance.status === 'HEALTH_CHECKING') {
        stateLabel = 'HEALTH CHECK';
      }

      container.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--warning); padding:16px; border-radius:var(--radius-sm); animation:pulseGlow 2s infinite;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--warning); box-shadow:0 0 10px var(--warning);"></span>
              <span style="font-family:var(--font-mono); font-size:12px; color:var(--warning); font-weight:700; letter-spacing:0.08em;">
                ${stateLabel}
              </span>
            </div>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">PROVISIONING</span>
          </div>
          <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-secondary); margin-top:8px;">
            PORT ALLOCATION: ${instance.port ? 'PORT ' + instance.port + ' RESERVED' : 'ATOMIC LOCKING...'}
          </div>
        </div>
      `;
      return;
    }

    // Failed State
    if (instance.status === 'FAILED') {
      const isAgentOffline = instance.code === 'AGENT_OFFLINE' || (instance.error || '').includes('AGENT_OFFLINE');
      const isAgentTimeout = instance.code === 'AGENT_TIMEOUT';

      const icon = isAgentOffline ? '🔌' : '⚠';
      const headline = isAgentOffline ? 'AGENT OFFLINE' : isAgentTimeout ? 'AGENT TIMEOUT' : 'PROVISIONING FAILED';
      const detail = instance.errorDetail || instance.error || 'Container failed to initialize. Resource limits or image error.';
      const borderColor = isAgentOffline ? '#ff9500' : 'var(--danger)';
      const textColor = isAgentOffline ? '#ff9500' : 'var(--danger)';

      container.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ${borderColor}; padding:16px; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">${icon}</span>
              <span style="font-family:var(--font-mono); font-size:12px; color:${textColor}; font-weight:700;">${headline}</span>
            </div>
            ${!isAgentOffline ? `<button type="button" id="retrySpawnBtn" class="btn btn-sm btn-primary">RETRY</button>` : ''}
          </div>
          <div style="font-size:12px; font-family:var(--font-mono); color:var(--text-secondary); margin-top:8px; line-height:1.6;">
            ${detail}
          </div>
        </div>
      `;
      if (!isAgentOffline) {
        const retryBtn = container.querySelector('#retrySpawnBtn');
        if (retryBtn) retryBtn.addEventListener('click', onSpawn);
      }
      return;
    }


    // Active RUNNING state
    const expiresAtMs = new Date(instance.expiresAt || instance.expires_at).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Authoritative URL directly from backend - frontend never computes the port itself
    const targetUrl = instance.url || instance.webUrl || `http://${instance.subdomain || instance.host || 'xploitxctf.me'}:${instance.port}`;
    const targetProtocol = (instance.protocol || 'HTTP').toUpperCase();
    const targetPort = instance.port || '---';

    container.innerHTML = `
      <div class="instance-access-card" style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--accent); padding:24px; border-radius:var(--radius-md); box-shadow:0 8px 24px rgba(0,0,0,0.35);">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:14px; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="telemetry-status-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--accent); box-shadow:0 0 12px var(--accent); animation:pulseGlow 2s infinite;"></span>
            <span style="font-family:var(--font-mono); font-size:14px; font-weight:800; color:#fff; letter-spacing:0.1em;">
              INSTANCE ONLINE
            </span>
          </div>
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); background:var(--bg-secondary); padding:3px 8px; border-radius:var(--radius-sm); border:1px solid var(--border);">
            ISOLATED SANDBOX
          </span>
        </div>

        <!-- Telemetry Table (Section 9 Access Model) -->
        <div style="display:grid; grid-template-columns: 120px 1fr; row-gap:10px; column-gap:16px; font-family:var(--font-mono); font-size:13px; margin-bottom:20px; background:var(--bg-secondary); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <div style="color:var(--text-secondary); font-weight:600;">Protocol</div>
          <div style="color:#fff; font-weight:700;"><span style="color:var(--cyan);">${targetProtocol}</span></div>

          <div style="color:var(--text-secondary); font-weight:600;">Port</div>
          <div style="color:#fff; font-weight:700;"><span style="color:var(--accent);">${targetPort}</span></div>

          <div style="color:var(--text-secondary); font-weight:600;">Status</div>
          <div style="color:var(--accent); font-weight:800;">RUNNING</div>

          <div style="color:var(--text-secondary); font-weight:600;">Remaining</div>
          <div style="color:var(--warning); font-weight:800;" id="instanceCountdownTimer">${formattedTimer}</div>

          <div style="color:var(--text-secondary); font-weight:600;">URL</div>
          <div style="word-break:break-all;"><code style="font-size:12px; color:var(--cyan);">${targetUrl}</code></div>
        </div>

        <!-- Action Controls -->
        <div style="display:flex; flex-wrap:wrap; gap:12px;">
          <button type="button" id="openInstanceBtn" class="btn btn-primary" style="display:flex; align-items:center; gap:8px; padding:10px 20px; font-weight:700; letter-spacing:0.05em;">
            <span>↗</span> OPEN INSTANCE
          </button>
          <button type="button" id="copyInstanceUrlBtn" class="btn btn-outline" style="padding:10px 18px; font-weight:700;">
            📋 COPY URL
          </button>
          <button type="button" id="stopInstanceBtn" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger); padding:10px 18px; font-weight:700;">
            ⏹ STOP INSTANCE
          </button>
        </div>
      </div>
    `;

    // 1. OPEN INSTANCE: Navigate in separate window/tab - no iframe mixed-content issues!
    const openBtn = container.querySelector('#openInstanceBtn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      });
    }

    // 2. COPY URL: Copy backend-generated HTTP URL to clipboard
    const copyBtn = container.querySelector('#copyInstanceUrlBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(targetUrl);
          if (window.showSuccess) window.showSuccess('COPIED INSTANCE URL: ' + targetUrl);
        } catch (e) {
          const temp = document.createElement('input');
          temp.value = targetUrl;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
          if (window.showSuccess) window.showSuccess('COPIED INSTANCE URL: ' + targetUrl);
        }
      });
    }

    // 3. STOP INSTANCE: Terminate instance
    const stopBtn = container.querySelector('#stopInstanceBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', onTerminate);
    }

    // Authoritative live countdown update
    const timerEl = container.querySelector('#instanceCountdownTimer');
    if (timerEl) {
      if (window._instanceTimerHandle) clearInterval(window._instanceTimerHandle);
      window._instanceTimerHandle = setInterval(() => {
        const sec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (sec <= 0) {
          clearInterval(window._instanceTimerHandle);
          InstancePanel.render({ targetId, challengeId, instance: { status: 'EXPIRED' }, onSpawn, onTerminate });
        }
      }, 1000);
    }
  }
};

window.InstancePanel = InstancePanel;

