'use client';

import React from 'react';
import { ArrowLeftIcon } from './icons';
import { Tooltip } from './Tooltip';

interface BackLinkProps {
  onClick: () => void;
  className?: string;
}

/**
 * Compact back-navigation link for detail/create pages. Kept visually
 * separate from the title below it — navigation, identity, and actions
 * read as distinct layers instead of competing in one crowded row.
 *
 * Icon-only: it steps back through history, so naming a fixed section would
 * be wrong whenever the operator arrived from somewhere else.
 */
export function BackLink({ onClick, className = '' }: BackLinkProps) {
  return (
    <div className={className}>
      <Tooltip label="Volver" side="right">
        <button
          type="button"
          onClick={onClick}
          aria-label="Volver"
          className="inline-flex items-center justify-center -m-1 p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <ArrowLeftIcon />
        </button>
      </Tooltip>
    </div>
  );
}
