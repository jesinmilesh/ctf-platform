/**
 * XPLOITX // CYBER BATTLEFIELD
 * Centralized API Client (frontend/assets/js/api.js)
 * Implements Section 8: Single Canonical API Contract (/api/v1)
 */

const API_BASE = window.XPLOITX_API_BASE || '/api/v1';

async function apiRequest(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  const token = localStorage.getItem('xploitx_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    if (!response.ok) {
      const errObj = data.error && typeof data.error === 'object' ? data.error : null;
      const errorMsg = (errObj && errObj.message) || data.message || (typeof data.error === 'string' ? data.error : null) || 
        (response.status === 401 ? 'Invalid callsign or passphrase.' :
         response.status === 404 ? `Endpoint not found (${endpoint}). Check server routing.` :
         response.status === 429 ? 'Rate limit exceeded. Stand by.' :
         response.status >= 500 ? `Server error (${response.status}). Check server logs.` :
         `Request failed with status ${response.status}`);
      
      const err = new Error(errorMsg);
      err.status = response.status;
      err.code = (errObj && errObj.code) || 'API_ERROR';
      err.requestId = data.requestId;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`[TACTICAL API ERROR ${endpoint}]:`, err);
    if (err.name === 'TypeError' && err.message && err.message.toLowerCase().includes('fetch')) {
      throw new Error('Unable to reach CTF mission server. Check network connection or API status.');
    }
    throw err;
  }
}

