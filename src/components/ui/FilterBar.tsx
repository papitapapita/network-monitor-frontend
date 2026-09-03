'use client';

import React, { useState } from 'react';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { SearchIcon, FunnelIcon, XCircleIcon } from './icons';

interface FilterBarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

interface FilterBarProps {
  /** Always-visible search field — icon-only, no redundant "Buscar" label. Omit on pages with only structured (Select) filters. */
  search?: FilterBarSearch;
  /** Secondary filters (Select, date range, etc.) — collapsed behind the funnel toggle by default. */
  children?: React.ReactNode;
  onClear: () => void;
  hasFilters: boolean;
  /** A secondary filter (not the search box) is currently active — expands the panel on mount so it isn't hidden. */
  secondaryFiltersActive?: boolean;
  /** Grid columns from `lg` up for the collapsed filters, counting the "Limpiar" cell. */
  columns?: 2 | 3 | 4 | 5;
}

// Tailwind needs the literal class names, so they can't be interpolated.
const columnClasses: Record<NonNullable<FilterBarProps['columns']>, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

/**
 * The filter panel above every list table. Search stays visible as a single
 * compact row so the table shows up front instead of a full screen of filter
 * fields; any secondary filters (Selects, date ranges) collapse behind the
 * funnel toggle, auto-expanding when one of them already has a value.
 */
export function FilterBar({
  search,
  children,
  onClear,
  hasFilters,
  secondaryFiltersActive = false,
  columns = 3,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(secondaryFiltersActive);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {search && (
          <Input
            icon={<SearchIcon />}
            aria-label="Buscar"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onClear={() => search.onChange('')}
            placeholder={search.placeholder}
            maxLength={search.maxLength}
            fullWidth
          />
        )}

        {children && (
          <div className="relative shrink-0">
            <IconButton
              icon={<FunnelIcon />}
              label={expanded ? 'Ocultar filtros' : 'Más filtros'}
              variant="outline"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            />
            {secondaryFiltersActive && !expanded && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-gray-900" />
            )}
          </div>
        )}
      </div>

      {children && expanded && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 ${columnClasses[columns]}`}>
          {children}
          <div className="flex items-end">
            <IconButton
              icon={<XCircleIcon />}
              label="Limpiar filtros"
              variant="outline"
              onClick={onClear}
              disabled={!hasFilters}
            />
          </div>
        </div>
      )}
    </div>
  );
}
