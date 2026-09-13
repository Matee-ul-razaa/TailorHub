/**
 * apiRequest tests
 *
 * Covers:
 * - Bearer header auto-injection from localStorage
 * - skipAuth: true omits Bearer header
 * - Explicit token option overrides localStorage
 * - 204 returns null
 * - Pydantic array errors join into one message
 * - String detail field is used directly
 * - Network failure throws "Unable to reach the server"
 * - 401: clears localStorage, sets window.location.href = '/login'
 * - 401 on /login page: no redirect (loop guard)
 * - 401 with skipAuth: true: no redirect
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, getApiBaseUrl, clearAuthToken, setAuthToken } from './api';

describe('apiRequest', () => {
  let originalFetch;
  let originalLocation;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '', pathname: '/' };
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location = originalLocation;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls fetch with configured base URL + path', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await apiRequest('/api/test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.any(Object)
    );
  });

  it('auto-attaches Bearer header when token is in localStorage', async () => {
    setAuthToken('my-token-123');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await apiRequest('/api/test');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer my-token-123');
  });

  it('skipAuth: true omits the Bearer header', async () => {
    setAuthToken('my-token-123');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await apiRequest('/api/test', { skipAuth: true });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('explicit token option overrides localStorage', async () => {
    setAuthToken('local-token');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    await apiRequest('/api/test', { token: 'override-token' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer override-token');
  });

  it('204 returns null', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });
    const result = await apiRequest('/api/test');
    expect(result).toBeNull();
  });

  it('Pydantic array errors join into one message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: [{ msg: 'Field required' }, { msg: 'Invalid format' }] }),
    });
    await expect(apiRequest('/api/test')).rejects.toThrow('Field required; Invalid format');
  });

  it('string detail field is used directly', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Something went wrong' }),
    });
    await expect(apiRequest('/api/test')).rejects.toThrow('Something went wrong');
  });

  it('network failure throws "Unable to reach the server"', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(apiRequest('/api/test')).rejects.toThrow('Unable to reach the server');
  });

  it('401 clears localStorage and redirects to /login', async () => {
    setAuthToken('bad-token');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });
    try {
      await apiRequest('/api/test');
    } catch (e) {
      // Expected to throw
    }
    expect(localStorage.getItem('tailorhub-auth-token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('401 on /login page: no redirect loop', async () => {
    window.location.pathname = '/login';
    setAuthToken('bad-token');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });
    try {
      await apiRequest('/api/test');
    } catch (e) {
      // Expected
    }
    expect(window.location.href).toBe(''); // Should not change
  });

  it('401 with skipAuth: true: no redirect', async () => {
    window.location.pathname = '/';
    setAuthToken('bad-token');
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Unauthorized' }),
    });
    try {
      await apiRequest('/api/test', { skipAuth: true });
    } catch (e) {
      // Expected
    }
    expect(window.location.href).toBe(''); // Should not change
  });
});

describe('getApiBaseUrl', () => {
  it('returns the configured API base URL', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toContain('http');
  });
});
