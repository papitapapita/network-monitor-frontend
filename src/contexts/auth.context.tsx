'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, SessionDTO } from '@/types/auth.types';
import { apiService } from '@/services/api.service';
import { clearSavedListQueries } from '@/hooks/listState';

const TOKEN_KEY = 'nms_token';
const USER_KEY = 'nms_user';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Starts the session a finished sign-in handed back. The login page drives
   * the password and two-factor steps itself, and calls this only once the
   * person is through them — after the recovery codes, on a first sign-in.
   */
  beginSession: (session: SessionDTO) => void;
  logout: () => void;
  /**
   * Keeps the session going after a change that revoked it — a password
   * change signs the account out everywhere, this session included, and hands
   * back the one token that still works (IDN-144).
   */
  replaceToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(USER_KEY);
    if (token && stored) {
      try {
        const parsed: AuthUser = JSON.parse(stored);
        apiService.setToken(token);
        setUser(parsed);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const beginSession = useCallback(({ token, user: authUser }: SessionDTO) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    apiService.setToken(token);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiService.setToken(null);
    clearSavedListQueries();
    setUser(null);
  }, []);

  const replaceToken = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    apiService.setToken(token);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, beginSession, logout, replaceToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
