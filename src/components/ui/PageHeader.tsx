'use client';

import React from 'react';
import { Button } from './Button';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Omit to hide the "Actualizar" button. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshed?: Date | null;
  /** Primary actions, rendered to the right of "Actualizar". */
  actions?: React.ReactNode;
}

function RefreshIcon() {
  return (
    <svg
      className="mr-1.5 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

/** Title, count line, refresh control and primary actions — shared by every list page. */
export function PageHeader({
  title,
  subtitle,
  onRefresh,
  isRefreshing = false,
  lastRefreshed,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap justify-end gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              onClick={onRefresh}
              isLoading={isRefreshing}
              disabled={isRefreshing}
            >
              {!isRefreshing && <RefreshIcon />}
              Actualizar
            </Button>
          )}
          {actions}
        </div>
        {lastRefreshed && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Actualizado: {lastRefreshed.toLocaleTimeString('es')}
          </span>
        )}
      </div>
    </div>
  );
}
