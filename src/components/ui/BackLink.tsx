'use client';

import React from 'react';
import { ArrowLeftIcon } from './icons';

interface BackLinkProps {
  /** Name of the place this returns to, e.g. "Fabricantes". */
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * Compact back-navigation link for detail/create pages. Kept visually
 * separate from the title below it — navigation, identity, and actions
 * read as distinct layers instead of competing in one crowded row.
 */
export function BackLink({ label, onClick, className = '' }: BackLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer ${className}`}
    >
      <ArrowLeftIcon />
      {label}
    </button>
  );
}
