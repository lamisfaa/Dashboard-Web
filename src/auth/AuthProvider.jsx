import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, parseApiError } from '../api';
import { AuthContext } from './AuthContext';

const SESSION_KEY = 'projex-auth-session';
const legacyStorage = typeof window !== 'undefined' ? window.localStorage : null;
const sessionStorageApi = typeof window !== 'undefined' ? window.sessionStorage : null;

const readJson = (key, fallback) => {
  try {
    const raw = sessionStorageApi?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const toClientUser = (user) => ({
  id: user.id,
  fullName: user.full_name,
  email: user.email,
  role: user.role
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readJson(SESSION_KEY, null));
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  const persistSession = useCallback((nextSession) => {
    sessionStorageApi?.setItem(SESSION_KEY, JSON.stringify(nextSession));
    legacyStorage?.removeItem(SESSION_KEY);
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorageApi?.removeItem(SESSION_KEY);
    legacyStorage?.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const googleToken = hashParams.get('google_token');
    const googleError = hashParams.get('google_error');

    const cleanGoogleHash = () => {
      if (googleToken || googleError) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    };

    const verifySession = async () => {
      if (googleError) {
        setAuthError(googleError);
        cleanGoogleHash();
      }

      const tokenToVerify = googleToken || session?.accessToken;

      if (!tokenToVerify) {
        setAuthReady(true);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${tokenToVerify}`
          }
        });

        if (!response.ok) {
          throw new Error('Session expired.');
        }

        const verifiedUser = await response.json();
        persistSession({
          accessToken: tokenToVerify,
          user: toClientUser(verifiedUser)
        });
        setAuthError('');
      } catch {
        clearSession();
        if (googleToken) {
          setAuthError('Google sign-in failed. Please try again.');
        }
      } finally {
        cleanGoogleHash();
        setAuthReady(true);
      }
    };

    verifySession();
  }, [clearSession, persistSession, session?.accessToken]);

  const signup = useCallback(async ({ fullName, email, password, turnstileToken }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: normalizeEmail(email),
        password,
        turnstile_token: turnstileToken
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Could not create account.'));
    }

    const data = await response.json();
    const nextSession = {
      accessToken: data.access_token,
      user: toClientUser(data.user)
    };
    persistSession(nextSession);
    return nextSession.user;
  }, [persistSession]);

  const login = useCallback(async ({ email, password, turnstileToken }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        password,
        turnstile_token: turnstileToken
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Invalid email or password.'));
    }

    const data = await response.json();
    const nextSession = {
      accessToken: data.access_token,
      user: toClientUser(data.user)
    };
    persistSession(nextSession);
    return nextSession.user;
  }, [persistSession]);

  const requestPasswordReset = useCallback(async ({ email, turnstileToken }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        turnstile_token: turnstileToken
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Could not send password reset OTP.'));
    }

    return response.json();
  }, []);

  const verifyPasswordResetOtp = useCallback(async ({ email, otp }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        otp: otp.trim()
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Wrong OTP. Please try again.'));
    }

    return response.json();
  }, []);

  const confirmPasswordReset = useCallback(async ({ email, otp, password }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        otp: otp.trim(),
        password
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Could not reset password.'));
    }

    return response.json();
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const continueWithGoogle = useCallback(() => {
    window.location.assign(`${API_BASE_URL}/api/auth/google/start`);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError('');
  }, []);

  const authFetch = useCallback((url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (session?.accessToken) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    return fetch(url, {
      ...options,
      headers
    });
  }, [session?.accessToken]);

  const updateProfile = useCallback(async ({ fullName }) => {
    const response = await authFetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim()
      })
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, 'Could not update profile.'));
    }

    const updatedUser = toClientUser(await response.json());
    setSession((currentSession) => {
      if (!currentSession) return currentSession;
      const nextSession = {
        ...currentSession,
        user: updatedUser
      };
      sessionStorageApi?.setItem(SESSION_KEY, JSON.stringify(nextSession));
      legacyStorage?.removeItem(SESSION_KEY);
      return nextSession;
    });
    return updatedUser;
  }, [authFetch]);

  const value = useMemo(() => ({
    user: session?.user || null,
    accessToken: session?.accessToken || null,
    isAuthenticated: Boolean(session?.user && session?.accessToken),
    authReady,
    authFetch,
    authError,
    clearAuthError,
    confirmPasswordReset,
    continueWithGoogle,
    login,
    requestPasswordReset,
    updateProfile,
    verifyPasswordResetOtp,
    signup,
    logout
  }), [
    authError,
    authFetch,
    authReady,
    clearAuthError,
    confirmPasswordReset,
    continueWithGoogle,
    login,
    logout,
    requestPasswordReset,
    verifyPasswordResetOtp,
    updateProfile,
    session,
    signup
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
