/**
 * api.js — Centralised HTTP client for TailorHub
 *
 * Features:
 *  - Automatic Bearer token injection from localStorage
 *  - Global 401 handler: clears session and redirects to /login
 *  - Structured error messages from FastAPI `detail` field
 *  - 204 No Content support
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'tailorhub-auth-token';
const SESSION_KEY = 'tailorhub-auth-session';

export const getApiBaseUrl = () => API_BASE_URL;

export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

export const setAuthToken = (token) => {
  if (!token) return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
};

/**
 * Handle a global 401 — session expired or token invalid.
 * Clears local state and redirects to login.
 */
const handleUnauthorized = () => {
  clearAuthToken();
  // Avoid redirect loop if already on /login
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
};

/**
 * apiRequest — make an authenticated or anonymous API call.
 *
 * @param {string} path      - API path, e.g. '/api/auth/me'
 * @param {object} options   - { method, body, token, skipAuth, signal }
 * @returns {Promise<any>}   - Parsed JSON response
 * @throws {Error}           - With user-friendly message from API or network
 */
export const apiRequest = async (path, options = {}) => {
  const { method = 'GET', body, token, skipAuth = false, signal } = options;
  const headers = { 'Content-Type': 'application/json' };

  const authToken = token || getAuthToken();
  if (!skipAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    // Network failure (server down, CORS, etc.)
    throw new Error('Unable to reach the server. Please check your connection.');
  }

  // Global 401 handler — session expired
  if (response.status === 401 && !skipAuth) {
    handleUnauthorized();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      // FastAPI returns errors as { detail: string | list }
      if (typeof payload.detail === 'string') {
        message = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        // Pydantic validation errors → join field messages
        message = payload.detail.map((e) => e.msg || JSON.stringify(e)).join('; ');
      } else {
        message = payload.message || message;
      }
    } catch (_parseErr) {
      message = `${response.status} ${response.statusText}`;
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
};
