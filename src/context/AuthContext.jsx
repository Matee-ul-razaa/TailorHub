import React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from '@/lib/api';

const SESSION_KEY = 'tailorhub-auth-session';
const AuthContext = createContext(undefined);

const setAuthState = (payload, setUser, setSession, setRoles, setFullName) => {
  const nextSession = { access_token: payload.access_token, user_id: payload.user_id };
  setSession(nextSession);
  setUser({ id: payload.user_id, email: payload.email });
  setRoles([payload.role]);
  setFullName(payload.full_name || null);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...nextSession, role: payload.role, email: payload.email, full_name: payload.full_name }),
  );
  setAuthToken(payload.access_token);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [fullName, setFullName] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null); // { email }

  useEffect(() => {
    const bootstrap = async () => {
      const token = getAuthToken();
      const sessionData = localStorage.getItem(SESSION_KEY);
      
      if (!token && !sessionData) {
        setLoading(false);
        return;
      }

      try {
        const me = await apiRequest('/api/auth/me', { token });
        setSession({ access_token: token, user_id: me.id });
        setUser({ id: me.id, email: me.email });
        setRoles([me.role]);
        setFullName(me.full_name || null);
      } catch (_error) {
        // Session is invalid – clean up
        localStorage.removeItem(SESSION_KEY);
        clearAuthToken();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const signUp = async (email, password, fullNameInput, role) => {
    try {
      const payload = await apiRequest('/api/auth/register', {
        method: 'POST',
        skipAuth: true,
        body: { email, password, full_name: fullNameInput, role },
      });
      // Do NOT log the user in yet — they must verify email first.
      // Stash the token in the pending-verification state so we can complete login after OTP.
      setPendingVerification({
        email,
        pendingToken: payload.access_token,
        pendingUserId: payload.user_id,
        pendingFullName: payload.full_name,
        pendingRole: payload.role,
      });
      return { error: null, data: payload, needsVerification: true };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const signIn = async (email, password) => {
    try {
      const payload = await apiRequest('/api/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: { email, password },
      });
      setAuthState(payload, setUser, setSession, setRoles, setFullName);
      setPendingVerification(null);
      return { error: null, data: payload };
    } catch (error) {
      // Check if the error is about email verification
      if (error.message && error.message.includes('not verified')) {
        setPendingVerification({ email });
        return { error: { message: error.message }, needsVerification: true };
      }
      return { error: { message: error.message } };
    }
  };

  const verifyEmail = async (email, code) => {
    try {
      const result = await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        skipAuth: true,
        body: { email, code },
      });
      // If we have a pending token from signUp, now activate the session
      const pv = pendingVerification;
      if (pv?.pendingToken) {
        setAuthToken(pv.pendingToken);
        const nextSession = { access_token: pv.pendingToken, user_id: pv.pendingUserId };
        setSession(nextSession);
        setUser({ id: pv.pendingUserId, email });
        setRoles([pv.pendingRole]);
        setFullName(pv.pendingFullName || null);
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ ...nextSession, role: pv.pendingRole, email, full_name: pv.pendingFullName }),
        );
      }
      setPendingVerification(null);
      return { error: null, data: result, activatedRole: pv?.pendingRole || null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const resendOTP = async (email) => {
    try {
      const result = await apiRequest('/api/auth/resend-otp', {
        method: 'POST',
        skipAuth: true,
        body: { email },
      });
      return { error: null, data: result };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const result = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        skipAuth: true,
        body: { email },
      });
      return { error: null, data: result };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const resetPassword = async (email, code, newPassword) => {
    try {
      const result = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        skipAuth: true,
        body: { email, code, new_password: newPassword },
      });
      return { error: null, data: result };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const result = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      });
      return { error: null, data: result };
    } catch (error) {
      return { error: { message: error.message } };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    clearAuthToken();
    setUser(null);
    setSession(null);
    setRoles([]);
    setFullName(null);
    setPendingVerification(null);
  };

  const hasRole = useCallback((role) => roles.includes(role), [roles]);
  const value = useMemo(
    () => ({ user, session, loading, roles, fullName, pendingVerification, signUp, signIn, signOut, hasRole, verifyEmail, resendOTP, forgotPassword, resetPassword, changePassword }),
    [user, session, loading, roles, fullName, pendingVerification, hasRole, forgotPassword, resetPassword, changePassword],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
