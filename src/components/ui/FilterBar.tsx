'use client';

import React from 'react';
import { Button } from './Button';

interface FilterBarProps {
  /** Filter controls — Input/Select/Combobox, one per grid cell. */
  children: React.ReactNode;
  onClear: () => void;
  hasFilters: boolean;
  /** Grid columns from `md` up, counting the "Limpiar Filtros" cell. */
  columns?: 2 | 3 | 4 | 5;
}

// Tailwind needs the literal class names, so they can't be interpolated.
const columnClasses: Record<NonNullable<FilterBarProps['columns']>, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/** The filter panel above every list table. */
export function FilterBar({ children, onClear, hasFilters, columns = 3 }: FilterBarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className={`grid grid-cols-1 gap-4 ${columnClasses[columns]}`}>
        {children}
        <div className="flex items-end">
          <Button variant="outline" fullWidth onClick={onClear} disabled={!hasFilters}>
            Limpiar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
