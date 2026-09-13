/**
 * XPLOITX // CYBER BATTLEFIELD
 * Central API Client (assets/js/api.js)
 * Implements Section 8 of the Architectural Blueprint
 */

const API_BASE = window.XPLOITX_API_BASE || '/api';

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
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API request failed');
    }

    return data;
  } catch (err) {
    console.error(`[TACTICAL API ERROR ${endpoint}]:`, err);
    throw err;
  }
}

const api = {
  // Authentication
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getMe: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  // Challenges
  getChallenges: () => apiRequest('/challenges'),
  getChallenge: (id) => apiRequest(`/challenges/${id}`),
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

  // Squads & Teams
  getTeam: (id) => apiRequest(`/teams/${id}`),
  createTeam: (name) => apiRequest('/teams', { method: 'POST', body: JSON.stringify({ name }) }),
  joinTeam: (accessCode) => apiRequest('/teams/join', { method: 'POST', body: JSON.stringify({ accessCode }) }),

  // Scoreboard
  getScoreboard: () => apiRequest('/scoreboard'),
  getScoreboardHistory: () => apiRequest('/scoreboard/history'),

  // Announcements, Activity, Competitions
  getAnnouncements: () => apiRequest('/announcements'),
  getSubmissions: () => apiRequest('/submissions'),
  getCompetition: () => apiRequest('/competitions/current'),
  getStatus: () => apiRequest('/status'),

  // Administration C2 APIs
  admin: {
    getOverview: () => apiRequest('/admin/overview'),
    getChallenges: () => apiRequest('/admin/challenges'),
    createChallenge: (data) => apiRequest('/admin/challenges', { method: 'POST', body: JSON.stringify(data) }),
    updateChallenge: (id, data) => apiRequest(`/admin/challenges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteChallenge: (id) => apiRequest(`/admin/challenges/${id}`, { method: 'DELETE' }),
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

window.apiRequest = apiRequest;
window.api = api;
