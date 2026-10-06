'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, SessionDTO } from '@/types/auth.types';
import { apiService } from '@/services/api.service';
import { clearSavedListQueries } from '@/hooks/listState';

/**
 * Who is signed in, kept so a reload can draw the right menus before the first
 * request. It is not the session: that is the `nms_session` cookie, which
 * scripts cannot read (IDN-084). A stale entry costs one request — the first
 * 401 clears it.
 */
const USER_KEY = 'nms_user';
/** Where the token lived before the cookie. Removed on sight. */
const LEGACY_TOKEN_KEY = 'nms_token';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Starts the session a finished sign-in handed back. The login page drives
   * the password and two-factor steps itself, and calls this only once the
   * person is through them — after the recovery codes, on a first sign-in.
   * The cookie is already set by then; this only records who it belongs to.
   */
  beginSession: (session: SessionDTO) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        const parsed: AuthUser = JSON.parse(stored);
        setUser(parsed);
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const beginSession = useCallback(({ user: authUser }: SessionDTO) => {
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    void apiService.logout();
    localStorage.removeItem(USER_KEY);
    clearSavedListQueries();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, beginSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
