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
    get: (id) => apiRequest(`/challenges/${id}`),
    submitFlag: (challengeId, flag) => apiRequest(`/challenges/${challengeId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ flag })
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
    submit: (challengeId, flag) => apiRequest(`/challenges/${challengeId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ flag })
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
    getOverview: () => apiRequest('/admin/overview'),
    getChallenges: () => apiRequest('/admin/challenges'),
    createChallenge: (data) => apiRequest('/admin/challenges', { method: 'POST', body: JSON.stringify(data) }),
    updateChallenge: (id, data) => apiRequest(`/admin/challenges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChallenge: (id) => apiRequest(`/admin/challenges/${id}`, { method: 'DELETE' }),
    getChallengeFiles: (id) => apiRequest(`/admin/challenges/${id}/files`),
    uploadChallengeFiles: async (id, formData) => {
      const token = localStorage.getItem('xploitx_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/admin/challenges/${id}/files`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Asset upload failed');
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
    getAuditLogs: () => apiRequest('/admin/audit'),
    updateSettings: (settings) => apiRequest('/admin/settings', { method: 'POST', body: JSON.stringify(settings) }),
    dispatchAnnouncement: (ann) => apiRequest('/admin/announcements', { method: 'POST', body: JSON.stringify(ann) })
  }
};

// Flat aliases for 100% backward compatibility with existing UI page scripts
api.login = api.auth.login;
api.register = api.auth.register;
api.getMe = api.auth.getMe;
api.logout = api.auth.logout;
api.getChallenges = api.challenges.list;
api.getChallenge = api.challenges.get;
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
