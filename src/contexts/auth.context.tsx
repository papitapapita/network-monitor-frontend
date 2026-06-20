'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser } from '@/types/auth.types';
import { apiService } from '@/services/api.service';

const TOKEN_KEY = 'nms_token';
const USER_KEY = 'nms_user';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
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

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const result = await apiService.login(email, password);
    if (!result.success || !result.data) {
      return result.error ?? 'Error de autenticación';
    }
    const { token, user: authUser } = result.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    apiService.setToken(token);
    setUser(authUser);
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiService.setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