// Canonical Namespaced API Client
const api = {
  // 1. Authentication
  auth: {
    login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    adminLogin: (credentials) => apiRequest('/admin/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: (userData) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    me: () => apiRequest('/auth/me'),
    getMe: () => apiRequest('/auth/me'),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    refresh: () => apiRequest('/auth/refresh', { method: 'POST' }),
    forgotPassword: (email) => apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (payload) => apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) })
  },

  // 2. Challenges
  challenges: {
    list: () => apiRequest('/challenges'),
    get: (id) => apiRequest(`/challenges/${encodeURIComponent(id)}`),
    getByPublicRoute: (publicRouteId) => apiRequest(`/challenges/public/${encodeURIComponent(publicRouteId)}`),
    submitFlag: (challengeId, flag) => apiRequest('/submissions', {
      method: 'POST',
      body: JSON.stringify({ challengeId, flag })
    }),
    unlockHint: (challengeId, hintId) => apiRequest(`/challenges/${challengeId}/hints/${hintId}/reveal`, {
      method: 'POST'
    }),
    deployInstance: (challengeId) => apiRequest(`/challenges/${challengeId}/instance`, {
      method: 'POST'
    }),
    terminateInstance: (challengeId) => apiRequest(`/challenges/${challengeId}/instance`, {
      method: 'DELETE'
    }),
    getFiles: (challengeId) => apiRequest(`/challenges/${challengeId}/files`),
    getFileDownloadUrl: (challengeId, fileId) => `${API_BASE}/challenges/${challengeId}/files/${fileId}/download`
  },

  // 3. Submissions
  submissions: {
    submit: (challengeId, flag) => apiRequest('/submissions', {
      method: 'POST',
      body: JSON.stringify({ challengeId, flag })
    }),
    list: () => apiRequest('/submissions')
  },

  // 4. Squads & Teams
  teams: {
    list: () => apiRequest('/teams'),
    get: (id) => apiRequest(`/teams/${id}`),
    create: (name) => apiRequest('/teams', { method: 'POST', body: JSON.stringify({ name }) }),
    join: (accessCode) => apiRequest('/teams/join', { method: 'POST', body: JSON.stringify({ accessCode }) }),
    leave: () => apiRequest('/teams/leave', { method: 'POST' })
  },

  // 5. Scoreboard & Telemetry
  scoreboard: {
    get: () => apiRequest('/scoreboard'),
    getHistory: () => apiRequest('/scoreboard/history')
  },

  // 6. Announcements & Notifications
  announcements: {
    list: () => apiRequest('/announcements')
  },
  notifications: {
    list: () => apiRequest('/notifications')
  },

  // 7. Dynamic Instances (Sections 10, 11, 12)
  instances: {
    create: (challengeId) => apiRequest('/instances', {
      method: 'POST',
      body: JSON.stringify({ challengeId })
    }),
    spawn: (challengeId) => apiRequest('/instances', {
      method: 'POST',
      body: JSON.stringify({ challengeId })
    }),
    stop: (instanceId) => apiRequest(`/instances/${instanceId}`, {
      method: 'DELETE'
    }),
    terminate: (instanceId) => apiRequest(`/instances/${instanceId}`, {
      method: 'DELETE'
    }),
    status: (instanceId) => apiRequest(`/instances/${instanceId}`),
    list: () => apiRequest('/instances')
  },

  // 8. Health & System
  health: {
    get: () => apiRequest('/health'),
    ready: () => apiRequest('/health/ready'),
    live: () => apiRequest('/health/live')
  },

  // 9. Administration C2 APIs
  admin: {
    login: (credentials) => apiRequest('/admin/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    logout: () => apiRequest('/admin/auth/logout', { method: 'POST' }),
    me: () => apiRequest('/admin/me'),
    getOverview: () => apiRequest('/admin/overview'),
    getChallenges: () => apiRequest('/admin/challenges'),
    getChallenge: (id) => apiRequest(`/admin/challenges/${encodeURIComponent(id)}`),
    createChallenge: (data) => apiRequest('/admin/challenges', { method: 'POST', body: JSON.stringify(data) }),
    updateChallenge: (id, data) => apiRequest(`/admin/challenges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChallenge: (id) => apiRequest(`/admin/challenges/${id}`, { method: 'DELETE' }),
    getChallengeFiles: (id) => apiRequest(`/admin/challenges/${id}/files`),
    uploadChallengeFiles: async (id, formData) => {
      const token = localStorage.getItem('xploitx_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res;
      try {
        res = await fetch(`${API_BASE}/admin/challenges/${id}/files`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData
        });
      } catch (networkErr) {
        throw new Error('Network connection failure. Unable to reach mission upload service.');
      }

      // Safe response body decoding (never throw "Unexpected token 'R'")
      let data = null;
      let rawText = '';
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          data = await res.json();
        } catch (jsonErr) {
          data = null;
        }
      } else {
        try {
          rawText = await res.text();
        } catch (_) {}
      }

      if (!res.ok) {
        // Map HTTP status codes to tactical, actionable messages
        let userMessage = '';

        if (res.status === 413) {
          userMessage = 'FILE TOO LARGE: The uploaded file exceeds the allowed transfer limit (4.5 MB on serverless, 50 MB on dedicated).';
        } else if (res.status === 415) {
          userMessage = 'FILE TYPE NOT ALLOWED: Executable files (.exe, .dll, scripts) are prohibited.';
        } else if (res.status === 401) {
          userMessage = 'ADMIN LOGIN REQUIRED: Your session has expired. Please re-authenticate into C2 Control Room.';
        } else if (res.status === 403) {
          userMessage = 'ADMIN ACCESS REQUIRED: Insufficient clearance to upload challenge files.';
        } else if (res.status === 404) {
          userMessage = 'CHALLENGE NOT FOUND: The target mission could not be resolved.';
        } else if (res.status === 429) {
          userMessage = 'UPLOAD RATE LIMIT EXCEEDED: Stand by before transmitting additional assets.';
        } else if (res.status >= 500) {
          userMessage = 'STORAGE SERVICE UNAVAILABLE: Mission storage service temporarily unreachable. Please retry shortly.';
        }

        // If server provided structured JSON error, prioritize that message
        const serverError = data && (
          (data.error && typeof data.error === 'object' ? data.error.message : data.error) ||
          data.message
        );

        const finalMessage = serverError || userMessage || (rawText && rawText.length < 120 ? rawText.trim() : `Upload failed (HTTP ${res.status}).`);
        const err = new Error(finalMessage);
        err.status = res.status;
        err.code = (data && (data.code || (data.error && data.error.code))) || `HTTP_${res.status}`;
        throw err;
      }

      // If success but not JSON (rare proxy edge case)
      if (!data) {
        return { success: true, message: 'Asset upload successful.' };
      }

      return data;
    },
    deleteChallengeFile: (challengeId, fileId) => apiRequest(`/admin/challenges/${challengeId}/files/${fileId}`, { method: 'DELETE' }),
    testFlag: (data) => apiRequest('/admin/challenges/test-flag', { method: 'POST', body: JSON.stringify(data) }),
    getCategories: () => apiRequest('/admin/categories'),
    getChallengeValidation: (id) => apiRequest(`/admin/challenges/${id}/validate`),
    getUsers: () => apiRequest('/admin/users'),
    toggleUserBan: (id) => apiRequest(`/admin/users/${id}/ban`, { method: 'POST' }),
    getTeams: () => apiRequest('/admin/teams'),
    getSubmissions: () => apiRequest('/admin/submissions'),
    getAnalytics: () => apiRequest('/admin/analytics'),
    getInstances: () => apiRequest('/admin/instances'),
    getAuditLogs: (params = {}) => {
      const cleanParams = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '' && v !== 'all') {
          cleanParams[k] = v;
        }
      }
      const qs = new URLSearchParams(cleanParams).toString();
      return apiRequest(`/admin/audit-logs${qs ? '?' + qs : ''}`);
    },
    getAuditStats: () => apiRequest('/admin/audit-logs/stats'),
    getAuditLogEntry: (id) => apiRequest(`/admin/audit-logs/${id}`),
    exportAuditLogs: (params = {}) => {
      const cleanParams = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '' && v !== 'all') {
          cleanParams[k] = v;
        }
      }
      const qs = new URLSearchParams(cleanParams).toString();
      const token = localStorage.getItem('xploitx_token');
      const url = `${API_BASE}/admin/audit-logs/export${qs ? '?' + qs : ''}`;
      return fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    },
    updateSettings: (settings) => apiRequest('/admin/settings', { method: 'POST', body: JSON.stringify(settings) }),
    dispatchAnnouncement: (ann) => apiRequest('/admin/announcements', { method: 'POST', body: JSON.stringify(ann) })
  }
};

// Flat aliases for 100% backward compatibility with existing UI page scripts
api.login = api.auth.login;
api.adminLogin = api.auth.adminLogin;
api.register = api.auth.register;
api.getMe = api.auth.getMe;
api.logout = api.auth.logout;
api.getChallenges = api.challenges.list;
api.getChallenge = api.challenges.get;
api.getChallengeByPublicRoute = api.challenges.getByPublicRoute;
api.submitFlag = api.challenges.submitFlag;
api.unlockHint = api.challenges.unlockHint;
api.deployInstance = api.challenges.deployInstance;
api.terminateInstance = api.challenges.terminateInstance;
api.getTeam = api.teams.get;
api.createTeam = api.teams.create;
api.joinTeam = api.teams.join;
api.getScoreboard = api.scoreboard.get;
api.getScoreboardHistory = api.scoreboard.getHistory;
api.getAnnouncements = api.announcements.list;
api.getSubmissions = api.submissions.list;
api.getCompetition = () => apiRequest('/competitions/current');
api.getStatus = () => apiRequest('/status');

window.apiRequest = apiRequest;
window.api = api;
