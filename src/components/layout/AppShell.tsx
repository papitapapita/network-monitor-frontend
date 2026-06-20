'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/auth.context';
import { LoadingSpinner } from '@/components/ui';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuth();

  const isLoginPage = pathname === '/login';

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  // Handle token expiry from API service
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      router.replace('/login');
    };
    window.addEventListener('nms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nms:unauthorized', handleUnauthorized);
  }, [logout, router]);

  // Login page: render without shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // While checking auth state
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 md:ml-56">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center h-14 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Network Monitor</span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
