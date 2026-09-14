/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Infrastructure Controller (frontend/assets/js/admin/instances.js)
 *
 * Manages:
 *   - Docker Agent registry: list, pair, revoke, live telemetry via WS
 *   - Active Sandboxes: list, terminate, destroy
 */

(async () => {
  // ── Auth guard ────────────────────────────────────────────────────
  const me = await window.authGuard?.({ requireAdmin: true });
  if (!me) return;

  window.initAdminSidebar?.('instances');

  // ── State ─────────────────────────────────────────────────────────
  let agents = [];
  let instances = [];
  let pairingExpiresAt = null;
  let pairingCountdownInterval = null;
  let currentPairingCode = '';
  let pollInterval = null;

  // ── Tab system ────────────────────────────────────────────────────
  window.switchTab = function(tab) {
    document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    document.getElementById(`panel-${tab}`)?.classList.add('active');

    if (tab === 'sandboxes') loadInstances();
    if (tab === 'agents') loadAgents();
  };

  // ── Pairing Modal ─────────────────────────────────────────────────
  document.getElementById('btnPairAgent')?.addEventListener('click', async () => {
    openPairingModal();
    await generatePairingCode();
  });

  function openPairingModal() {
    document.getElementById('pairingModalOverlay').classList.add('open');
    document.getElementById('pairingCodeText').textContent = 'GENERATING...';
    document.getElementById('pairingCountdown').textContent = 'Expires in: --:--';
  }

  window.closePairingModal = function() {
    document.getElementById('pairingModalOverlay').classList.remove('open');
    clearInterval(pairingCountdownInterval);
  };

  async function generatePairingCode() {
    try {
      const res = await window.api?.post('/agents/generate-code', {});
      if (!res?.success) throw new Error(res?.error?.message || 'Failed');

      currentPairingCode = res.pairingCode;
      pairingExpiresAt = new Date(res.expiresAt);

      document.getElementById('pairingCodeText').textContent = currentPairingCode;
      document.getElementById('pairingCmdText').innerHTML =
        `cd xploitx-docker-agent &amp;&amp; npm run pair <strong style="color:var(--cyan);">${currentPairingCode}</strong>`;

      startPairingCountdown();
    } catch (err) {
      document.getElementById('pairingCodeText').textContent = 'ERROR';
      window.showToast?.('Failed to generate pairing code: ' + err.message, 'error');
    }
  }

  function startPairingCountdown() {
    clearInterval(pairingCountdownInterval);
    const el = document.getElementById('pairingCountdown');
    pairingCountdownInterval = setInterval(() => {
      const remaining = Math.max(0, pairingExpiresAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      el.textContent = `Expires in: ${mins}:${secs.toString().padStart(2, '0')}`;
      if (remaining === 0) {
        clearInterval(pairingCountdownInterval);
        el.textContent = '⚠ Code expired — click PAIR NEW AGENT to generate another.';
        el.style.color = 'var(--danger)';
      }
    }, 1000);
  }

  window.copyPairingCode = function() {
    if (!currentPairingCode) return;
    navigator.clipboard.writeText(currentPairingCode).then(() => {
      window.showToast?.('Pairing code copied to clipboard', 'success');
    });
  };

  // Close modal on overlay click
  document.getElementById('pairingModalOverlay')?.addEventListener('click', function(e) {
    if (e.target === this) window.closePairingModal();
  });

  // ── Load Agents ───────────────────────────────────────────────────
  async function loadAgents() {
    try {
      const res = await window.api?.get('/agents');
      agents = res?.agents || [];
      renderAgents();
    } catch (err) {
      renderAgentsError(err.message);
    }
  }

  function renderAgents() {
    const grid = document.getElementById('agentsGrid');
    if (!grid) return;

    if (agents.length === 0) {
      grid.innerHTML = `
        <div class="empty-infra">
          <div class="empty-icon">🔌</div>
          <div class="empty-title">NO AGENTS REGISTERED</div>
          <div class="empty-desc">Click <strong>⚡ PAIR NEW AGENT</strong> to connect your Docker host.</div>
        </div>`;
      return;
    }

    grid.innerHTML = agents.map(agent => buildAgentCard(agent)).join('');
  }

  function buildAgentCard(agent) {
    const isOnline = agent.status === 'ONLINE';
    const statusClass = isOnline ? 'online' : 'offline';
    const cpu = agent.systemInfo?.cpuUsagePercent ?? '--';
    const mem = agent.systemInfo?.freeMemoryMB != null
      ? `${Math.round(agent.systemInfo.freeMemoryMB)}MB free`
      : '--';
    const totalMem = agent.systemInfo?.totalMemoryMB ? `/ ${Math.round(agent.systemInfo.totalMemoryMB)}MB` : '';
    const lastHb = agent.lastHeartbeat
      ? timeSince(new Date(agent.lastHeartbeat))
      : 'Never';

    return `
      <div class="agent-card ${statusClass}" id="agent-card-${agent.agentId}">
        <div class="agent-card-header">
          <div class="agent-status-dot ${statusClass}"></div>
          <div class="agent-name">${escHtml(agent.name)}</div>
          <div class="agent-version">v${escHtml(agent.version || '1.0.0')}</div>
        </div>

        <div class="agent-telemetry">
          <div class="telemetry-item">
            <div class="telemetry-label">CPU</div>
            <div class="telemetry-value">${cpu !== '--' ? cpu + '%' : '--'}</div>
          </div>
          <div class="telemetry-item">
            <div class="telemetry-label">Memory</div>
            <div class="telemetry-value" style="font-size:11px;">${mem} ${totalMem}</div>
          </div>
          <div class="telemetry-item">
            <div class="telemetry-label">Containers</div>
            <div class="telemetry-value">${agent.activeInstances ?? 0}</div>
          </div>
          <div class="telemetry-item">
            <div class="telemetry-label">Platform</div>
            <div class="telemetry-value" style="font-size:11px;">${agent.systemInfo?.platform || '--'}</div>
          </div>
        </div>

        <div class="agent-meta">
          ID: <span>${escHtml(agent.agentId)}</span><br>
          Device: <span>${escHtml(agent.deviceId || '--').slice(0, 16)}...</span><br>
          Status: <span class="${isOnline ? 'badge badge-online' : 'badge badge-offline'}">${agent.status}</span><br>
          Last Heartbeat: <span>${lastHb}</span>
        </div>

        <div class="agent-actions">
          <button class="btn-danger-ghost" onclick="revokeAgent('${escHtml(agent.agentId)}', '${escHtml(agent.name)}')">
            ✕ REVOKE
          </button>
          <button class="btn btn-sm btn-outline" onclick="viewAgentInstances('${escHtml(agent.agentId)}')"
            style="font-size:11px; font-family:var(--font-mono);">
            VIEW CONTAINERS
          </button>
        </div>
      </div>`;
  }

  function renderAgentsError(msg) {
    const grid = document.getElementById('agentsGrid');
    if (grid) grid.innerHTML = `<div class="empty-infra"><div class="empty-title" style="color:var(--danger);">ERROR: ${escHtml(msg)}</div></div>`;
  }

  window.revokeAgent = async function(agentId, name) {
    if (!confirm(`Revoke agent "${name}"?\n\nThis will permanently disconnect and invalidate the agent. The agent will need to be re-paired.`)) return;
    try {
      const res = await window.api?.post(`/agents/${agentId}/revoke`, {});
      if (!res?.success) throw new Error(res?.error?.message || 'Failed');
      window.showToast?.(`Agent ${name} revoked.`, 'success');
      await loadAgents();
    } catch (err) {
      window.showToast?.('Revoke failed: ' + err.message, 'error');
    }
  };

  window.viewAgentInstances = function(agentId) {
    switchTab('sandboxes');
    loadInstances(agentId);
  };

  // ── Load Active Instances ─────────────────────────────────────────
  async function loadInstances(filterAgentId) {
    const tbody = document.getElementById('adminInstancesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-secondary);font-family:var(--font-mono);">LOADING...</td></tr>';

    try {
      const res = await window.api?.get('/instances');
      instances = res?.instances || [];
      renderInstances(filterAgentId);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--danger);font-family:var(--font-mono);">ERROR: ${escHtml(err.message)}</td></tr>`;
    }
  }

  function renderInstances(filterAgentId) {
    const tbody = document.getElementById('adminInstancesTableBody');
    if (!tbody) return;

    let list = instances;
    if (filterAgentId) list = list.filter(i => i.metadata?.agentId === filterAgentId);

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-secondary);font-family:var(--font-mono);">NO ACTIVE CONTAINERS</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(inst => {
      const statusBadge = buildStatusBadge(inst.status);
      const healthBadge = buildHealthBadge(inst.healthCheckStatus);
      const expiresAt = inst.expiresAt || inst.expires_at;
      const agentId = inst.metadata?.agentId || '—';
      return `
        <tr style="border-bottom:1px solid var(--border); font-family:var(--font-mono); font-size:12px;">
          <td style="padding:12px 16px; color:var(--cyan);">${escHtml((inst.instanceId || inst.id || '').slice(0,18))}</td>
          <td style="padding:12px 16px; color:var(--text-primary);">${escHtml(inst.challengeId || '—').slice(0,20)}</td>
          <td style="padding:12px 16px; color:var(--text-secondary);">${escHtml(agentId.slice(0,18))}</td>
          <td style="padding:12px 16px; color:var(--text-primary);">${inst.port || '—'}</td>
          <td style="padding:12px 16px;">${statusBadge}</td>
          <td style="padding:12px 16px;">${healthBadge}</td>
          <td style="padding:12px 16px; color:var(--text-secondary);">${expiresAt ? relativeTime(new Date(expiresAt)) : '—'}</td>
          <td style="padding:12px 16px; text-align:right;">
            <button class="btn-danger-ghost" onclick="terminateInstance('${escHtml(inst.instanceId || inst.id || '')}')">
              ■ STOP
            </button>
          </td>
        </tr>`;
    }).join('');
  }

  window.terminateInstance = async function(instanceId) {
    if (!instanceId || !confirm(`Terminate instance ${instanceId}?`)) return;
    try {
      const res = await window.api?.delete(`/instances/${instanceId}`);
      if (!res?.success) throw new Error(res?.error?.message || 'Failed');
      window.showToast?.('Instance terminated.', 'success');
      await loadInstances();
    } catch (err) {
      window.showToast?.('Terminate failed: ' + err.message, 'error');
    }
  };

  // ── WebSocket real-time agent telemetry ───────────────────────────
  function connectRealtime() {
    const wsUrl = window.location.origin.replace('http', 'ws');
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch { return; }

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'AGENT_ONLINE' || msg.type === 'AGENT_OFFLINE' || msg.type === 'AGENT_HEARTBEAT') {
        const agentId = msg.payload?.agentId;
        if (!agentId) return;

        const existing = agents.find(a => a.agentId === agentId);
        if (existing) {
          if (msg.type === 'AGENT_ONLINE') existing.status = 'ONLINE';
          if (msg.type === 'AGENT_OFFLINE') existing.status = 'OFFLINE';
          if (msg.type === 'AGENT_HEARTBEAT') {
            existing.status = 'ONLINE';
            existing.systemInfo = msg.payload.systemInfo || existing.systemInfo;
            existing.activeInstances = msg.payload.activeInstances ?? existing.activeInstances;
            existing.lastHeartbeat = new Date().toISOString();
          }
          // Patch only this card instead of full re-render
          const card = document.getElementById(`agent-card-${agentId}`);
          if (card) {
            const newCard = document.createElement('div');
            newCard.innerHTML = buildAgentCard(existing);
            card.replaceWith(newCard.firstElementChild);
          }
        } else if (msg.type === 'AGENT_ONLINE') {
          loadAgents(); // New agent connected — full refresh
        }
      }

      if (['INSTANCE_ONLINE', 'INSTANCE_FAILED', 'INSTANCE_STOPPED', 'INSTANCE_EXPIRED'].includes(msg.type)) {
        const activeTab = document.querySelector('.infra-tab.active')?.id;
        if (activeTab === 'tab-sandboxes') loadInstances();
      }
    });

    ws.addEventListener('close', () => setTimeout(connectRealtime, 5000));
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function buildStatusBadge(status) {
    const map = {
      RUNNING: 'badge-running',
      FAILED: 'badge-failed',
      STARTING: 'badge-starting',
      HEALTH_CHECKING: 'badge-starting',
      ALLOCATING: 'badge-starting',
      STOPPED: 'badge-stopped',
      EXPIRED: 'badge-stopped',
      DESTROYED: 'badge-stopped'
    };
    return `<span class="badge ${map[status] || 'badge-stopped'}">${status || '?'}</span>`;
  }

  function buildHealthBadge(health) {
    const map = { HEALTHY: 'badge-running', UNHEALTHY: 'badge-failed', PENDING: 'badge-starting', FAILED: 'badge-failed' };
    return `<span class="badge ${map[health] || 'badge-stopped'}">${health || 'PENDING'}</span>`;
  }

  function timeSince(date) {
    const s = Math.floor((Date.now() - date) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  }

  function relativeTime(date) {
    const diff = date - Date.now();
    if (diff < 0) return 'EXPIRED';
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m`;
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ── Init ──────────────────────────────────────────────────────────
  await loadAgents();
  connectRealtime();

  // Auto-refresh every 30s
  pollInterval = setInterval(async () => {
    const activeTab = document.querySelector('.infra-tab.active')?.id;
    if (activeTab === 'tab-agents') await loadAgents();
    else await loadInstances();
  }, 30_000);

})();
