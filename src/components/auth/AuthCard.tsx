import React from 'react';
import { BrandMark } from '@/components/layout/BrandMark';
import { BRAND } from '@/constants/brand.constants';

/** The signed-out frame: the logo over one card. Shared by every sign-in screen. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <BrandMark className="w-10 h-10" />
            <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{BRAND.name}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-400"
    >
      {children}
    </div>
  );
}
