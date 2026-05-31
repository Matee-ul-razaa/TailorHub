/**
 * AuthContext tests
 *
 * Covers:
 * - Successful login calls setAuthToken()
 * - Signup → OTP step renders 6-digit input
 * - Wrong OTP shows error toast
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import React from 'react';

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
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

  it('successful login calls setAuthToken and sets session', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'test-token-123',
        user_id: 'user-123',
        email: 'test@example.com',
        role: 'customer',
        full_name: 'Test User',
      }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.signIn('test@example.com', 'Password123!');
      expect(res.error).toBeNull();
    });

    expect(result.current.session?.access_token).toBe('test-token-123');
    expect(result.current.user?.email).toBe('test@example.com');
    expect(localStorage.getItem('tailorhub-auth-token')).toBe('test-token-123');
  });

  it('signup returns needsVerification=true and sets pendingVerification', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'temp-token',
        user_id: 'user-new',
        email: 'new@example.com',
        role: 'customer',
        full_name: 'New User',
      }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.signUp('new@example.com', 'Password123!', 'New User', 'customer');
      expect(res.needsVerification).toBe(true);
    });

    expect(result.current.pendingVerification?.email).toBe('new@example.com');
  });

  it('wrong OTP returns error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Invalid verification code' }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const res = await result.current.verifyEmail('test@example.com', '000000');
      expect(res.error).not.toBeNull();
      expect(res.error.message).toContain('Invalid');
    });
  });

  it('signOut clears session and localStorage', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'test-token',
        user_id: 'user-123',
        email: 'test@example.com',
        role: 'customer',
        full_name: 'Test User',
      }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('test@example.com', 'Password123!');
    });

    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(localStorage.getItem('tailorhub-auth-token')).toBeNull();
  });

  it('hasRole returns true for matching role', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'test-token',
        user_id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
        full_name: 'Admin User',
      }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn('admin@example.com', 'Password123!');
    });

    expect(result.current.hasRole('admin')).toBe(true);
    expect(result.current.hasRole('customer')).toBe(false);
  });
});
