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
              Deploy on-demand isolated container to attack this mission.
            </div>
          </div>
          <button type="button" id="spawnInstanceBtn" class="btn btn-sm btn-primary" style="padding:10px 18px;">
            ⚡ RUN INSTANCE
          </button>
        </div>
      `;

      const spawnBtn = container.querySelector('#spawnInstanceBtn');
      if (spawnBtn) spawnBtn.addEventListener('click', onSpawn);
      return;
    }

    // In-progress transitional states
    if (instance.status === 'REQUESTED' || instance.status === 'STARTING' || instance.status === 'HEALTH_CHECKING') {
      const stateLabel = instance.status === 'HEALTH_CHECKING' ? 'VERIFYING CONTAINER HEALTH PROBE...' : 'PROVISIONING SANDBOX TARGET...';
      container.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--warning); padding:16px; border-radius:var(--radius-sm); animation:pulseGlow 2s infinite;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--warning); box-shadow:0 0 10px var(--warning);"></span>
              <span style="font-family:var(--font-mono); font-size:12px; color:var(--warning); font-weight:700; letter-spacing:0.08em;">
                ${stateLabel}
              </span>
            </div>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">INITIALIZING</span>
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
      container.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid var(--danger); padding:16px; border-radius:var(--radius-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--danger);"></span>
              <span style="font-family:var(--font-mono); font-size:12px; color:var(--danger); font-weight:700;">PROVISIONING FAILED</span>
            </div>
            <button type="button" id="retrySpawnBtn" class="btn btn-sm btn-primary">RETRY</button>
          </div>
          <div style="font-size:12px; font-family:var(--font-mono); color:var(--text-secondary); margin-top:6px;">
            ${instance.error || 'Container failed to initialize. Resource limits or image error.'}
          </div>
        </div>
      `;
      const retryBtn = container.querySelector('#retrySpawnBtn');
      if (retryBtn) retryBtn.addEventListener('click', onSpawn);
      return;
    }

    // Active RUNNING state
    const remainingSeconds = Math.max(0, Math.floor((new Date(instance.expiresAt || instance.expires_at) - Date.now()) / 1000));
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTimer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const hostString = instance.subdomain ? instance.subdomain : `${instance.host || 'xploitxctf.me'}:${instance.port}`;
    const webUrl = instance.webUrl || (instance.subdomain ? `http://${instance.subdomain}` : `http://${instance.host}:${instance.port}`);
    const ncTarget = `nc ${instance.host || 'xploitxctf.me'} ${instance.port}`;

    container.innerHTML = `
      <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:4px solid var(--accent); padding:18px; border-radius:var(--radius-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="telemetry-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 10px var(--accent);"></span>
            <span style="font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--accent); letter-spacing:0.08em;">
              ● SANDBOX OPERATIONAL
            </span>
            <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); background:var(--bg-card); padding:2px 6px; border-radius:2px; border:1px solid var(--border);">
              PORT ${instance.port}
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-family:var(--font-mono); font-size:12px; color:var(--warning); font-weight:700;">
              AUTO-NEUTRALIZE: <span id="instanceCountdownTimer">${formattedTimer}</span>
            </div>
            <button type="button" id="terminateInstanceBtn" class="btn btn-sm btn-outline" style="color:var(--danger); border-color:var(--danger); padding:4px 10px; font-size:11px;">
              TERMINATE
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr; gap:10px; background:var(--bg-card); border:1px solid var(--border); padding:14px; border-radius:var(--radius-sm);">
          ${instance.protocol === 'TCP' ? `
            <div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-bottom:4px;">TCP EXPLOIT TARGET:</div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-secondary); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm);">
                <code style="font-family:var(--font-mono); font-size:13px; color:var(--cyan);">${ncTarget}</code>
                <button type="button" class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${ncTarget}'); window.showSuccess && window.showSuccess('COPIED NETCAT TARGET');" style="font-size:10px; padding:3px 8px;">COPY</button>
              </div>
            </div>
          ` : `
            <div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); margin-bottom:4px;">HTTP BROWSER TARGET:</div>
              <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-secondary); border:1px solid var(--border); padding:8px 12px; border-radius:var(--radius-sm);">
                <a href="${webUrl}" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-mono); font-size:13px; color:var(--cyan); text-decoration:underline;">${webUrl}</a>
                <button type="button" class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${webUrl}'); window.showSuccess && window.showSuccess('COPIED WEB URL');" style="font-size:10px; padding:3px 8px;">COPY</button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    const termBtn = container.querySelector('#terminateInstanceBtn');
    if (termBtn) termBtn.addEventListener('click', onTerminate);

    // Live countdown update
    const timerEl = container.querySelector('#instanceCountdownTimer');
    if (timerEl) {
      if (window._instanceTimerHandle) clearInterval(window._instanceTimerHandle);
      window._instanceTimerHandle = setInterval(() => {
        const sec = Math.max(0, Math.floor((new Date(instance.expiresAt || instance.expires_at) - Date.now()) / 1000));
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
