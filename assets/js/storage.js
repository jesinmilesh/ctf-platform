/**
 * XPLOITX // CYBER BATTLEFIELD
 * Local Storage Wrapper (assets/js/storage.js)
 */

const Storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(`xploitx_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(`xploitx_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set failed', e);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(`xploitx_${key}`);
    } catch (e) {}
  },

  getToken() {
    return localStorage.getItem('xploitx_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('xploitx_token', token);
    } else {
      localStorage.removeItem('xploitx_token');
    }
  },

  clearToken() {
    localStorage.removeItem('xploitx_token');
  }
};

window.Storage = Storage;
