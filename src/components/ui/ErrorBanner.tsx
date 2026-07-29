'use client';

import React from 'react';
import { Button } from './Button';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryText?: string;
  className?: string;
}

/** The red notice every page uses to report a failed request. */
export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  retryText = 'Reintentar',
  className = 'mb-6',
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-red-800 dark:text-red-400 text-sm">{message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 shrink-0 transition-colors"
          >
            <span className="sr-only">Descartar</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          {retryText}
        </Button>
      )}
    </div>
  );
}
