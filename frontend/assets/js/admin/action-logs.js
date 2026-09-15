/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Action Log & Audit Trail Controller (frontend/assets/js/admin/action-logs.js)
 * Implements Sections 1 - 50 of Master Audit Specification
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (window.Sidebar) {
    Sidebar.render('admin-sidebar-container', 'action-logs');
  }

  if (window.authManager) {
    await window.authManager.requireAdmin('/admin/login.html');
  }

  // DOM Elements
  const tableBody = document.getElementById('auditTableBody');
  const paginationSummary = document.getElementById('paginationSummary');
  const pageIndicator = document.getElementById('pageIndicator');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');
  const btnApplyFilters = document.getElementById('btnApplyFilters');
  const btnResetFilters = document.getElementById('btnResetFilters');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnRefresh = document.getElementById('btnRefresh');

  // Stats Counters
  const statSecurityEvents = document.getElementById('statSecurityEvents');
  const statFailedLogins = document.getElementById('statFailedLogins');
  const statAuthDenials = document.getElementById('statAuthDenials');
  const statInstanceFailures = document.getElementById('statInstanceFailures');
  const statAdminActions = document.getElementById('statAdminActions');
  const statPlayerActions = document.getElementById('statPlayerActions');

  // Filter Inputs
  const filterSearch = document.getElementById('filterSearch');
  const filterActor = document.getElementById('filterActor');
  const filterCategory = document.getElementById('filterCategory');
  const filterSeverity = document.getElementById('filterSeverity');
  const filterResult = document.getElementById('filterResult');
  const filterTimeRange = document.getElementById('filterTimeRange');

  // Modal Elements
  const modal = document.getElementById('auditDetailModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const modalEventId = document.getElementById('modalEventId');
  const modalTimestamp = document.getElementById('modalTimestamp');
  const modalActor = document.getElementById('modalActor');
  const modalRole = document.getElementById('modalRole');
  const modalAction = document.getElementById('modalAction');
  const modalCategory = document.getElementById('modalCategory');
  const modalResult = document.getElementById('modalResult');
  const modalSeverity = document.getElementById('modalSeverity');
  const modalResource = document.getElementById('modalResource');
  const modalRequestId = document.getElementById('modalRequestId');
  const modalIp = document.getElementById('modalIp');
  const modalUserAgent = document.getElementById('modalUserAgent');
  const modalDescription = document.getElementById('modalDescription');
  const modalMetadata = document.getElementById('modalMetadata');

  // State
  let currentPage = 1;
  const pageLimit = 25;
  let totalPages = 1;
  let currentLogs = [];

  // Parse URL Parameters (for deep linking e.g. ?challengeId=... or ?userId=...)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('search')) filterSearch.value = urlParams.get('search');
  if (urlParams.get('challengeId')) filterSearch.value = urlParams.get('challengeId');
  if (urlParams.get('userId')) filterSearch.value = urlParams.get('userId');
  if (urlParams.get('teamId')) filterSearch.value = urlParams.get('teamId');
  if (urlParams.get('instanceId')) filterSearch.value = urlParams.get('instanceId');
  if (urlParams.get('category')) filterCategory.value = urlParams.get('category').toUpperCase();
  if (urlParams.get('severity')) filterSeverity.value = urlParams.get('severity').toUpperCase();
  if (urlParams.get('actor')) filterActor.value = urlParams.get('actor').toUpperCase();

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSeverityBadge(sev) {
    const s = String(sev || 'INFO').toUpperCase();
    let cls = 'badge-sev-info';
    if (s === 'NOTICE') cls = 'badge-sev-notice';
    if (s === 'WARNING') cls = 'badge-sev-warning';
    if (s === 'HIGH') cls = 'badge-sev-high';
    if (s === 'CRITICAL') cls = 'badge-sev-critical';
    return `<span class="badge-severity ${cls}">${s}</span>`;
  }

  function getResultBadge(res) {
    const r = String(res || 'SUCCESS').toUpperCase();
    let cls = 'badge-result-success';
    if (r === 'FAILURE') cls = 'badge-result-failure';
    if (r === 'DENIED') cls = 'badge-result-denied';
    return `<span class="badge-result ${cls}">${r}</span>`;
  }

  function getFilterQuery() {
    const params = {
      page: currentPage,
      limit: pageLimit
    };

    if (filterSearch.value.trim()) params.search = filterSearch.value.trim();
    if (filterActor.value !== 'all') params.actorType = filterActor.value;
    if (filterCategory.value !== 'all') params.category = filterCategory.value;
    if (filterSeverity.value !== 'all') params.severity = filterSeverity.value;
    if (filterResult.value !== 'all') params.result = filterResult.value;

    const timeRange = filterTimeRange.value;
    const now = new Date();
    if (timeRange === '15m') {
      params.startDate = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    } else if (timeRange === '1h') {
      params.startDate = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    } else if (timeRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      params.startDate = startOfDay.toISOString();
    } else if (timeRange === 'yesterday') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      params.startDate = yStart.toISOString();
      params.endDate = yEnd.toISOString();
    } else if (timeRange === '7d') {
      params.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === '30d') {
      params.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Preserve direct query params if present
    if (urlParams.get('challengeId') && !params.challengeId) params.challengeId = urlParams.get('challengeId');
    if (urlParams.get('userId') && !params.userId) params.userId = urlParams.get('userId');
    if (urlParams.get('teamId') && !params.teamId) params.teamId = urlParams.get('teamId');
    if (urlParams.get('instanceId') && !params.instanceId) params.instanceId = urlParams.get('instanceId');

    return params;
  }

  async function loadStats() {
    try {
      const res = await window.api.admin.getAuditStats();
      if (res && res.stats) {
        statSecurityEvents.textContent = res.stats.securityEventsToday ?? 0;
        statFailedLogins.textContent = res.stats.failedLogins ?? 0;
        statAuthDenials.textContent = res.stats.authDenials ?? 0;
        statInstanceFailures.textContent = res.stats.instanceFailures ?? 0;
        statAdminActions.textContent = res.stats.adminActions ?? 0;
        statPlayerActions.textContent = res.stats.playerActions ?? 0;
      }
    } catch (err) {
      console.warn('[AUDIT LOG] Stats load warning:', err.message);
    }
  }

  async function loadLogs() {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:36px; color:var(--text-secondary); font-family:var(--font-mono);">
          QUERYING SECURE AUDIT ARCHIVE...
        </td>
      </tr>
    `;

    try {
      const query = getFilterQuery();
      const res = await window.api.admin.getAuditLogs(query);
      currentLogs = res.logs || [];
      const total = res.total ?? currentLogs.length;
      totalPages = res.totalPages || Math.ceil(total / pageLimit) || 1;

      paginationSummary.textContent = `Showing ${currentLogs.length} of ${total} authoritative events`;
      pageIndicator.textContent = `PAGE ${currentPage} / ${totalPages}`;
      btnPrevPage.disabled = currentPage <= 1;
      btnNextPage.disabled = currentPage >= totalPages;

      if (currentLogs.length === 0) {
        const isSecurityOnly = filterCategory.value === 'SECURITY';
        const emptyMsg = isSecurityOnly ? 'NO SECURITY EVENTS' : 'NO ACTIVITY RECORDED';
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding:36px; color:var(--text-secondary); font-family:var(--font-mono); letter-spacing:0.05em;">
              ${emptyMsg}
            </td>
          </tr>
        `;
        return;
      }

      tableBody.innerHTML = currentLogs.map((log, idx) => {
        const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : '--';
        const actorName = log.actor?.callsign || log.actor?.username || log.actor?.type || 'SYSTEM';
        const role = log.actor?.role || log.actor?.type || 'USER';
        const resourceType = log.resource?.type || 'SYSTEM';
        const resourceId = log.resource?.id || '--';
        const shortResourceId = resourceId.length > 18 ? resourceId.slice(0, 16) + '...' : resourceId;

        return `
          <tr data-index="${idx}" style="cursor:pointer;">
            <td style="color:var(--text-secondary); white-space:nowrap;" title="${escapeHtml(log.timestamp)}">${escapeHtml(dateStr)}</td>
            <td>
              <span style="font-weight:700; color:#fff;">${escapeHtml(actorName)}</span>
              <span style="display:block; font-size:10px; color:var(--text-muted);">${escapeHtml(role)}</span>
            </td>
            <td>
              <span style="font-weight:700; color:var(--warning);">${escapeHtml(log.action)}</span>
              <span style="display:block; font-size:10px; color:var(--text-secondary);">${escapeHtml(log.category || '')}</span>
            </td>
            <td>
              <span style="color:var(--accent); font-weight:600;">${escapeHtml(resourceType)}</span>: 
              <span style="color:var(--text-muted); font-size:11px;" title="${escapeHtml(resourceId)}">${escapeHtml(shortResourceId)}</span>
            </td>
            <td>${getResultBadge(log.result)}</td>
            <td>${getSeverityBadge(log.severity)}</td>
            <td style="text-align:center;">
              <button class="btn btn-xs btn-outline btn-inspect" data-index="${idx}" style="padding:2px 8px; font-size:10px;">VIEW</button>
            </td>
          </tr>
        `;
      }).join('');

      // Add Row Click Listeners
      tableBody.querySelectorAll('tr[data-index]').forEach(row => {
        row.addEventListener('click', (e) => {
          const idx = parseInt(row.getAttribute('data-index'), 10);
          openModal(currentLogs[idx]);
        });
      });

    } catch (err) {
      console.error('[AUDIT LOG] Load failed:', err);
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:36px; color:var(--danger); font-family:var(--font-mono);">
            AUDIT QUERY ENCOUNTERED AN ERROR: ${escapeHtml(err.message)}
          </td>
        </tr>
      `;
    }
  }

  function openModal(event) {
    if (!event) return;

    modalEventId.textContent = event.eventId || event.id || '--';
    modalTimestamp.textContent = event.timestamp ? `${new Date(event.timestamp).toUTCString()} (${event.timestamp})` : '--';
    
    const actor = event.actor || {};
    const actorStr = `${actor.callsign || actor.username || actor.type || 'SYSTEM'} ${actor.userId ? `(ID: ${actor.userId})` : ''} ${actor.teamId ? `[Team: ${actor.teamId}]` : ''}`;
    modalActor.textContent = actorStr;
    modalRole.textContent = `${actor.role || 'NONE'} / ${actor.type || 'USER'}`;

    modalAction.textContent = event.action || '--';
    modalCategory.textContent = event.category || '--';
    modalResult.innerHTML = getResultBadge(event.result);
    modalSeverity.innerHTML = getSeverityBadge(event.severity);

    const resource = event.resource || {};
    modalResource.textContent = `${resource.type || 'N/A'}: ${resource.id || 'N/A'}`;

    modalRequestId.textContent = event.request?.requestId || '--';
    modalIp.textContent = event.network?.ip || event.ip_address || '127.0.0.1';
    modalUserAgent.textContent = event.network?.userAgent || 'N/A';
    modalDescription.textContent = event.description || '--';

    try {
      modalMetadata.textContent = JSON.stringify(event.metadata || {}, null, 2);
    } catch {
      modalMetadata.textContent = '{}';
    }

    modal.style.display = 'flex';
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  btnModalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
  });

  // Filter Buttons
  btnApplyFilters.addEventListener('click', () => {
    currentPage = 1;
    loadLogs();
  });

  btnResetFilters.addEventListener('click', () => {
    filterSearch.value = '';
    filterActor.value = 'all';
    filterCategory.value = 'all';
    filterSeverity.value = 'all';
    filterResult.value = 'all';
    filterTimeRange.value = 'all';
    currentPage = 1;
    loadLogs();
  });

  btnRefresh.addEventListener('click', () => {
    loadStats();
    loadLogs();
  });

  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadLogs();
    }
  });

  btnNextPage.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadLogs();
    }
  });

  // Export handlers
  async function triggerExport(format) {
    try {
      if (window.toast) window.toast.info(`Preparing ${format.toUpperCase()} export...`);
      const query = getFilterQuery();
      query.format = format;
      const res = await window.api.admin.exportAuditLogs(query);
      if (!res.ok) throw new Error('Export failed with status ' + res.status);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `xploitx_audit_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      if (window.toast) window.toast.success(`Audit log exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export failed:', err);
      if (window.toast) window.toast.error('Export error: ' + err.message);
    }
  }

  btnExportCsv.addEventListener('click', () => triggerExport('csv'));
  btnExportJson.addEventListener('click', () => triggerExport('json'));

  // Initial Load
  await loadStats();
  await loadLogs();

  // Periodic Refresh every 15 seconds
  setInterval(() => {
    loadStats();
  }, 15000);
});
