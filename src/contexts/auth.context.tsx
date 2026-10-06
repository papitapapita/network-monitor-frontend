'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
/**
 * Data a page keeps across reloads that belongs to whoever was signed in —
 * the last network scan's addresses, the technician last picked on the
 * calendar. Display preferences (theme, columns, sidebar) stay.
 */
const SIGNED_IN_DATA_KEYS = ['nms_last_scan', 'nms:calendar-last-technician'];

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
  /** Resolves once the server has cleared the session cookie (or could not be reached). */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
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
    queryClient.clear();
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, [queryClient]);

  /**
   * Leaves nothing of this session behind for the next person on the
   * browser: the cached API answers would otherwise show them the previous
   * account's data until each refetch landed.
   */
  const logout = useCallback(async () => {
    localStorage.removeItem(USER_KEY);
    SIGNED_IN_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
    clearSavedListQueries();
    queryClient.clear();
    setUser(null);
    await apiService.logout();
  }, [queryClient]);

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
